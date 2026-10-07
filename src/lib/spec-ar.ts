// ---------------------------------------------------------------------------
// Arabic rendering of elevator finish / component descriptions (cabin + landing-hall tables).
//
// Supplier quotations are English ("Mirror etching hairline stainless steel"); FAAT's offer tables are Arabic.
// This is a deterministic glossary translation — the same input always gives the same wording, nothing is
// invented. Whatever the glossary does not know stays in its original English (never guessed) and is returned in
// `untranslated`, so the caller can show it to the user for a manual pass / glossary addition.
// To teach it a new term: add one [english, arabic] pair to GLOSSARY below. Nothing else needs to change.
// ---------------------------------------------------------------------------

const GLOSSARY: [string, string][] = [
  // finishes / materials
  ["mirror etching hairline stainless steel", "ستانليس ستيل هيرلاين مع حفر مرآتي"],
  ["mirror etched hairline stainless steel", "ستانليس ستيل هيرلاين مع حفر مرآتي"],
  ["mirror etching stainless steel", "ستانليس ستيل مرآتي محفور"],
  ["mirror etched stainless steel", "ستانليس ستيل مرآتي محفور"],
  ["etching hairline stainless steel", "ستانليس ستيل هيرلاين محفور"],
  ["mirror stainless steel", "ستانليس ستيل مرآتي"],
  ["hairline stainless steel", "ستانليس ستيل هيرلاين"],
  ["brushed stainless steel", "ستانليس ستيل مُفرَّش"],
  ["titanium gold stainless steel", "ستانليس ستيل ذهبي (تيتانيوم)"],
  ["stainless steel", "ستانليس ستيل"],
  ["mirror st/st frame", "إطار ستانليس ستيل مرآتي"],
  ["hairline st/st", "ستانليس ستيل هيرلاين"],
  ["st/st", "ستانليس ستيل"],
  ["acrylic light cover", "غطاء إضاءة من الأكريليك"],
  ["acrylic", "أكريليك"],
  ["extruded aluminium", "ألمنيوم مسحوب"],
  ["extruded aluminum", "ألمنيوم مسحوب"],
  ["aluminium", "ألمنيوم"],
  ["aluminum", "ألمنيوم"],
  ["powder coated steel", "فولاذ مطلي بالبودرة"],
  ["painted steel", "فولاذ مدهون"],
  ["tempered glass", "زجاج مقسّى"],
  ["marble", "رخام"],
  ["granite", "غرانيت"],
  ["rubber", "مطاط"],
  ["glass", "زجاج"],
  ["wood", "خشب"],
  // floors / landing wording
  ["ground floor and other floors", "الطابق الأرضي وبقية الطوابق"],
  ["ground floor", "الطابق الأرضي"],
  ["main floor", "الطابق الرئيسي"],
  ["other floors", "بقية الطوابق"],
  ["other floor", "بقية الطوابق"],
  ["all floors", "جميع الطوابق"],
  ["narrow jamb", "إطار ضيق"],
  ["wide jamb", "إطار عريض"],
  ["door frame", "إطار الباب"],
  ["jamb", "إطار"],
  ["collective type", "نوع تجميعي"],
  ["simplex type", "نوع Simplex"],
  ["duplex type", "نوع Duplex"],
  ["wall mounted type", "مركّب على الجدار"],
  ["wall mounted", "مركّب على الجدار"],
  // cabin accessories
  ["one handrail on the cabin rear wall", "مسكة يد واحدة على الجدار الخلفي للكبين"],
  ["one handrail on the cabin real wall", "مسكة يد واحدة على الجدار الخلفي للكبين"],   // "real" = common typo of "rear" in supplier files
  ["one handrail on the car rear wall", "مسكة يد واحدة على الجدار الخلفي للكبين"],
  ["one handrail", "مسكة يد واحدة"],
  ["handrail", "مسكة يد"],
  ["round type", "نوع دائري"],
  ["sharp logo", "شعار Sharp"],
  ["logo", "شعار"],
  ["lcd display", "شاشة LCD"],
  ["lcd", "شاشة LCD"],
  ["led lighting", "إضاءة LED"],
  ["led lights", "إضاءة LED"],
  ["led light", "إضاءة LED"],
  ["emergency lighting", "إضاءة طوارئ"],
  ["lighting", "إضاءة"],
  ["ventilation fan", "مروحة تهوية"],
  ["natural ventilation", "تهوية طبيعية"],
  ["ventilation", "تهوية"],
  ["fan", "مروحة"],
  ["braille", "بريل"],
  ["push button", "زر ضغط"],
  ["buttons", "أزرار"],
  ["button", "زر"],
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// spaces / hyphens in a glossary entry match any run of spaces or hyphens ("wall-mounted" = "wall mounted")
const toPattern = (en: string) => esc(en).replace(/(?:\\?[ \-])+/g, "[\\s\\-]+");
const COMPILED = [...GLOSSARY]
  .sort((a, b) => b[0].length - a[0].length)   // longest phrase first, so "hairline stainless steel" beats "stainless steel"
  .map(([en, ar]) => ({ re: new RegExp(`(?<![A-Za-z])${toPattern(en)}(?![A-Za-z])`, "gi"), ar }));

// Terms that are the same in the Arabic offer (brands, codes, units) — not reported as "untranslated".
const KEEP = /^(lcd|led|pvc|sharp|simplex|duplex|triplex|torin|monarch|ard|mm|kg|cop|lop|w|h|d|x|vvvf|st|ss)$/i;

export type ArabicSpec = { text: string; untranslated: string[] };

export function toArabicSpec(value: string): ArabicSpec {
  const raw = (value ?? "").trim();
  if (!raw || raw === "—") return { text: raw, untranslated: [] };
  if (/[\u0600-\u06FF]/.test(raw)) return { text: raw, untranslated: [] };   // already Arabic

  let out = raw;
  for (const { re, ar } of COMPILED) out = out.replace(re, ar);
  out = out
    .replace(/\s*;\s*/g, "؛ ")
    .replace(/\s*,\s*/g, "، ")
    .replace(/\s+[-–]\s+/g, "، ")
    .replace(/\(\s*/g, "(").replace(/\s*\)/g, ")")
    .replace(/\band\s+(?=[\u0600-\u06FF])/gi, "و")
    .replace(/\s{2,}/g, " ")
    .trim();

  const untranslated = [...new Set((out.match(/[A-Za-z][A-Za-z0-9+/\-]*/g) ?? []).filter((w) => !KEEP.test(w) && !/\d/.test(w)))];
  return { text: out, untranslated };
}
