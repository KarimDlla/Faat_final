import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { scanDocxTemplate } from "@/lib/docx-template";
import { systemLabel } from "@/lib/labels";
import { getTokenCatalog, knownItemFieldSet, knownTokenSet } from "@/lib/template-catalog";
import { defaultTemplateInfo, excelSlotType, TEMPLATE_SYSTEM_TYPES, templateModeFor, type TemplateKind } from "@/lib/template-defaults";
import { templateStore, type TemplateMode, type TemplateRecord } from "@/lib/template-registry";
import type { SystemType } from "@/lib/types";
import { parseCellMap, scanXlsxTemplate, type CellMapEntry } from "@/lib/xlsx-fill";
import { validateCcsWorkbook } from "@/lib/ccs-workbook";

const MAX_BYTES = 15 * 1024 * 1024;

type Pending = {
  systemType: SystemType;
  kind: TemplateKind;
  mode: TemplateMode;
  fileName: string;
  data: ArrayBuffer;
  cellMap: CellMapEntry[];
  mapFileName?: string;
  /** Anything here stops the template from being saved. */
  blocking: string[];
  warnings: string[];
  knownTokens: string[];
  unknownTokens: string[];
  specLabels: string[];
  knownItemFields: string[];
  unknownItemFields: string[];
  hasItemsRow: boolean;
};

async function analyze(systemType: SystemType, kind: TemplateKind, fileName: string, data: ArrayBuffer, cellMap: CellMapEntry[], mapErrors: string[], mapFileName?: string): Promise<Pending> {
  const mode = templateModeFor(systemType, kind);
  const base: Pending = { systemType, kind, mode, fileName, data, cellMap, mapFileName, blocking: [...mapErrors], warnings: [], knownTokens: [], unknownTokens: [], specLabels: [], knownItemFields: [], unknownItemFields: [], hasItemsRow: false };

  if (mode === "ccs") {
    const v = await validateCcsWorkbook(data);
    if (!v.ok) base.blocking.push(v.error ?? `هذا ليس ملف CCS: الأوراق التالية مفقودة — ${v.missing.join("، ")}`);
    else base.warnings.push("سيُستخدم كبديل لملف CCS: يفترض النظام أن خلايا الإدخال (الكمية D12 وسعر FOB E12 في أوراق التكلفة) في نفس أماكنها. إذا غيّرت التخطيط فلن تُكتب البيانات في المكان الصحيح.");
    return base;
  }

  let scan: { ok: boolean; error?: string; tokens: string[]; specLabels: string[]; itemFields: string[]; hasItemsRow: boolean };
  let mapped = 0;
  if (kind === "docx") scan = await scanDocxTemplate(data);
  else {
    const x = await scanXlsxTemplate(data, cellMap);
    scan = x; mapped = x.mapEntries;
    if (x.ok) base.blocking.push(...x.mapProblems);
  }
  if (!scan.ok) { base.blocking.push(scan.error ?? "ملف غير صالح"); return base; }

  const known = knownTokenSet(kind), knownFields = knownItemFieldSet(kind);
  base.knownTokens = scan.tokens.filter((t) => known.has(t));
  base.unknownTokens = scan.tokens.filter((t) => !known.has(t));
  base.specLabels = scan.specLabels;
  base.knownItemFields = scan.itemFields.filter((f) => knownFields.has(f));
  base.unknownItemFields = scan.itemFields.filter((f) => !knownFields.has(f));
  base.hasItemsRow = scan.hasItemsRow;

  const total = scan.tokens.length + scan.specLabels.length + scan.itemFields.length;
  if (total === 0 && mapped === 0) base.warnings.push("لم يُعثر على أي توكن ({{...}}) في الملف. سيخرج الملف الناتج مطابقاً للقالب بدون أي بيانات.");
  if (scan.itemFields.length && !scan.hasItemsRow) base.warnings.push("استخدمت {{items.حقل}} لكن لا يوجد صف يحتوي {{ITEMS_ROW}}، فلن تتكرر البنود.");
  if (kind === "xlsx" && scan.hasItemsRow) base.warnings.push("لا يُدرج النظام صفوفاً جديدة في Excel حتى لا تتزحزح المعادلات. اترك صفوفاً فارغة تحت صف البنود؛ ما لا يتسع منها يُبلَّغ عنه ولا يُحذف بصمت.");
  return base;
}

const fmtDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(); };
const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "ok" | "warn" }) {
  const cls = tone === "ok" ? "bg-accent/10 text-accent" : tone === "warn" ? "bg-amber-100 text-amber-900" : "bg-paper text-muted";
  return <span dir="ltr" className={`inline-block rounded-md px-1.5 py-0.5 font-mono text-[10px] ${cls}`}>{children}</span>;
}

export function TemplateManager() {
  const [records, setRecords] = useState<TemplateRecord[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string | null>(null);

  const refresh = useCallback(async () => { try { setRecords(await templateStore.list()); } catch { /* storage unavailable */ } }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const catalog = useMemo(() => getTokenCatalog(), []);
  const slotRecords = (systemType: SystemType, kind: TemplateKind) => records.filter((r) => r.systemType === systemType && r.kind === kind).sort((a, b) => b.version - a.version);

  async function pick(systemType: SystemType, kind: TemplateKind, file: File | undefined) {
    if (!file) return;
    const ext = kind === "docx" ? ".docx" : ".xlsx";
    if (!file.name.toLowerCase().endsWith(ext)) return void toast.error(`الملف يجب أن يكون بصيغة ${ext}`);
    if (file.size > MAX_BYTES) return void toast.error("حجم الملف أكبر من 15MB");
    setBusy(true);
    try { setPending(await analyze(systemType, kind, file.name, await file.arrayBuffer(), [], [])); }
    catch { toast.error("تعذر قراءة الملف"); }
    finally { setBusy(false); }
  }

  async function attachMap(file: File | undefined) {
    if (!file || !pending) return;
    setBusy(true);
    try {
      const parsed = parseCellMap(await file.text());
      setPending(await analyze(pending.systemType, pending.kind, pending.fileName, pending.data, parsed.map, parsed.errors, file.name));
    } finally { setBusy(false); }
  }

  async function confirm() {
    if (!pending || pending.blocking.length) return;
    setBusy(true);
    try {
      const rec = await templateStore.save({
        systemType: excelSlotType(pending.systemType) === "elevators" && pending.kind === "xlsx" ? "elevators" : pending.systemType,
        kind: pending.kind, mode: pending.mode, fileName: pending.fileName, data: pending.data,
        tokensFound: [...pending.knownTokens, ...pending.unknownTokens, ...pending.specLabels.map((l) => `SPEC:${l}`)],
        cellMap: pending.cellMap.length ? pending.cellMap : undefined,
      });
      toast.success(`تم اعتماد القالب (الإصدار ${rec.version}) — سيُستخدم في التوليد القادم`);
      setPending(null);
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر حفظ القالب"); }
    finally { setBusy(false); }
  }

  async function act(fn: () => Promise<void>, okMsg?: string) {
    setBusy(true);
    try { await fn(); await refresh(); if (okMsg) toast.success(okMsg); } catch { toast.error("تعذرت العملية"); } finally { setBusy(false); }
  }

  function download(rec: TemplateRecord) {
    const url = URL.createObjectURL(new Blob([rec.data]));
    const a = document.createElement("a");
    a.href = url; a.download = rec.fileName; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function Slot({ systemType, kind }: { systemType: SystemType; kind: TemplateKind }) {
    const slotType = kind === "xlsx" ? excelSlotType(systemType) : systemType;
    const recs = slotRecords(slotType, kind);
    const active = recs.find((r) => r.active) ?? null;
    const def = defaultTemplateInfo(systemType, kind);
    const key = `${slotType}:${kind}`;
    const accept = kind === "docx" ? ".docx" : ".xlsx";
    return (
      <div className="rounded-[12px] border border-line bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold">{kind === "docx" ? "Word" : "Excel"}</div>
          {active ? <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">مخصص · v{active.version}</span> : <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] text-muted">افتراضي</span>}
        </div>
        <div className="mt-1 truncate text-[11px] text-muted" dir="ltr" title={active?.fileName ?? def.label}>{active?.fileName ?? def.label}</div>
        {active ? <div className="text-[10px] text-muted">{fmtDate(active.uploadedAt)} · {fmtSize(active.size)}{active.cellMap ? ` · ربط خلايا (${active.cellMap.length})` : ""}</div> : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <label className={`inline-flex h-8 cursor-pointer items-center rounded-[10px] bg-navy px-3 text-xs font-medium text-accent-fg hover:opacity-90 ${busy ? "pointer-events-none opacity-50" : ""}`}>
            {active ? "استبدال" : "رفع قالب"}
            <input type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pick(systemType, kind, f); }} />
          </label>
          {active ? <Button size="sm" variant="outline" onClick={() => download(active)}>تنزيل</Button> : def.path ? <a className="inline-flex h-8 items-center rounded-[10px] border border-line bg-surface px-3 text-xs hover:bg-paper" href={encodeURI(def.path)} download>تنزيل الافتراضي</a> : null}
          {active ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(() => templateStore.useDefault(slotType, kind), "عُدنا إلى القالب الافتراضي")}>رجوع للافتراضي</Button> : null}
          {recs.length ? <Button size="sm" variant="ghost" onClick={() => setHistory(history === key ? null : key)}>الإصدارات ({recs.length})</Button> : null}
        </div>
        {history === key ? (
          <ul className="mt-2 space-y-1 border-t border-line pt-2">
            {recs.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-[11px]">
                <span className="font-medium">v{r.version}</span>
                <span className="min-w-0 flex-1 truncate text-muted" dir="ltr">{r.fileName}</span>
                <span className="text-muted">{fmtDate(r.uploadedAt)}</span>
                {r.active ? <span className="text-accent">فعّال</span> : <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(() => templateStore.activate(r.id), `تم تفعيل الإصدار ${r.version}`)}>تفعيل</Button>}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => { if (window.confirm(`حذف الإصدار ${r.version} نهائياً؟`)) void act(() => templateStore.remove(r.id)); }}>حذف</Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-5 text-muted">
        القوالب تُحفظ في هذا المتصفح فقط (لا تُشارك بين الأجهزة أو المستخدمين). عند عدم رفع قالب يُستخدم القالب الافتراضي المرفق مع النظام.
        لا حاجة لأي برمجة: اكتب في القالب أسماء الحقول بين {"{{ }}"} (انظر قائمة الحقول أدناه) وارفعه.
      </p>

      {pending ? (
        <div className="rounded-[14px] border-2 border-accent/40 bg-accent/5 p-4 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            فحص القالب قبل الاعتماد <Chip>{pending.fileName}</Chip>
            <span className="text-muted font-normal">← {systemLabel[pending.systemType].ar} / {pending.kind === "docx" ? "Word" : "Excel"}</span>
          </div>

          {pending.blocking.length ? (
            <ul className="mt-3 space-y-1 rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">
              {pending.blocking.map((m, i) => <li key={i}>⛔ {m}</li>)}
            </ul>
          ) : null}

          {pending.mode === "tokens" && !pending.blocking.some((b) => b.includes("ليس ملف")) ? (
            <div className="mt-3 space-y-2">
              <div><span className="font-medium">حقول معروفة ({pending.knownTokens.length}):</span> <span className="inline-flex flex-wrap gap-1 align-middle">{pending.knownTokens.map((t) => <Chip key={t} tone="ok">{t}</Chip>)}{pending.knownTokens.length === 0 ? <span className="text-muted">—</span> : null}</span></div>
              {pending.specLabels.length ? <div><span className="font-medium">حقول مواصفات بالاسم ({pending.specLabels.length}):</span> <span className="inline-flex flex-wrap gap-1 align-middle">{pending.specLabels.map((t) => <Chip key={t}>SPEC:{t}</Chip>)}</span> <span className="text-muted">— تُطابَق بالاسم مع مواصفات الكوتيشن وقت التوليد؛ ما لا يوجد يظهر "—" مع تنبيه.</span></div> : null}
              {pending.knownItemFields.length || pending.hasItemsRow ? <div><span className="font-medium">جدول بنود متكرر:</span> {pending.hasItemsRow ? "✅ صف {{ITEMS_ROW}} موجود" : "⚠ لا يوجد صف {{ITEMS_ROW}}"} <span className="inline-flex flex-wrap gap-1 align-middle">{pending.knownItemFields.map((t) => <Chip key={t} tone="ok">items.{t}</Chip>)}</span></div> : null}
              {pending.unknownTokens.length || pending.unknownItemFields.length ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                  <div className="font-medium">⚠ حقول غير معروفة — ستظهر "—" في الملف الناتج مع تنبيه:</div>
                  <div className="mt-1 flex flex-wrap gap-1">{pending.unknownTokens.map((t) => <Chip key={t} tone="warn">{t}</Chip>)}{pending.unknownItemFields.map((t) => <Chip key={`i${t}`} tone="warn">items.{t}</Chip>)}</div>
                  <div className="mt-1">غالباً خطأ إملائي. للمواصفات الفنية استخدم الصيغة العامة <Chip>{"{{SPEC:اسم المواصفة}}"}</Chip>.</div>
                </div>
              ) : null}
            </div>
          ) : null}

          {pending.warnings.map((w, i) => <div key={i} className="mt-2 rounded-lg bg-surface p-2 text-muted">ℹ {w}</div>)}

          {pending.kind === "xlsx" && pending.mode === "tokens" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex h-8 cursor-pointer items-center rounded-[10px] border border-line bg-surface px-3 text-xs hover:bg-paper">
                إرفاق ملف ربط خلايا (JSON) — اختياري
                <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void attachMap(f); }} />
              </label>
              <span className="text-muted">{pending.mapFileName ? `${pending.mapFileName} (${pending.cellMap.length} خلية)` : "للخلايا التي فيها رقم جاهز ولا تحمل توكن"}</span>
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Button size="sm" disabled={busy || pending.blocking.length > 0} onClick={() => void confirm()}>اعتماد القالب</Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>إلغاء</Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {TEMPLATE_SYSTEM_TYPES.map((t) => (
          <div key={t} className="rounded-[14px] border border-line bg-paper p-3">
            <div className="mb-2 text-sm font-semibold">{systemLabel[t].ar}</div>
            <div className="grid gap-3 md:grid-cols-2">
              {Slot({ systemType: t, kind: "docx" })}
              {t === "escalators"
                ? <div className="rounded-[12px] border border-dashed border-line p-3 text-[11px] leading-5 text-muted">ملف Excel للسلالم الكهربائية هو نفسه ملف CCS الخاص بالمصاعد (مجموعات E1/E2 في نفس المصنف). يُدار من بطاقة "مصاعد".</div>
                : Slot({ systemType: t, kind: "xlsx" })}
            </div>
          </div>
        ))}
      </div>

      <details className="rounded-[14px] border border-line bg-paper p-3 text-xs">
        <summary className="cursor-pointer text-sm font-semibold">قائمة الحقول المتاحة للقوالب</summary>
        <div className="mt-3 space-y-3 leading-5">
          <div><div className="font-medium">حقول عامة (Word وExcel، كل الأنظمة)</div><div className="mt-1 flex flex-wrap gap-1">{catalog.common.map((t) => <Chip key={t}>{`{{${t}}}`}</Chip>)}</div></div>
          <div><div className="font-medium">حقول المصاعد (قالب المصاعد)</div><div className="mt-1 flex flex-wrap gap-1">{catalog.elevator.map((t) => <Chip key={t}>{`{{${t}}}`}</Chip>)}</div></div>
          <div><div className="font-medium">إضافية لـ Excel فقط (أرقام حقيقية تدخل المعادلات)</div><div className="mt-1 flex flex-wrap gap-1">{catalog.excelOnly.map((t) => <Chip key={t}>{`{{${t}}}`}</Chip>)}</div></div>
          <div><div className="font-medium">مواصفات فنية بالاسم — لأي نظام (تشيلر، VRF، ...)</div><div className="mt-1">اكتب <Chip>{"{{SPEC:سعة التبريد}}"}</Chip> أو <Chip>{"{{SPEC:Capacity}}"}</Chip>؛ يُطابَق مع اسم المواصفة كما وردت في الكوتيشن (تطابق تام أولاً ثم احتواء).</div></div>
          <div>
            <div className="font-medium">جدول بنود يتكرر</div>
            <div className="mt-1">ضع <Chip>{"{{ITEMS_ROW}}"}</Chip> في أي خلية من صف الجدول، وفي نفس الصف حقول <Chip>{"{{items.حقل}}"}</Chip>. حقول Word (بدون أسعار المورد): {catalog.wordItemFields.map((f) => <Chip key={f}>{f}</Chip>)} · المصاعد: {catalog.elevatorItemFields.map((f) => <Chip key={f}>{f}</Chip>)} · Excel: {catalog.excelItemFields.map((f) => <Chip key={f}>{f}</Chip>)}</div>
          </div>
          <div><div className="font-medium">ملف ربط الخلايا (Excel، اختياري)</div><pre dir="ltr" className="mt-1 overflow-x-auto rounded-lg bg-surface p-2 text-[10px]">{`[
  { "sheet": "Cost", "cell": "D12", "source": "TOTAL_QTY_NUM" },
  { "sheet": "Cost", "cell": "B20", "source": "items.description", "repeat": "down", "max": 30 }
]`}</pre></div>
        </div>
      </details>
    </div>
  );
}
