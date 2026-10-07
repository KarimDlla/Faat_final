import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateAll } from "@/lib/documents";
import { statusLabel, systemLabel } from "@/lib/labels";
import { computePricing } from "@/lib/pricing";
import { useAppStore } from "@/lib/store";
import type { ProposalStatus } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

export const Route = createFileRoute("/_app/proposals/$proposalId")({ component: ProposalDetail });

function ProposalDetail() {
  const { proposalId } = Route.useParams();
  const nav = useNavigate();
  const proposal = useAppStore((s) => s.proposals.find((p) => p.id === proposalId));
  const project = useAppStore((s) => s.projects.find((p) => p.id === proposal?.projectId));
  const client = useAppStore((s) => s.clients.find((c) => c.id === proposal?.clientId));
  const setStatus = useAppStore((s) => s.setProposalStatus);
  const createRevision = useAppStore((s) => s.createRevision);
  const updateProposal = useAppStore((s) => s.updateProposal);
  if (!proposal || !project || !client) {
    return <div className="text-sm text-muted">العرض غير موجود. <Link to="/proposals" className="text-accent">العودة</Link></div>;
  }

  const current = proposal;
  const currentProject = project;
  const currentClient = client;
  const pricing = computePricing(current.fob, current.costLines, current.sellingPrice);

  async function regen() {
    try {
      const files = await generateAll(current, currentProject, currentClient);
      const now = new Date().toISOString();
      updateProposal(current.id, {
        files: [
          { kind: "docx", name: files.docx, generatedAt: now },
          { kind: "xlsx", name: files.xlsx, generatedAt: now },
        ],
      });
      toast.success("تم إعادة توليد الملفين");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? `تعذر التوليد: ${e.message}` : "تعذر التوليد");
    }
  }

  function revision() {
    const id = createRevision(current.id);
    if (id) nav({ to: "/proposals/$proposalId", params: { proposalId: id } });
  }

  return (
    <div className="space-y-5">
      <Toaster position="top-center" dir="rtl" />
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs text-muted">{proposal.number} {proposal.revision > 0 ? `· Rev ${proposal.revision}` : ""}</div>
          <h1 className="text-xl font-semibold">{project.nameAr}</h1>
          <p className="text-sm text-muted">{client.nameAr} · {project.location} · {systemLabel[proposal.systemType].ar}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={proposal.status} />
          <Button variant="outline" onClick={revision}>نسخة جديدة (Revision)</Button>
          <Button onClick={() => void regen()}>إعادة توليد الملفات</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[20px] border border-line bg-surface p-4">
          <div className="text-xs text-muted">القيمة التعاقدية</div>
          <div className="text-2xl font-medium tabular-nums">{formatMoney(proposal.sellingPrice, proposal.currency)}</div>
        </div>
        <div className="rounded-[20px] border border-line bg-surface p-4">
          <div className="text-xs text-muted">FOB</div>
          <div className="text-2xl font-medium tabular-nums">{formatMoney(proposal.fob, proposal.currency)}</div>
        </div>
        <div className="rounded-[20px] border border-line bg-surface p-4">
          <div className="text-xs text-muted">تكلفة التشغيل / الربح</div>
          <div className="text-2xl font-medium tabular-nums">{formatMoney(pricing.operating)} / {formatMoney(proposal.sellingPrice - pricing.operating)}</div>
        </div>
      </div>

      <section className="rounded-[20px] border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">الحالة</h2>
        <div className="flex flex-wrap gap-2">
          {(["draft", "review", "sent", "under_review", "accepted", "rejected"] as ProposalStatus[]).map((st) => (
            <Button key={st} size="sm" variant={current.status === st ? "navy" : "outline"} onClick={() => setStatus(current.id, st)}>
              {statusLabel[st]}
            </Button>
          ))}
        </div>
      </section>

      {proposal.units?.length ? (
        <section className="rounded-[20px] border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="text-sm font-semibold">مجموعات العرض</h2><p className="text-xs text-muted">كل مجموعة مستقلة ويمكن ربطها بكوتيشن المورد.</p></div><span className="text-xs text-muted">{proposal.units?.length ?? 1} مجموعات</span></div>
          <div className="space-y-2">
            {proposal.units.map((u) => (
              <div key={u.id} className="grid gap-3 rounded-[12px] bg-paper p-3 md:grid-cols-[90px_1fr_100px_1fr] md:items-center">
                <div className="font-semibold">{u.code}</div><div className="text-sm">{u.description}</div><div className="text-sm tabular-nums">{u.quantity} وحدة</div>
                <div className="text-xs text-muted">{u.specs.slice(0, 3).map((s) => `${s.label || s.key}: ${s.value}`).join(" · ") || "لا توجد مواصفات"}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="rounded-[20px] border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">البيانات التي فهمها AI</h2>
        <div className="mb-4 grid gap-2 md:grid-cols-3">
          <div className="rounded-xl bg-paper p-3"><div className="text-xs text-muted">نوع النظام</div><div className="font-medium">{proposal.extraction?.systemLabel || systemLabel[proposal.systemType].ar}</div></div>
          <div className="rounded-xl bg-paper p-3"><div className="text-xs text-muted">العناصر</div><div className="font-medium">{proposal.extraction?.items.length ?? 0}</div></div>
          <div className="rounded-xl bg-paper p-3"><div className="text-xs text-muted">الجداول الديناميكية</div><div className="font-medium">{proposal.extraction?.dynamicTables.length ?? 0}</div></div>
        </div>
        {proposal.extraction?.projectStructure.length ? <div className="mb-4 space-y-2">{proposal.extraction.projectStructure.map((section) => <div key={section.id} className="rounded-xl bg-paper p-3"><div className="font-medium">{section.title}</div><div className="text-xs text-muted mt-1">{section.summary}</div></div>)}</div> : null}
        {proposal.extraction?.dynamicTables.map((table) => (
          <div key={table.id} className="mb-4 overflow-x-auto rounded-xl border border-line">
            <div className="bg-paper px-3 py-2 font-medium">{table.title}</div>
            <table className="w-full min-w-[620px] text-xs"><thead><tr>{table.columns.map((c) => <th key={c.key} className="border-t border-line px-3 py-2 text-right font-medium">{c.label}</th>)}</tr></thead><tbody>{table.rows.map((row) => <tr key={row.id}>{table.columns.map((c) => <td key={c.key} className="border-t border-line px-3 py-2">{row.cells.find((cell) => cell.key === c.key)?.value ?? ""}</td>)}</tr>)}</tbody></table>
          </div>
        ))}
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">كوتيشن المورد</h2>
        {(proposal.supplierQuotations ?? []).map((q) => <div key={q.id} className="rounded-[12px] bg-paper p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">{q.supplier}</div>
            <div className="text-sm">{q.quoteNumber}</div>
            <div className="text-xs text-muted">Rev {q.activeRevision} · {q.revisions.length} نسخة</div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {(proposal.units ?? []).filter((u) => q.units.includes(u.id)).map((u) => (
              <div key={u.id} className="rounded-lg border border-line bg-surface px-3 py-2 text-xs">
                <div className="font-semibold">{u.code}</div>
                <div className="text-muted">{u.description}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>الحالة الحالية: {q.revisions[q.activeRevision]?.status ?? "—"}</span>
            <span>المصدر: {q.revisions[q.activeRevision]?.sourceName ?? "—"}</span>
          </div>
        </div>)}
        {(!proposal.supplierQuotations || proposal.supplierQuotations.length === 0) ? <p className="text-sm text-muted">لا يوجد كوتيشن مورد مسجل لهذا العرض القديم.</p> : null}
      </section>


      <section className="rounded-[20px] border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">الملفات المولَّدة</h2>
        {proposal.files.length === 0 ? (
          <p className="text-sm text-muted">لا توجد ملفات بعد. اضغط إعادة التوليد لتنزيل Word و Excel.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {proposal.files.map((f) => (
              <li key={f.kind} className="flex justify-between rounded-[12px] bg-paper px-3 py-2">
                <span>{f.name}</span>
                <span className="text-xs text-muted">{f.kind.toUpperCase()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {proposal.specs.length ? (
      <section className="rounded-[20px] border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">المواصفات</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {proposal.specs.map((s, i) => (
            <div key={`${s.key}-${i}`} className="flex justify-between gap-3 border-b border-line py-1 text-sm">
              <span className="text-muted">{s.label || s.key}</span>
              <span>{s.value || "—"}</span>
            </div>
          ))}
        </div>
      </section>
      ) : null}
    </div>
  );
}
