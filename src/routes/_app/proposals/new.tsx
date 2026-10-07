import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { TemplateManager } from "@/components/templates/template-manager";
import { generateAll } from "@/lib/documents";
import { extractQuotation } from "@/lib/extract-quotation";
import { systemLabel } from "@/lib/labels";
import type { AIField } from "@/lib/types";
import { computePricing, defaultCostLines } from "@/lib/pricing";
import { useAppStore } from "@/lib/store";
import type { CostLine, PaymentTerms, Proposal, ProposalUnit, ScheduleTerms, SpecField, SupplierQuotation, SystemType, UniversalQuotationExtraction } from "@/lib/types";
import { formatMoney, nextProposalNumber, uid } from "@/lib/utils";

export const Route = createFileRoute("/_app/proposals/new")({ component: NewProposal });

const steps = ["الكوتيشن + AI", "المراجعة والتسعير", "التوليد"];

const selectCls = "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent";

function BlockHeader({ icon, title, hint, aside }: { icon?: ReactNode; title: string; hint?: string; aside?: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-6">{title}</div>
        {hint ? <p className="text-xs leading-5 text-muted">{hint}</p> : null}
      </div>
      {aside}
    </div>
  );
}

function NewProposal() {
  const nav = useNavigate();
  const store = useAppStore();
  const salesManager = useAppStore((s) => s.salesManager);
  const [step, setStep] = useState(0);
  const [projectMode, setProjectMode] = useState<"existing" | "new">("new");
  const [projectId, setProjectId] = useState(store.projects[0]?.id ?? "");
  const [newProject, setNewProject] = useState({ name: "", nameAr: "", location: "", clientName: "", division: "other" as SystemType });
  // The user's own choice (made before/without AI help) vs what the AI actually read from the
  // quotation content. Kept separate so a mismatch can be surfaced instead of silently
  // overwriting the user's selection (see FR-006 / faat-project-types skill).
  const [selectedSystemType, setSelectedSystemType] = useState<SystemType>("other");
  const [detectedSystemType, setDetectedSystemType] = useState<SystemType | null>(null);
  const [filenameHint, setFilenameHint] = useState<SystemType | null>(null);
  const systemType: SystemType = selectedSystemType !== "other" ? selectedSystemType : (detectedSystemType ?? "other");
  const systemTypeMismatch = !!(detectedSystemType && selectedSystemType !== "other" && selectedSystemType !== detectedSystemType);
  const [extracting, setExtracting] = useState(false);
  // Which AI reads the quotation — chosen per extraction (the other one stays as server-side fallback).
  const [aiProvider, setAiProvider] = useState<"openai" | "gemini">("openai");
  // Generic technical spec rows — used for every system type, elevators included. Populated
  // from whatever the AI found in generalSpecifications; the user can add/edit/remove rows.
  const [specs, setSpecs] = useState<SpecField[]>([]);
  const [fob, setFob] = useState(0);
  const [qty, setQty] = useState(1);
  const [costLines, setCostLines] = useState<CostLine[]>(defaultCostLines());
  const [sellingOverride, setSellingOverride] = useState(0);
  const [pricingMode, setPricingMode] = useState<"calculated" | "manual">("calculated");
  const [payment, setPayment] = useState<PaymentTerms>({ advance: 40, shipping: 50, handover: 10 });
  const [schedule, setSchedule] = useState<ScheduleTerms>({
    supplyMin: 16, supplyMax: 20, installMin: 6, installMax: 8, testMin: 2, testMax: 3, warrantyMonths: 36, freeMaintenanceMonths: 12,
  });
  const [confirmed, setConfirmed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notes, setNotes] = useState("");
  const [units, setUnits] = useState<ProposalUnit[]>([]);
  const [supplier, setSupplier] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [quoteRevision, setQuoteRevision] = useState(0);
  const [quoteFileName, setQuoteFileName] = useState("");
  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const [aiFields, setAiFields] = useState<AIField[]>([]);
  const [extraction, setExtraction] = useState<UniversalQuotationExtraction | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | "review">("all");

  const effectiveQty = units.length ? units.reduce((n, u) => n + u.quantity, 0) : qty;
  // FOB is per group (L1, L2, E1…). When every group has its own FOB, the total is the sum of
  // quantity × that group's FOB — never one merged project-wide FOB.
  const groupFobMode = units.length > 0 && units.every((u) => (u.fobUnit ?? 0) > 0);
  const fobTotal = groupFobMode ? units.reduce((n, u) => n + u.quantity * (u.fobUnit ?? 0), 0) : fob * Math.max(1, effectiveQty);
  const pricing = useMemo(() => computePricing(fobTotal, costLines, pricingMode === "manual" && sellingOverride > 0 ? sellingOverride : undefined), [fobTotal, costLines, sellingOverride, pricingMode]);

  function addUnit() {
    const next = units.length + 1;
    setUnits([...units, { id: uid("u"), code: `L${next}`, description: `مجموعة ${next}`, quantity: 1, specs: [...specs] }]);
  }

  function updateUnit(id: string, patch: Partial<ProposalUnit>) {
    setUnits(units.map((u) => u.id === id ? { ...u, ...patch } : u));
  }

  function removeUnit(id: string) {
    if (units.length <= 1) return;
    setUnits(units.filter((u) => u.id !== id));
  }

  async function runExtract() {
    setExtracting(true);
    try {
      let fileBase64 = "";
      let mimeType = "";
      if (quoteFile) {
        mimeType = quoteFile.type || "application/pdf";
        if (quoteFile.size > 50 * 1024 * 1024) throw new Error("الملف أكبر من 50MB");
        const bytes = new Uint8Array(await quoteFile.arrayBuffer());
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
        fileBase64 = btoa(binary);
      }
      const res = await extractQuotation({ data: { text: "", fileBase64, mimeType, fileName: quoteFileName, provider: aiProvider } });
      if (!res.ok) throw new Error(res.error);
      const x = res.extraction;
      setExtraction(x);
      // Never silently overwrite what the user already picked — just record what the AI saw,
      // and let the mismatch banner (below, in the JSX) surface a conflict for the user to resolve.
      setDetectedSystemType(x.systemType);
      setFilenameHint(res.filenameHint ?? null);
      setNewProject((v) => ({
        ...v,
        name: x.project.name || v.name,
        nameAr: x.project.name || v.nameAr,
        location: x.project.location || v.location,
        division: selectedSystemType !== "other" ? selectedSystemType : x.systemType,
      }));
      const genericSpecs: SpecField[] = x.generalSpecifications.map((s) => ({ key: s.key, label: s.key, value: s.value }));
      setSpecs(genericSpecs);
      const itemQty = x.items.reduce((n, item) => n + Math.max(0, item.quantity), 0);
      const q = Math.max(1, itemQty || 1);
      setUnits([{ id: uid("u"), code: "L1", description: "المجموعة الرئيسية", quantity: q, specs: genericSpecs }]);
      // The AI also read the equipment groups for the CCS pricing workbook (L=elevators, E=escalators,
      // M=moving walks), each with its own quantity and FOB. If it found any, they replace the single default group.
      const groups = x.pricingGroups ?? [];
      if (groups.length) {
        setUnits(groups.map((g) => ({
          id: uid("u"), code: g.code, description: g.description || g.code, quantity: Math.max(1, g.quantity || 1), specs: genericSpecs,
          fobUnit: g.fobUnit > 0 ? g.fobUnit : undefined, fobSource: g.fobSource,
          technical: { totalHeightM: g.technical.totalHeightM || undefined, landingDoors: g.technical.landingDoors || undefined, tractionRopes: g.technical.tractionRopes || undefined },
        })));
      }
      if (x.supplier) setSupplier(x.supplier); else setSupplier("");
      if (x.quoteNumber) setQuoteNumber(x.quoteNumber); else setQuoteNumber("");
      if (x.quoteDate) setQuoteDate(x.quoteDate.slice(0, 10));
      const grand = Number(x.commercial.grandTotal) || 0;
      const groupQty = groups.reduce((n, g) => n + Math.max(1, g.quantity || 1), 0);
      const groupFobSum = groups.reduce((n, g) => n + Math.max(1, g.quantity || 1) * (g.fobUnit || 0), 0);
      const groupsHaveFob = groups.length > 0 && groups.every((g) => g.fobUnit > 0);
      setQty(groups.length ? Math.max(1, groupQty) : q);
      // Grand total is NOT FOB. Use real per-group FOB when the AI found it; the old grand÷qty
      // guess only remains as a fallback for quotations with no groups at all.
      setFob(groupsHaveFob ? groupFobSum / Math.max(1, groupQty) : groups.length ? 0 : grand > 0 ? grand / q : 0);
      if (x.terms.delivery) {
        const nums = x.terms.delivery.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
        if (nums.length) setSchedule((v) => ({ ...v, supplyMin: nums[0], supplyMax: nums[1] || nums[0] }));
      }
      const warranty = x.terms.warranty.match(/\d+(?:\.\d+)?/);
      if (warranty) setSchedule((v) => ({ ...v, warrantyMonths: Number(warranty[0]) }));
      setAiFields(res.reviewFields as AIField[]);
      const usedName = res.providerUsed === "gemini" ? "Gemini" : "OpenAI";
      toast.success(`تم تحليل الكوتيشن بواسطة ${usedName}${res.modelUsed ? ` (${res.modelUsed})` : ""}${res.providerUsed && res.providerUsed !== aiProvider ? ` — تحوّل تلقائياً لأن ${aiProvider === "gemini" ? "Gemini" : "OpenAI"} فشل` : ""}`);
      setStep(1);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "فشل تحليل المستند");
      setStep(1);
    } finally { setExtracting(false); }
  }

  function updateAIField(key: string, value: string) {
    setAiFields((fields) => fields.map((f) => f.key === key ? { ...f, value, confidence: f.confidence === "review" ? "medium" : f.confidence } : f));
  }

  function updateExtractionItem(id: string, patch: Partial<UniversalQuotationExtraction["items"][number]>) {
    setExtraction((current) => current ? { ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) } : current);
  }

  function updateDynamicTableCell(tableId: string, rowId: string, key: string, value: string) {
    setExtraction((current) => current ? { ...current, dynamicTables: current.dynamicTables.map((table) => table.id === tableId ? { ...table, rows: table.rows.map((row) => row.id === rowId ? { ...row, cells: row.cells.map((cell) => cell.key === key ? { ...cell, value } : cell) } : row) } : table) } : current);
  }

  async function generate() {
    if (pricingMode === "manual" && sellingOverride <= 0) {
      toast.error("أدخل سعر البيع اليدوي أولاً");
      return;
    }
    if (projectMode === "new" && !newProject.name.trim() && !newProject.nameAr.trim()) {
      toast.error("أدخل اسم المشروع أولاً");
      return;
    }
    if (!confirmed) {
      toast.error("المراجعة الإلزامية: أكّد البيانات أولاً");
      return;
    }
    setGenerating(true);
    try {
      let pid = projectId;
      if (projectMode === "new") {
        const clientName = newProject.clientName.trim();
        const existingClient = store.clients.find((c) => (c.nameAr || c.name).trim().toLowerCase() === clientName.toLowerCase());
        const clientId = existingClient
          ? existingClient.id
          : store.addClient({ name: clientName, nameAr: clientName, type: "client", city: "", contact: "", position: "", phone: "", email: "" });
        pid = store.addProject({
          name: newProject.name || newProject.nameAr,
          nameAr: newProject.nameAr || newProject.name,
          clientId,
          location: newProject.location,
          division: newProject.division,
          manager: salesManager,
          status: "active",
          contractValue: pricing.selling,
        });
      }
      const project = useAppStore.getState().projects.find((p) => p.id === pid);
      const client = store.clients.find((c) => c.id === project?.clientId);
      if (!project || !client) throw new Error("missing project");

      const proposalId = uid("pr");
      const now = new Date().toISOString();
      // Whatever the user last edited on the review screen wins: if a quotation was analyzed,
      // that means the (editable) extraction.generalSpecifications table; otherwise the manual
      // key/value rows in `specs`.
      const finalSpecs: SpecField[] = extraction ? extraction.generalSpecifications.map((s) => ({ key: s.key, label: s.key, value: s.value })) : specs;
      const normalizedUnits = units.length ? units.map((u) => ({ ...u, specs: finalSpecs })) : [{ id: uid("u"), code: "L1", description: "المجموعة الرئيسية", quantity: qty, specs: finalSpecs }];
      const supplierQuotation: SupplierQuotation = {
        id: uid("sq"),
        supplier,
        quoteNumber,
        currency: "USD",
        units: normalizedUnits.map((u) => u.id),
        activeRevision: 0,
        revisions: [{ id: uid("sqr"), revision: quoteRevision, quoteNumber, date: quoteDate, sourceName: quoteFileName || "Supplier quotation", status: "reviewed" }],
      };
      const proposal: Proposal = {
        id: proposalId,
        number: nextProposalNumber(store.proposals.map((p) => p.number)),
        revision: 0,
        projectId: pid,
        clientId: client.id,
        systemType,
        status: "sent",
        currency: "USD",
        validityDays: 30,
        date: new Date().toISOString().slice(0, 10),
        validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        owner: salesManager,
        quotationSource: "Supplier quotation",
        specs: finalSpecs,
        selectedSystemType: selectedSystemType !== "other" ? selectedSystemType : undefined,
        units: normalizedUnits,
        supplierQuotations: [supplierQuotation],
        notes,
        fob: fobTotal,
        costLines,
        sellingPrice: pricing.selling,
        payment,
        schedule,
        files: [],
        extraction: extraction ?? undefined,
        createdAt: now,
        updatedAt: now,
      };

      const generated = await generateAll(proposal, project, client);
      proposal.files = [
        { kind: "docx", name: generated.docx, generatedAt: now },
        { kind: "xlsx", name: generated.xlsx, generatedAt: now },
      ];
      store.addProposal(proposal);
      toast.success("تم إنشاء العرض وتوليد الملفات");
      nav({ to: "/proposals/$proposalId", params: { proposalId } });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? `تعذر توليد الملفات: ${e.message}` : "تعذر توليد الملفات");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Toaster position="top-center" dir="rtl" />
      <div className="overflow-hidden rounded-[20px] border border-line bg-surface shadow-sm">
        <div className="bg-navy px-5 py-4 text-accent-fg md:px-6">
          <h1 className="text-xl font-semibold tracking-tight">إنشاء عرض جديد</h1>
          <p className="mt-0.5 text-xs text-white/60">حلّل كوتيشن المورد، راجع البيانات، ثم حوّلها إلى عرض جاهز للتوليد.</p>
        </div>
        <ol className="grid grid-cols-3 border-t border-line bg-paper">
          {steps.map((s, i) => (
            <li key={s} className={`relative flex items-center justify-center gap-2 px-3 py-2.5 text-xs ${i === step ? "bg-surface font-semibold text-navy" : i < step ? "text-accent" : "text-muted"}`}>
              <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] ${i === step ? "bg-navy text-white" : i < step ? "bg-accent text-white" : "bg-line text-muted"}`}>{i + 1}</span>
              {s}
              {i === step ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" /> : null}
            </li>
          ))}
        </ol>
      </div>

      {step === 0 ? (
        <section className="space-y-3 rounded-[20px] border border-line bg-surface p-4">
          <div className="rounded-[14px] border border-dashed border-accent/40 bg-accent/5 p-3.5">
            <BlockHeader
              icon={<span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-[11px] font-semibold text-white">AI</span>}
              title="ارفع كوتيشن المورد"
              hint="يستخرج AI المشروع والمواصفات والأسعار تلقائياً. اترك نوع النظام «غير محدد» ليحدده من محتوى الكوتيشن."
              aside={<span dir="ltr" className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-accent">PDF · XLSX · DOCX · TXT</span>}
            />
            <div className="mt-3 grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_14rem_9rem_auto]">
              <Field label="ملف الكوتيشن">
                <Input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.doc,.docx,.txt"
                  className="cursor-pointer p-0 pe-3 file:me-3 file:h-full file:cursor-pointer file:border-0 file:bg-paper file:px-3 file:text-xs file:font-medium file:text-ink"
                  onChange={(e) => { const f = e.target.files?.[0] ?? null; setQuoteFile(f); setQuoteFileName(f?.name ?? ""); }}
                />
              </Field>
              <Field label="نوع النظام">
                <select className={selectCls} value={selectedSystemType} onChange={(e) => setSelectedSystemType(e.target.value as SystemType)}>
                  {(["other","elevators","chiller","hvac","vrf","bms","escalators","smoke"] as SystemType[]).map((t) => <option key={t} value={t}>{t === "other" ? "غير محدد (يحدده AI)" : systemLabel[t].ar}</option>)}
                </select>
              </Field>
              <Field label="نموذج الاستخراج">
                <select className={selectCls} value={aiProvider} onChange={(e) => setAiProvider(e.target.value as "openai" | "gemini")} disabled={extracting}>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini</option>
                </select>
              </Field>
              <Button className="w-full md:w-auto" disabled={!quoteFileName || extracting} onClick={() => void runExtract()}>
                {extracting ? "جارٍ فهم الكوتيشن…" : "تحليل الكوتيشن"}
              </Button>
            </div>
          </div>

          {systemTypeMismatch ? (
            <div className="rounded-[14px] border border-amber-400 bg-amber-50 px-3.5 py-3 text-amber-900">
              <div className="text-sm font-semibold">⚠ تعارض في نوع النظام</div>
              <p className="mt-0.5 text-xs leading-5">
                اخترت <b>{systemLabel[selectedSystemType].ar}</b>، لكن AI حلّل محتوى الكوتيشن ورأى أنه على الأغلب <b>{systemLabel[detectedSystemType as SystemType].ar}</b>.
                راجع الملف قبل المتابعة — القرار النهائي بيدك.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedSystemType(detectedSystemType as SystemType)}>اعتماد رأي AI ({systemLabel[detectedSystemType as SystemType].ar})</Button>
                <Button size="sm" variant="ghost" onClick={() => setDetectedSystemType(selectedSystemType)}>الإبقاء على اختياري</Button>
              </div>
            </div>
          ) : null}
          {filenameHint ? (
            <div className="rounded-[14px] border border-line bg-paper px-3.5 py-2 text-xs text-muted">
              اسم الملف يوحي بنوع «{systemLabel[filenameHint].ar}»، لكن AI اعتمد على محتوى المستند وليس اسمه. راجع النتيجة إذا كنت غير متأكد.
            </div>
          ) : null}

          <div className="rounded-[14px] border border-line bg-paper p-3.5">
            <BlockHeader
              title="المشروع والعميل"
              hint="يقترح AI الاسم والموقع بعد التحليل، ويمكنك تعديلهما."
              aside={
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant={projectMode === "new" ? "navy" : "outline"} onClick={() => setProjectMode("new")}>مشروع جديد</Button>
                  <Button size="sm" variant={projectMode === "existing" ? "navy" : "outline"} onClick={() => setProjectMode("existing")}>مشروع موجود</Button>
                </div>
              }
            />
            <div className="mt-3">
              {projectMode === "existing" ? (
                <div className="max-w-md">
                  <Field label="اختر المشروع">
                    <select className={selectCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                      {store.projects.map((p) => <option key={p.id} value={p.id}>{p.nameAr} — {p.name}</option>)}
                    </select>
                  </Field>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="اسم المشروع"><Input value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="يُعبّأ من AI إن وُجد" /></Field>
                  <Field label="الموقع"><Input value={newProject.location} onChange={(e) => setNewProject({ ...newProject, location: e.target.value })} placeholder="يُعبّأ من AI إن وُجد" /></Field>
                  <Field label="اسم العميل / الجهة"><Input value={newProject.clientName} onChange={(e) => setNewProject({ ...newProject, clientName: e.target.value })} placeholder="يُعبّأ من AI إن وُجد" /></Field>
                </div>
              )}
            </div>
          </div>

          {selectedSystemType === "elevators" ? (
            <div className="space-y-3 rounded-[16px] border border-line bg-paper p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">مجموعات المصاعد</h2>
                  <p className="mt-1 text-xs text-muted">أضف مجموعة لكل جزء يُخدم بمصاعد منفصلة (L1 للطوابق السفلية، L2 للعلوية...). الكمية وFOB لكل مجموعة.</p>
                </div>
                <Button size="sm" variant="outline" onClick={addUnit}>+ إضافة مجموعة</Button>
              </div>
              <div className="space-y-2">
                {units.map((u) => (
                  <div key={u.id} className="space-y-1">
                    <div className="grid items-end gap-2 md:grid-cols-[100px_1fr_110px_150px_auto]">
                      <Field label="الرمز"><Input value={u.code} onChange={(e) => updateUnit(u.id, { code: e.target.value })} /></Field>
                      <Field label="الوصف"><Input value={u.description} onChange={(e) => updateUnit(u.id, { description: e.target.value })} /></Field>
                      <Field label="العدد"><Input type="number" value={u.quantity} onChange={(e) => updateUnit(u.id, { quantity: Math.max(1, Number(e.target.value) || 1) })} /></Field>
                      <Field label="FOB للوحدة"><Input type="number" value={u.fobUnit ?? ""} placeholder="غير محدد" onChange={(e) => updateUnit(u.id, { fobUnit: Number(e.target.value) > 0 ? Number(e.target.value) : undefined, fobSource: "explicit_fob" })} /></Field>
                      <Button size="sm" variant="ghost" disabled={units.length <= 1} onClick={() => removeUnit(u.id)}>حذف</Button>
                    </div>
                    {u.fobSource === "unlabeled_price" ? <p className="text-[11px] text-amber-700">السعر لم يُذكر صراحة أنه FOB في الكوتيشن — تأكد منه قبل الاعتماد.</p> : null}
                    {!(u.fobUnit && u.fobUnit > 0) ? <p className="text-[11px] text-muted">لم يجد الذكاء الاصطناعي FOB لهذه المجموعة — أدخله هنا أو في ملف Excel.</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <details className="rounded-[14px] border border-line bg-paper px-3.5 py-2.5">
            <summary className="cursor-pointer text-sm font-semibold">إدارة قوالب Word و Excel <span className="text-xs font-normal text-muted">— إضافة قالب لنظام جديد أو استبدال قالب قديم</span></summary>
            <div className="mt-3"><TemplateManager /></div>
          </details>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-5 rounded-[20px] border border-line bg-surface p-4">
          {aiFields.length > 0 ? (
            <div className="space-y-4 rounded-[18px] border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><span className="rounded-full bg-navy px-2.5 py-1 text-xs text-accent-fg">AI REVIEW</span><h2 className="font-semibold">نتيجة تحليل الكوتيشن</h2></div>
                  <p className="mt-1 text-xs text-muted">يمكن تعديل أي قيمة قبل الاعتماد.</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={reviewFilter === "all" ? "navy" : "outline"} onClick={() => setReviewFilter("all")}>الكل ({aiFields.length})</Button>
                  <Button size="sm" variant={reviewFilter === "review" ? "navy" : "outline"} onClick={() => setReviewFilter("review")}>يحتاج مراجعة ({aiFields.filter((f) => f.confidence === "review").length})</Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {aiFields.filter((f) => reviewFilter === "all" || f.confidence === "review").map((f) => (
                  <div key={f.key} className="rounded-[14px] border border-line bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold">{f.label}</label>
                      <span className={`text-[11px] ${f.confidence === "high" ? "text-accent" : f.confidence === "medium" ? "text-muted" : "text-red-600"}`}>
                        {f.confidence === "high" ? "ثقة عالية" : f.confidence === "medium" ? "ثقة متوسطة" : "يحتاج مراجعة"}
                      </span>
                    </div>
                    <Input value={f.value} onChange={(e) => updateAIField(f.key, e.target.value)} />
                    <div className="mt-1 text-[11px] text-muted">المصدر: {f.source}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-surface p-3 text-xs">
                <span>✓ {aiFields.filter((f) => f.confidence === "high").length} حقول بثقة عالية · {aiFields.filter((f) => f.confidence !== "high").length} تحتاج انتباه</span>
                <span className="text-muted">لا يتم اعتماد البيانات تلقائيًا.</span>
              </div>
            </div>
          ) : null}
          {extraction ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                <div><h2 className="font-semibold">بيانات الكوتيشن المستخرجة</h2><p className="mt-1 text-xs text-muted">يمكن تعديل أي عنصر قبل التوليد.</p></div>
                <span className="rounded-full bg-paper px-3 py-1 text-[11px] text-muted">{extraction.systemLabel || extraction.systemType}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="نوع النظام"><Input value={extraction.systemLabel || extraction.systemType} onChange={(e) => setExtraction({ ...extraction, systemLabel: e.target.value })} /></Field>
                <Field label="المشروع"><Input value={extraction.project.name} onChange={(e) => setExtraction({ ...extraction, project: { ...extraction.project, name: e.target.value } })} /></Field>
                <Field label="المورد"><Input value={extraction.supplier} onChange={(e) => setExtraction({ ...extraction, supplier: e.target.value })} /></Field>
                <Field label="الإجمالي"><Input type="number" value={extraction.commercial.grandTotal} onChange={(e) => setExtraction({ ...extraction, commercial: { ...extraction.commercial, grandTotal: Number(e.target.value) } })} /></Field>
              </div>
              {extraction.dynamicTables.length ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><h3 className="font-semibold">جداول الكوتيشن</h3></div>
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent">{extraction.dynamicTables.length} جدول</span>
                  </div>
                  {extraction.dynamicTables.map((table) => (
                    <div key={table.id} className="overflow-x-auto rounded-[16px] border border-line">
                      <div className="border-b border-line bg-paper px-4 py-3">
                        <div className="font-semibold">{table.title}</div>
                        {table.description ? <div className="mt-1 text-xs text-muted">{table.description}</div> : null}
                        {table.sourceSection ? <div className="mt-1 text-[11px] text-muted">المصدر: {table.sourceSection}</div> : null}
                      </div>
                      <table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-line bg-surface text-right text-xs text-muted">
                        {table.columns.map((column) => <th key={column.key} className="p-2">{column.label}</th>)}
                      </tr></thead><tbody>
                        {table.rows.map((row) => <tr key={row.id} className="border-b border-line align-top">
                          {table.columns.map((column) => { const cell = row.cells.find((c) => c.key === column.key); return <td key={column.key} className="p-2"><Input type={column.type === "number" || column.type === "currency" ? "number" : "text"} value={cell?.value ?? ""} onChange={(e) => updateDynamicTableCell(table.id, row.id, column.key, e.target.value)} /></td>; })}
                        </tr>)}
                      </tbody></table>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="space-y-2">
                <div><h3 className="font-semibold">بنود التسعير</h3></div>
                <div className="overflow-x-auto rounded-[16px] border border-line">
                  <table className="w-full min-w-[980px] text-sm"><thead><tr className="border-b border-line bg-paper text-right text-xs text-muted"><th className="p-2">الموقع</th><th className="p-2">التصنيف</th><th className="p-2">الوصف</th><th className="p-2">الكمية</th><th className="p-2">الوحدة</th><th className="p-2">سعر الوحدة</th><th className="p-2">الإجمالي</th></tr></thead><tbody>
                    {extraction.items.map((item) => <tr key={item.id} className="border-b border-line align-top"><td className="p-2"><Input value={item.location} onChange={(e) => updateExtractionItem(item.id, { location: e.target.value })} /></td><td className="p-2"><Input value={item.category} onChange={(e) => updateExtractionItem(item.id, { category: e.target.value })} /></td><td className="p-2"><Input value={item.description} onChange={(e) => updateExtractionItem(item.id, { description: e.target.value })} /></td><td className="p-2"><Input type="number" value={item.quantity} onChange={(e) => updateExtractionItem(item.id, { quantity: Number(e.target.value) })} /></td><td className="p-2"><Input value={item.unit} onChange={(e) => updateExtractionItem(item.id, { unit: e.target.value })} /></td><td className="p-2"><Input type="number" value={item.unitPrice} onChange={(e) => updateExtractionItem(item.id, { unitPrice: Number(e.target.value), total: Number(e.target.value) * item.quantity })} /></td><td className="p-2"><Input type="number" value={item.total} onChange={(e) => updateExtractionItem(item.id, { total: Number(e.target.value) })} /></td></tr>)}
                  </tbody></table>
                </div>
              </div>
              {extraction.generalSpecifications.length ? <div className="grid gap-3 md:grid-cols-2">{extraction.generalSpecifications.map((sp, i) => <Field key={`${sp.key}-${i}`} label={sp.key}><Input value={sp.value} onChange={(e) => setExtraction({ ...extraction, generalSpecifications: extraction.generalSpecifications.map((v,j) => j === i ? { ...v, value: e.target.value } : v) })} /></Field>)}</div> : null}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                <div><h2 className="font-semibold">المواصفات الفنية</h2><p className="mt-1 text-xs text-muted">أضف أي مواصفة تريدها — لا يوجد قالب حقول ثابت لأي نظام، حتى المصاعد.</p></div>
                <Button size="sm" variant="outline" onClick={() => setSpecs([...specs, { key: `spec_${specs.length + 1}`, label: "", value: "" }])}>+ إضافة مواصفة</Button>
              </div>
              {specs.length === 0 ? <div className="rounded-[12px] border border-dashed border-line p-4 text-center text-xs text-muted">لا توجد مواصفات بعد. ارفع كوتيشن ليقوم AI باستخراجها تلقائياً، أو أضفها يدوياً.</div> : null}
              <div className="grid gap-3 md:grid-cols-2">
                {specs.map((sp, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <Field label="اسم المواصفة"><Input value={sp.label} onChange={(e) => setSpecs(specs.map((v, j) => j === i ? { ...v, label: e.target.value, key: e.target.value || v.key } : v))} /></Field>
                    <Field label="القيمة"><Input value={sp.value} onChange={(e) => setSpecs(specs.map((v, j) => j === i ? { ...v, value: e.target.value } : v))} /></Field>
                    <Button size="sm" variant="ghost" onClick={() => setSpecs(specs.filter((_, j) => j !== i))}>حذف</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="font-semibold">التسعير المرن</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="سعر/قيمة الوحدة (USD)"><Input type="number" readOnly={groupFobMode} value={groupFobMode ? Math.round(fobTotal / Math.max(1, effectiveQty)) : fob} onChange={(e) => setFob(Number(e.target.value))} /></Field>
            <Field label="الكمية">
              {units.length > 1
                ? <Input readOnly value={effectiveQty} />
                : <Input type="number" value={qty} onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); setQty(v); if (units.length === 1) updateUnit(units[0].id, { quantity: v }); }} />}
            </Field>
            <Field label="إجمالي FOB"><Input readOnly value={fobTotal} /></Field>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-right text-xs text-muted">
                  <th className="py-2">البند</th>
                  <th>النوع</th>
                  <th>القيمة</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {costLines.map((line) => {
                  const amount = pricing.lineAmounts.find((a) => a.id === line.id)?.amount ?? 0;
                  return (
                    <tr key={line.id} className="border-b border-line">
                      <td className="py-2">{line.labelAr}</td>
                      <td>
                        <select
                          className="h-9 rounded-[8px] border border-line px-2"
                          value={line.mode}
                          onChange={(e) => setCostLines(costLines.map((l) => l.id === line.id ? { ...l, mode: e.target.value as CostLine["mode"] } : l))}
                        >
                          <option value="fixed">مبلغ</option>
                          <option value="percent">نسبة %</option>
                        </select>
                      </td>
                      <td>
                        <Input type="number" value={line.value} onChange={(e) => setCostLines(costLines.map((l) => l.id === line.id ? { ...l, value: Number(e.target.value) } : l))} />
                      </td>
                      <td className="tabular-nums">{formatMoney(amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[16px] bg-paper p-3">
              <div className="text-xs text-muted">تكلفة التشغيل</div>
              <div className="text-lg font-medium tabular-nums">{formatMoney(pricing.operating)}</div>
            </div>
            <Field label="طريقة تحديد سعر البيع">
              <select className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm" value={pricingMode} onChange={(e) => setPricingMode(e.target.value as "calculated" | "manual")}>
                <option value="calculated">محسوب من التكلفة</option>
                <option value="manual">إدخال يدوي</option>
              </select>
            </Field>
            <Field label={pricingMode === "manual" ? "سعر البيع النهائي يدويًا" : "سعر البيع النهائي (اضغط واكتب للتعديل)"}>
              <Input type="number" inputMode="decimal" min={0} className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value={pricingMode === "manual" ? sellingOverride : (sellingOverride || pricing.selling)} onChange={(e) => setSellingOverride(Number(e.target.value))} />
            </Field>
            <div className="rounded-[16px] bg-navy p-3 text-accent-fg">
              <div className="text-xs opacity-80">الربح التقديري</div>
              <div className="text-lg font-medium tabular-nums">{formatMoney((sellingOverride || pricing.selling) - pricing.operating)}</div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="دفعة مقدمة %"><Input type="number" value={payment.advance} onChange={(e) => setPayment({ ...payment, advance: Number(e.target.value) })} /></Field>
            <Field label="قبل الشحن %"><Input type="number" value={payment.shipping} onChange={(e) => setPayment({ ...payment, shipping: Number(e.target.value) })} /></Field>
            <Field label="عند التسليم %"><Input type="number" value={payment.handover} onChange={(e) => setPayment({ ...payment, handover: Number(e.target.value) })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            أكّدت مراجعة المواصفات والتسعير، وأسمح بتوليد الملفين.
          </label>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>رجوع للكوتيشن</Button>
            <Button disabled={!confirmed} onClick={() => setStep(2)}>إلى التوليد</Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-[20px] border border-line bg-surface p-4">
          <p className="text-sm">سيتم توليد ملفين من بيانات العرض التي راجعتها واعتمدتها، بالاعتماد على قوالب FAAT المعتمدة وليس بتأليف حر:</p>
          <ul className="list-disc pr-5 text-sm text-muted">
            <li>عرض Word فني ومالي — يُملأ داخل القالب المعتمد (Master Template)</li>
            <li>Excel داخلي للتسعير — للمصاعد والسلالم والممرات المتحركة يُملأ داخل ملف CCS الأصلي (الكمية وFOB لكل مجموعة فقط، والمعادلات كما هي)، وغير ذلك يُبنى ديناميكياً من بيانات الكوتيشن</li>
          </ul>
          <div className="rounded-[16px] bg-paper p-4 text-sm">
            <div>القيمة التعاقدية: <b className="tabular-nums">{formatMoney(sellingOverride || pricing.selling)}</b></div>
            <div>تكلفة داخلية: <span className="tabular-nums">{formatMoney(fobTotal)}</span></div>
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>رجوع للمراجعة</Button>
            <Button disabled={generating} onClick={() => void generate()}>{generating ? "جار التوليد…" : "تأكيد وتوليد الملفات"}</Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
