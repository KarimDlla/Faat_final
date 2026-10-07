import { createServerFn } from "@tanstack/react-start";
import type { DynamicQuotationTable, PricingGroup, SystemType, UniversalQuotationExtraction } from "./types";

const systemTypes = ["elevators", "chiller", "hvac", "vrf", "bms", "smoke", "escalators", "other"] as const;

const schema = {
  type: "object",
  properties: {
    systemType: { type: "string", enum: [...systemTypes] },
    systemLabel: { type: "string" },
    project: { type: "object", properties: { name: { type: "string" }, building: { type: "string" }, location: { type: "string" } }, required: ["name", "building", "location"] },
    supplier: { type: "string" },
    quoteNumber: { type: "string" },
    quoteDate: { type: "string" },
    currency: { type: "string" },
    items: { type: "array", items: { type: "object", properties: {
      id: { type: "string" }, code: { type: "string" }, category: { type: "string" }, description: { type: "string" },
      quantity: { type: "number" }, unit: { type: "string" }, unitPrice: { type: "number" }, total: { type: "number" }, location: { type: "string" },
      specifications: { type: "array", items: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] } },
    }, required: ["id", "code", "category", "description", "quantity", "unit", "unitPrice", "total", "location", "specifications"] } },
    projectStructure: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, type: { type: "string", enum: ["system", "location", "equipment", "scope", "commercial", "terms", "other"] }, summary: { type: "string" } }, required: ["id", "title", "type", "summary"] } },
    dynamicTables: { type: "array", items: { type: "object", properties: {
      id: { type: "string" }, title: { type: "string" }, description: { type: "string" }, sourceSection: { type: "string" },
      columns: { type: "array", items: { type: "object", properties: { key: { type: "string" }, label: { type: "string" }, type: { type: "string", enum: ["text", "number", "currency", "date"] } }, required: ["key", "label", "type"] } },
      rows: { type: "array", items: { type: "object", properties: { id: { type: "string" }, cells: { type: "array", items: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] } } }, required: ["id", "cells"] } },
    }, required: ["id", "title", "description", "sourceSection", "columns", "rows"] } },
    pricingGroups: { type: "array", items: { type: "object", properties: {
      code: { type: "string" }, kind: { type: "string", enum: ["L", "E", "M"] }, description: { type: "string" },
      quantity: { type: "number" }, fobUnit: { type: "number" }, fobTotal: { type: "number" },
      fobSource: { type: "string", enum: ["explicit_fob", "unlabeled_price", "not_found"] }, evidence: { type: "string" },
      technical: { type: "object", properties: { totalHeightM: { type: "number" }, landingDoors: { type: "number" }, tractionRopes: { type: "number" } }, required: ["totalHeightM", "landingDoors", "tractionRopes"] },
    }, required: ["code", "kind", "description", "quantity", "fobUnit", "fobTotal", "fobSource", "evidence", "technical"] } },
    commercial: { type: "object", properties: { subtotal: { type: "number" }, discount: { type: "number" }, tax: { type: "number" }, grandTotal: { type: "number" } }, required: ["subtotal", "discount", "tax", "grandTotal"] },
    terms: { type: "object", properties: { delivery: { type: "string" }, warranty: { type: "string" }, payment: { type: "string" }, validity: { type: "string" } }, required: ["delivery", "warranty", "payment", "validity"] },
    generalSpecifications: { type: "array", items: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] } },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["systemType", "systemLabel", "project", "supplier", "quoteNumber", "quoteDate", "currency", "items", "projectStructure", "dynamicTables", "pricingGroups", "commercial", "terms", "generalSpecifications", "notes"],
};

