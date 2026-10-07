import type * as React from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ProposalStatus, OpportunityStage } from "@/lib/types";

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "ok" | "warn" | "danger" | "navy" | "accent";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-paper text-muted",
    ok: "bg-[#e8f7ee] text-ok",
    warn: "bg-[#fef4e6] text-warn",
    danger: "bg-[#fdeaea] text-danger",
    navy: "bg-[#e8eef5] text-navy",
    accent: "bg-[#eaf3e2] text-accent",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: ProposalStatus }) {
  const map: Record<ProposalStatus, { tone: React.ComponentProps<typeof Badge>["tone"]; label: string }> = {
    draft: { tone: "neutral", label: "مسودة" },
    review: { tone: "navy", label: "مراجعة داخلية" },
    sent: { tone: "accent", label: "مرسل" },
    under_review: { tone: "warn", label: "تحت المراجعة" },
    revision_required: { tone: "warn", label: "يحتاج تعديل" },
    accepted: { tone: "ok", label: "مقبول" },
    rejected: { tone: "danger", label: "مرفوض" },
    expired: { tone: "neutral", label: "منتهي" },
    superseded: { tone: "neutral", label: "نسخة سابقة" },
  };
  const m = map[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function StageBadge({ stage }: { stage: OpportunityStage }) {
  const map: Record<OpportunityStage, { tone: React.ComponentProps<typeof Badge>["tone"]; label: string }> = {
    new: { tone: "neutral", label: "جديد" },
    estimating: { tone: "navy", label: "تقدير" },
    proposal_sent: { tone: "accent", label: "عرض مرسل" },
    negotiation: { tone: "warn", label: "تفاوض" },
    awaiting_award: { tone: "warn", label: "بانتظار الترسية" },
    awarded: { tone: "ok", label: "مترسّى" },
    lost: { tone: "danger", label: "ضائع" },
    on_hold: { tone: "neutral", label: "معلّق" },
  };
  const m = map[stage];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
