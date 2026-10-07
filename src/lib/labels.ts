import type { OpportunityStage, ProposalStatus, SystemType } from "./types";

export const systemLabel: Record<SystemType, { ar: string; en: string }> = {
  elevators: { ar: "مصاعد", en: "Elevators" },
  chiller: { ar: "تشيلر مركزي", en: "Chiller" },
  hvac: { ar: "تكييف", en: "HVAC" },
  vrf: { ar: "نظام VRF", en: "VRF" },
  bms: { ar: "إدارة المباني", en: "BMS" },
  smoke: { ar: "إطفاء ودخان", en: "Smoke Mgmt." },
  escalators: { ar: "سلالم كهربائية", en: "Escalators" },
  other: { ar: "نظام مخصص", en: "Custom System" },
};

export const statusLabel: Record<ProposalStatus, string> = {
  draft: "مسودة",
  review: "قيد المراجعة الداخلية",
  sent: "مرسل",
  under_review: "تحت مراجعة العميل",
  revision_required: "يحتاج تعديل",
  accepted: "مقبول",
  rejected: "مرفوض",
  expired: "منتهي",
  superseded: "نسخة سابقة",
};

export const stageLabel: Record<OpportunityStage, string> = {
  new: "جديد",
  estimating: "تقدير",
  proposal_sent: "عرض مرسل",
  negotiation: "تفاوض",
  awaiting_award: "بانتظار الترسية",
  awarded: "مترسّى",
  lost: "ضائع",
  on_hold: "معلّق",
};

