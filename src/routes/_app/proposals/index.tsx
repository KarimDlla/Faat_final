import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { systemLabel } from "@/lib/labels";
import { useAppStore } from "@/lib/store";
import { formatMoney } from "@/lib/utils";

export const Route = createFileRoute("/_app/proposals/")({ component: ProposalsPage });

function ProposalsPage() {
  const proposals = useAppStore((s) => s.proposals);
  const projects = useAppStore((s) => s.projects);
  const clients = useAppStore((s) => s.clients);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const rows = useMemo(() => {
    return proposals.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      const project = projects.find((x) => x.id === p.projectId);
      const client = clients.find((x) => x.id === p.clientId);
      const hay = `${p.number} ${project?.name} ${project?.nameAr} ${client?.name} ${client?.nameAr}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [proposals, projects, clients, q, filter]);

  const chips = [
    { id: "all", label: "الكل" },
    { id: "draft", label: "مسودة" },
    { id: "sent", label: "مرسل" },
    { id: "under_review", label: "تحت المراجعة" },
    { id: "accepted", label: "مقبول" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">العروض</h1>
          <p className="text-sm text-muted">ابدأ من عرض موجود أو أنشئ عرضاً جديداً من كوتيشن المورد.</p>
        </div>
        <Button asChild>
          <Link to="/proposals/new">
            <Plus className="size-4" /> عرض جديد
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-3 right-3 size-4 text-subtle" />
          <Input className="pr-10" placeholder="بحث برقم العرض أو المشروع أو العميل" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`h-9 rounded-full px-3 text-xs ${filter === c.id ? "bg-navy text-accent-fg" : "bg-surface border border-line"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
        <div className="hidden grid-cols-12 gap-2 border-b border-line bg-paper px-4 py-2 text-xs text-muted md:grid">
          <div className="col-span-2">رقم العرض</div>
          <div className="col-span-3">المشروع</div>
          <div className="col-span-2">العميل</div>
          <div className="col-span-1">النظام</div>
          <div className="col-span-2">القيمة</div>
          <div className="col-span-2">الحالة</div>
        </div>
        {rows.map((p) => {
          const project = projects.find((x) => x.id === p.projectId);
          const client = clients.find((x) => x.id === p.clientId);
          return (
            <Link
              key={p.id}
              to="/proposals/$proposalId"
              params={{ proposalId: p.id }}
              className="grid grid-cols-1 gap-1 border-b border-line px-4 py-3 last:border-0 hover:bg-paper md:grid-cols-12 md:items-center md:gap-2"
            >
              <div className="col-span-2 text-sm font-medium">
                {p.number}
                {p.revision > 0 ? <span className="mr-1 text-xs text-muted">Rev {p.revision}</span> : null}
              </div>
              <div className="col-span-3 text-sm">{project?.nameAr ?? project?.name}</div>
              <div className="col-span-2 text-sm text-muted">{client?.nameAr ?? client?.name}</div>
              <div className="col-span-1 text-xs">{systemLabel[p.systemType].ar}</div>
              <div className="col-span-2 text-sm tabular-nums">{formatMoney(p.sellingPrice, p.currency)}</div>
              <div className="col-span-2">
                <StatusBadge status={p.status} />
              </div>
            </Link>
          );
        })}
        {rows.length === 0 ? <div className="px-4 py-10 text-center text-sm text-muted">لا توجد عروض مطابقة.</div> : null}
      </div>
    </div>
  );
}