function asText(v: unknown) { return v == null ? "" : String(v); }
function asNum(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function normalizeSystem(v: unknown, label = ""): SystemType | "other" {
  const raw = String(v ?? "").trim().toLowerCase();
  const labelRaw = String(label ?? "").trim().toLowerCase();
  if (/\bvrf\b|\bvrv\b|variable\s+refrigerant\s+flow|تكييف\s*متغير\s*التدفق/.test(`${raw} ${labelRaw}`)) return "vrf";
  return systemTypes.includes(raw as typeof systemTypes[number]) ? raw as SystemType : "other";
}

function inferSystemFromFileName(fileName = ""): SystemType | null {
  const name = fileName.toLowerCase();
  if (/\bvrf\b|\bvrv\b|variable[-_ ]refrigerant/.test(name)) return "vrf";
  if (/elevator|lift|مصعد|مصاعد|se500m/.test(name)) return "elevators";
  if (/chiller|تشيلر/.test(name)) return "chiller";
  if (/bms|building[-_ ]management/.test(name)) return "bms";
  return null;
}

// Basic in-process rate limit. This is a stopgap, not a substitute for real auth: it resets
// on every server restart and is per-instance only. Replace with a proper authenticated,
// per-user limit once the backend/auth layer exists.
const requestTimestamps: number[] = [];
const maxRequestsPerMinute = Number(process.env.AI_MAX_REQUESTS_PER_MINUTE || process.env.GEMINI_MAX_REQUESTS_PER_MINUTE || 20);

function withinRateLimit(): boolean {
  const now = Date.now();
  while (requestTimestamps.length && now - requestTimestamps[0] > 60_000) requestTimestamps.shift();
  if (requestTimestamps.length >= maxRequestsPerMinute) return false;
  requestTimestamps.push(now);
  return true;
}

// Turns whatever the model returned for pricingGroups into clean, unique L#/E#/M# groups.
// The model only READS values from the document; nothing here calculates a price — if a number
// is missing it stays 0 and the UI asks the user, instead of guessing (see pricing integration spec).
function normalizePricingGroups(raw: unknown): PricingGroup[] {
  if (!Array.isArray(raw)) return [];
  const counters: Record<"L" | "E" | "M", number> = { L: 0, E: 0, M: 0 };
  const used = new Set<string>();
  const out: PricingGroup[] = [];
  for (const g of raw as any[]) {
    const kind = (["L", "E", "M"].includes(g?.kind) ? g.kind : /^[LEM]/i.test(asText(g?.code)) ? asText(g.code)[0].toUpperCase() : "L") as "L" | "E" | "M";
    const m = /^\s*([LEM])\s*(\d+)\s*$/i.exec(asText(g?.code));
    let code = m && m[1].toUpperCase() === kind ? `${kind}${Number(m[2])}` : "";
    if (!code || used.has(code)) { do { counters[kind] += 1; code = `${kind}${counters[kind]}`; } while (used.has(code)); }
    used.add(code);
    const quantity = Math.max(0, asNum(g?.quantity));
    let fobUnit = Math.max(0, asNum(g?.fobUnit));
    const fobTotal = Math.max(0, asNum(g?.fobTotal));
    if (fobUnit === 0 && fobTotal > 0 && quantity > 0) fobUnit = fobTotal / quantity;
    const fobSource = fobUnit === 0 ? "not_found" : g?.fobSource === "explicit_fob" ? "explicit_fob" : "unlabeled_price";
    out.push({
      code, kind, description: asText(g?.description), quantity, fobUnit, fobTotal: fobTotal || fobUnit * quantity, fobSource, evidence: asText(g?.evidence),
      technical: { totalHeightM: Math.max(0, asNum(g?.technical?.totalHeightM)), landingDoors: Math.max(0, asNum(g?.technical?.landingDoors)), tractionRopes: Math.max(0, asNum(g?.technical?.tractionRopes)) },
    });
  }
  return out;
}

export const extractQuotation = createServerFn({ method: "POST" })
  .validator((input: { text?: string; fileBase64?: string; mimeType?: string; fileName?: string; provider?: "openai" | "gemini" }) => input)
  .handler(async ({ data }) => {
    if (!withinRateLimit()) return { ok: false as const, error: "عدد كبير من الطلبات، حاول مرة أخرى بعد قليل", extras: {}, reviewFields: [] };

    const prompt = `أنت محرك استخراج عروض فنية ومالية عام لشركة FAAT Engineering. اقرأ المستند بالكامل، بما في ذلك الجداول وكل الصفحات والصور إن وجدت. لا تفترض نوع النظام مسبقاً ولا تجبر البيانات على قالب مصاعد. إذا ظهر VRF أو VRV أو Variable Refrigerant Flow في عنوان المستند أو أي جدول، فصنّف systemType على أنه vrf وليس hvac. HVAC هو تصنيف عام فقط، أما VRF فيجب أن يبقى نوع نظام مستقل في النتيجة. حدد نوع النظام بنفسك من المحتوى، ويمكنك استخدام other إذا لم يطابق الأنواع المعروفة. استخرج البيانات الفعلية فقط ولا تخترع أي قيمة. حافظ على كل صف/عنصر مهم كعنصر مستقل داخل items، حتى لو كان موزعاً على طوابق أو مناطق مختلفة. location يجب أن يذكر الطابق/المنطقة إذا كانت موجودة. category يجب أن يصف تصنيف العنصر مثل Indoor Unit أو Outdoor Unit أو Y Branch أو Elevator أو Chiller. ضع المواصفات الخاصة بكل عنصر في specifications كمفاتيح وقيم.

أنشئ أيضاً dynamicTables: هذه ليست قوالب ثابتة. افهم بنية المستند أولاً ثم ابنِ عدداً متغيراً من الجداول المنطقية التي تجعل البيانات أسهل للمراجعة والتحقق. أضف أو احذف الجداول حسب ما يوجد فعلياً في المستند. كل جدول يختار أعمدته بنفسه، ويمكن أن تكون الأعمدة مختلفة من جدول لآخر. اجعل الجداول تعكس تنظيم الكوتيشن الحقيقي: مثلاً قد يكون هناك جدول لكل طابق أو منطقة، أو جدول للوحدات الداخلية والخارجية، أو جدول مواصفات رئيسية، أو جدول تشطيبات، أو جدول وظائف قياسية، أو جدول أسعار. لا تنشئ جدولاً فارغاً لمجرد اتباع مثال. لا تكرر نفس البيانات في جداول كثيرة بلا فائدة. يجب أن تكون كل خلية مبنية على نص المستند فقط.

قبل بناء dynamicTables أنشئ projectStructure: قائمة قصيرة من الوحدات المنطقية التي فهمتها من المستند، مثل نظام، طابق/منطقة، معدات، نطاق أعمال، أسعار، شروط. هذه القائمة تصف بنية الملف ولا تفرض قالباً ثابتاً. بعد ذلك حوّل هذه البنية إلى dynamicTables. الجداول يجب أن تكون ناتجة من محتوى المستند نفسه، ويمكن أن يختلف عددها وأعمدتها جذرياً بين ملف وآخر.
لدينا مرجعان لمساعدة فهم البنية فقط: كوتيشن VRF يقسم البيانات حسب الطوابق ويستخدم Indoor Units وOutdoor Units وY branch؛ وكوتيشن المصعد يستخدم مواصفات أساسية وأبعاداً ووظائف قياسية وديكوراً وسعراً وشروطاً تجارية. ولدينا أيضاً Proposal نهائي مقدم للعميل لنفس مشروع Al Thuria كمرجع للإخراج التجاري والفني، وليس كمصدر بيانات للكوتيشن. هذا المرجع يبين أن عرض العميل يمكن أن يجمع VRF مع أعمال النحاس والدكتات والمراوح ومخارج الهواء والاختبارات، ثم يعرض Scope وExclusions وWarranty وBOQ وشروطاً عامة وسعر بيع للمشروع. لا تنسخ أرقام أو أسعار أو نصوص المرجع إلى استخراج الكوتيشن، ولا تفترض أن كل عرض يجب أن يحتوي هذه الأقسام.

استخرج العملة والأسعار والكميات والإجمالي كما تظهر، ثم احسب total فقط للتحقق ولا تستبدل رقم المورد دون سبب. إذا لم توجد قيمة اتركها فارغة أو 0 للأرقام. لا تخترع شروط تسليم أو ضمان أو دفع. ضع كل مواصفة فنية عامة (غير مرتبطة بعنصر محدد) في generalSpecifications كمفتاح وقيمة — هذا ينطبق على كل الأنظمة بما فيها المصاعد، فلا يوجد قالب مواصفات ثابت لأي نظام. 

التسعير: نحن نملأ لاحقاً ملف Excel لحساب التكلفة (CCS) فيه مجموعات معدات، ورمز كل مجموعة حرف + رقم: L1, L2, L3... للمصاعد (Elevators)، E1, E2... للسلالم المتحركة (Escalators)، M1, M2... للممرات المتحركة (Moving Walks). عدد المجموعات غير محدود: أنشئ في pricingGroups مجموعة لكل نوع/طراز/منطقة خدمة مختلفة فعلاً في المستند (مثلاً مصعدان بمواصفات مختلفة = L1 وL2) مع ترقيم متسلسل لكل حرف يبدأ من 1. إذا كان النظام ليس مصاعد ولا سلالم ولا ممرات متحركة فاترك pricingGroups مصفوفة فارغة. لكل مجموعة: quantity هو عدد وحداتها، fobUnit هو سعر FOB لوحدة واحدة، fobTotal هو إجمالي FOB للمجموعة. تمييز الكمية عن سعر الوحدة عن الإجمالي إلزامي: مثلاً الكمية 3 وسعر الوحدة 8,500 والإجمالي 25,500 تعني quantity=3 وfobUnit=8500 وfobTotal=25500. لا تعتبر الإجمالي العام للعرض (grandTotal) قيمة FOB إلا إذا كان المستند يذكر صراحة أن هذا الرقم هو FOB (أو شروط التسليم FOB). ضع fobSource="explicit_fob" عندما يُسمى السعر FOB أو تكون شروط الأسعار FOB بوضوح، و"unlabeled_price" عندما يوجد سعر للوحدة بدون أن يُذكر أنه FOB (أعطِ الرقم لكن سيراجعه المستخدم)، و"not_found" مع fobUnit=0 عندما لا يوجد سعر لهذه المجموعة. اكتب في evidence النص أو اسم العمود القصير الذي أخذت منه السعر. لا تستخرج ولا تخمّن أي قيمة تسعيرية داخلية: لا هامش ربح ولا مصاريف إدارية ولا مصاريف بنكية ولا جمارك ولا ضريبة دخل ولا خصم ولا تكاليف تركيب أو شحن محلية، فهذه يدخلها المستخدم يدوياً. وأنت لا تحسب أي سعر بيع ولا تكلفة. في technical (للمصاعد فقط): totalHeightM هو ارتفاع المصعد الكلي بالمتر (Travel Height / Lift Height)، landingDoors هو عدد أبواب الطوابق (عدد المحطات/Stops)، tractionRopes هو عدد حبال الجر؛ ضع 0 لأي قيمة لا تُذكر صراحة في المستند ولا تحسبها بنفسك. الممرات المتحركة (Moving Walk / Travelator / Autowalk) تُصنّف systemType=escalators مع systemLabel يذكر Moving Walk.\n\nقواعد خاصة بالمصاعد (مهمة): ابحث عن كل بند بحسب اسمه ومعناه وليس بحسب رقم الصف، لأن ترقيم الصفوف يتغير من كوتيشن لآخر. أبقِ التسمية الأصلية كما هي في الكوتيشن ولا تدمج الصفوف ولا تعيد تسميتها: صف Car entrances (Single/Double...) سجله بمفتاح Car entrances؛ صف Door opening type (Center opening/Side opening/Telescopic...) سجله بمفتاح Door opening type؛ صف Hoistway type (Concrete/Steel/Brick...) سجله بمفتاح Hoistway type؛ وصف Control system (Duplex/Simplex...) هو نظام التشغيل وليس لوحة التحكم. لوحة التحكم غالباً تُذكر كجملة بلا عنوان ضمن الملاحظات الخاصة Special Notes (مثل: Adopt <Brand> integration control system) فإذا وجدت جملة تصف لوحة/نظام/خزانة التحكم الخاص بالمصعد، أضفها إلى generalSpecifications بمفتاح Control panel وبقيمة الجملة كما وردت حرفياً من دون تفسير. لا تخمّن أي قيمة غير موجودة في الكوتيشن.\n\nأعد JSON فقط وفق المخطط.`;
    // The filename is a weak hint only — never a source of truth. If it disagrees with the
    // document's actual content, the content wins (see faat-project-types skill).
    const inferredFromName = inferSystemFromFileName(data.fileName || "");
    type Provider = "openai" | "gemini";
    type ModelAttempt = { ok: true; provider: Provider; model: string; body: any } | { ok: false; provider: Provider; model: string; error: string; fatal: boolean };

    const configuredOrder = (process.env.AI_PROVIDER_ORDER || "openai,gemini")
      .split(",").map((value) => value.trim().toLowerCase()).filter((value): value is Provider => value === "openai" || value === "gemini");
    const providerOrder: Provider[] = Array.from(new Set(configuredOrder.length ? configuredOrder : ["openai", "gemini"]));
    for (const provider of ["openai", "gemini"] as const) if (!providerOrder.includes(provider)) providerOrder.push(provider);
    // The provider picked in the header toggle goes first; the other one stays as fallback (original chain).
    if (data.provider === "openai" || data.provider === "gemini") {
      const rest = providerOrder.filter((p) => p !== data.provider);
      providerOrder.splice(0, providerOrder.length, data.provider, ...rest);
    }

    const retryableStatuses = new Set([408, 409, 429, 500, 502, 503, 504]);
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS || process.env.GEMINI_TIMEOUT_MS || 30000);
    const fallbackConcurrency = Math.max(1, Number(process.env.GEMINI_FALLBACK_CONCURRENCY || 2));

    // Keys come ONLY from the server environment — never from the browser.
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();

    const openaiTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || timeoutMs);

    function openAIInput(): unknown[] {
      const content: unknown[] = [{ type: "input_text", text: `${prompt}\nاسم الملف المرفوع: ${data.fileName || "غير معروف"}. هذا مجرد إشارة مساعدة ضعيفة، وليس مصدراً للحقيقة: إذا تعارض مع محتوى المستند الفعلي، اعتمد على المحتوى دائماً.` }];
      if (data.text?.trim()) content.push({ type: "input_text", text: `النص المقدم:\n${data.text.slice(0, 60000)}` });
      if (data.fileBase64) {
        // The Responses API wants a data URL ("data:<mime>;base64,..."), not bare base64.
        const mt = (data.mimeType || "application/pdf").toLowerCase();
        const dataUrl = `data:${mt};base64,${data.fileBase64}`;
        if (/^image\/(png|jpeg|gif|webp)$/.test(mt)) content.push({ type: "input_image", image_url: dataUrl });
        else content.push({ type: "input_file", filename: data.fileName || "quotation.pdf", file_data: dataUrl });
      }
      return content;
    }

    const geminiParts: unknown[] = [{ text: `${prompt}\nاسم الملف المرفوع: ${data.fileName || "غير معروف"}. هذا مجرد إشارة مساعدة ضعيفة، وليس مصدراً للحقيقة: إذا تعارض مع محتوى المستند الفعلي، اعتمد على المحتوى دائماً.` }];
    if (data.text?.trim()) geminiParts.push({ text: `النص المقدم:\n${data.text.slice(0, 60000)}` });
    if (data.fileBase64) geminiParts.push({ inlineData: { mimeType: data.mimeType || "application/pdf", data: data.fileBase64 } });

    function modelList(provider: Provider): string[] {
      if (provider === "openai") {
        const primary =  process.env.OPENAI_MODEL?.trim() || "gpt-6-luna";
        const fallbacks = [1, 2, 3].map((n) => process.env[`OPENAI_MODEL_FALLBACK_${n}`]?.trim()).filter(Boolean) as string[];
        return Array.from(new Set([primary, ...fallbacks]));
      }
      const primary =  process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
      const configuredFallbacks = [1,2,3,4,5].map((n) => process.env[`GEMINI_MODEL_FALLBACK_${n}`]?.trim()).filter(Boolean) as string[];
      const defaults = ["gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash","gemini-3.5-flash-lite"];
      return Array.from(new Set([primary, ...configuredFallbacks, ...defaults]));
    }

    async function callOpenAI(model: string): Promise<ModelAttempt> {
      if (!openaiKey) return { ok: false, provider: "openai", model, error: "OPENAI_API_KEY غير مضبوط على الخادم (.env.local)", fatal: false };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), openaiTimeoutMs);
      try {
        const res = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model,
            input: [{ role: "user", content: openAIInput() }],
            text: { format: { type: "json_schema", name: "faat_quotation_extraction", schema, strict: false } },
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) return { ok: true, provider: "openai", model, body: await res.json() };
        const msg = await res.text();
        return { ok: false, provider: "openai", model, error: `OpenAI ${model} API ${res.status}: ${msg.slice(0,300)}`, fatal: !retryableStatuses.has(res.status) && res.status !== 404 };
      } catch (error) {
        clearTimeout(timer);
        const error_ = error instanceof DOMException && error.name === "AbortError" ? `OpenAI ${model}: timeout بعد ${openaiTimeoutMs}ms` : `OpenAI ${model}: ${error instanceof Error ? error.message : String(error)}`;
        return { ok: false, provider: "openai", model, error: error_, fatal: false };
      }
    }

    async function callGemini(model: string): Promise<ModelAttempt> {
      if (!geminiKey) return { ok: false, provider: "gemini", model, error: "GEMINI_API_KEY غير مضبوط على الخادم (.env.local)", fatal: false };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          body: JSON.stringify({ contents: [{ role: "user", parts: geminiParts }], generationConfig: { responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingLevel: "low" } } }), signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) return { ok: true, provider: "gemini", model, body: await res.json() };
        const msg = await res.text();
        return { ok: false, provider: "gemini", model, error: `Gemini ${model} API ${res.status}: ${msg.slice(0,300)}`, fatal: !retryableStatuses.has(res.status) && res.status !== 404 };
      } catch (error) {
        clearTimeout(timer);
        const error_ = error instanceof DOMException && error.name === "AbortError" ? `Gemini ${model}: timeout بعد ${timeoutMs}ms` : `Gemini ${model}: ${error instanceof Error ? error.message : String(error)}`;
        return { ok: false, provider: "gemini", model, error: error_, fatal: false };
      }
    }

    async function tryProvider(provider: Provider): Promise<ModelAttempt> {
      const models = modelList(provider);
      const call = provider === "openai" ? callOpenAI : callGemini;
      const first = await call(models[0]);
      if (first.ok || first.fatal || models.length === 1) return first;
      const errors = [first.error];
      for (let i = 1; i < models.length; i += fallbackConcurrency) {
        const batch = models.slice(i, i + fallbackConcurrency);
        const settled = await Promise.allSettled(batch.map(call));
        const success = settled.find((result): result is PromiseFulfilledResult<ModelAttempt & { ok: true }> => result.status === "fulfilled" && result.value.ok);
        if (success) return success.value;
        for (const result of settled) if (result.status === "fulfilled" && !result.value.ok) errors.push(result.value.error);
      }
      return { ok: false, provider, model: models[0], error: errors.join("\n"), fatal: false };
    }

    let body: any = null; let modelUsed = ""; let providerUsed: Provider | "" = ""; let attempts = 0;
    const errors: string[] = [];
    for (const provider of providerOrder) {
      const result = await tryProvider(provider);
      attempts += 1;
      if (result.ok) { body = result.body; modelUsed = result.model; providerUsed = result.provider; break; }
      errors.push(result.error);
    }
    if (!body) return { ok:false as const,error:`فشل استخراج الكوتيشن عبر ${providerOrder.join(" → ")}:
${errors.join("\n")}`,extras:{},reviewFields:[] };
    const raw = providerUsed === "openai" ? (body.output_text || body.output?.flatMap((item: any) => item.content || []).filter((part: any) => part.type === "output_text").map((part: any) => part.text || "").join("") || "{}") : (body.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "{}");
    let parsed: any; try { parsed = JSON.parse(raw); } catch { return { ok:false as const,error:"مزود الذكاء الاصطناعي أعاد نتيجة غير قابلة للقراءة",extras:{},reviewFields:[] }; }

    // Content wins over filename. inferredFromName is surfaced separately (filenameHint) purely
    // so the UI can flag a mismatch for the user to review — it must never silently override
    // what the AI actually read from the document (see faat-project-types skill).
    const aiSystem = normalizeSystem(parsed.systemType, parsed.systemLabel);
    const systemType = aiSystem;
    const filenameHint = inferredFromName && inferredFromName !== systemType ? inferredFromName : null;
    const extraction: UniversalQuotationExtraction = {
      systemType, systemLabel: systemType === "vrf" ? "VRF" : asText(parsed.systemLabel),
      project: { name: asText(parsed.project?.name), building: asText(parsed.project?.building), location: asText(parsed.project?.location) },
      supplier: asText(parsed.supplier), quoteNumber: asText(parsed.quoteNumber), quoteDate: asText(parsed.quoteDate), currency: asText(parsed.currency || "USD"),
      projectStructure: Array.isArray(parsed.projectStructure) ? parsed.projectStructure.map((x: any, i: number) => ({ id: asText(x.id || `section-${i+1}`), title: asText(x.title), type: ["system","location","equipment","scope","commercial","terms","other"].includes(x.type) ? x.type : "other", summary: asText(x.summary) })).filter((x: any) => x.title) : [],
      items: Array.isArray(parsed.items) ? parsed.items.map((x: any, i: number) => ({ id: asText(x.id || `item-${i+1}`), code: asText(x.code), category: asText(x.category), description: asText(x.description), quantity: asNum(x.quantity), unit: asText(x.unit), unitPrice: asNum(x.unitPrice), total: asNum(x.total), location: asText(x.location), specifications: Array.isArray(x.specifications) ? x.specifications.map((q: any) => ({ key: asText(q.key), value: asText(q.value) })) : [] })) : [],
      dynamicTables: Array.isArray(parsed.dynamicTables) ? parsed.dynamicTables.map((t: any, ti: number): DynamicQuotationTable => ({
        id: asText(t.id || `table-${ti + 1}`), title: asText(t.title || `Table ${ti + 1}`), description: asText(t.description), sourceSection: asText(t.sourceSection),
        columns: Array.isArray(t.columns) ? t.columns.map((c: any) => ({ key: asText(c.key), label: asText(c.label), type: ["text", "number", "currency", "date"].includes(c.type) ? c.type : "text" })) : [],
        rows: Array.isArray(t.rows) ? t.rows.map((r: any, ri: number) => ({ id: asText(r.id || `${ti + 1}-${ri + 1}`), cells: Array.isArray(r.cells) ? r.cells.map((c: any) => ({ key: asText(c.key), value: asText(c.value) })) : [] })) : [],
      })).filter((t: DynamicQuotationTable) => t.columns.length > 0 && t.rows.length > 0) : [],
      pricingGroups: normalizePricingGroups(parsed.pricingGroups),
      commercial: { subtotal: asNum(parsed.commercial?.subtotal), discount: asNum(parsed.commercial?.discount), tax: asNum(parsed.commercial?.tax), grandTotal: asNum(parsed.commercial?.grandTotal) },
      terms: { delivery: asText(parsed.terms?.delivery), warranty: asText(parsed.terms?.warranty), payment: asText(parsed.terms?.payment), validity: asText(parsed.terms?.validity) },
      generalSpecifications: Array.isArray(parsed.generalSpecifications) ? parsed.generalSpecifications.map((x: any) => ({ key: asText(x.key), value: asText(x.value) })) : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes.map(asText) : [],
      validation: { itemsTotal: 0, difference: 0, totalsMatch: false },
    };
    const itemsTotal = extraction.items.reduce((sum, item) => sum + (Number.isFinite(item.total) ? item.total : 0), 0);
    const difference = Math.round((itemsTotal - extraction.commercial.grandTotal) * 100) / 100;
    extraction.validation = { itemsTotal, difference, totalsMatch: extraction.commercial.grandTotal > 0 && Math.abs(difference) < 0.01 };
    const reviewFields = [
      ["systemType", "نوع النظام", extraction.systemLabel || extraction.systemType], ["project", "المشروع", extraction.project.name], ["supplier", "المورد", extraction.supplier], ["quoteNumber", "رقم الكوتيشن", extraction.quoteNumber], ["quoteDate", "تاريخ الكوتيشن", extraction.quoteDate], ["currency", "العملة", extraction.currency], ["grandTotal", "الإجمالي", extraction.commercial.grandTotal ? String(extraction.commercial.grandTotal) : ""],
    ].map(([key,label,value]) => ({ key, label, value, confidence: value ? "high" : "review", source: data.fileName || providerUsed || "AI" }));
    return { ok:true as const, extraction, filenameHint, extras: { ...parsed, ...extraction, fob: extraction.commercial.grandTotal, quantity: extraction.items.reduce((n,x) => n + x.quantity, 0) }, reviewFields, modelUsed, providerUsed, attempts };
  });


// Tells the UI which providers have a key configured on the server. Returns booleans only — never the keys.
export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => ({
  openai: !!process.env.OPENAI_API_KEY?.trim(),
  gemini: !!process.env.GEMINI_API_KEY?.trim(),
}));
