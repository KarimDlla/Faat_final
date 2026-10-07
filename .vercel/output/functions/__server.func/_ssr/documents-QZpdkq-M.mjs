import { i as __toESM } from "../_runtime.mjs";
import { n as formatMoney } from "./store-BmABQmXm.mjs";
import { r as systemLabel } from "./labels-DcR_-vm5.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as utils, r as writeSync, t as readSync } from "../_libs/xlsx.mjs";
import { t as require_lib } from "../_libs/jszip+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/documents-QZpdkq-M.js
var import_lib = /* @__PURE__ */ __toESM(require_lib());
var defaultCostLines = () => [
	{
		id: "freight",
		labelAr: "الشحن والجمارك",
		labelEn: "Freight & Customs",
		mode: "fixed",
		base: "none",
		value: 0
	},
	{
		id: "overhead",
		labelAr: "المصاريف الإدارية",
		labelEn: "Overhead",
		mode: "percent",
		base: "fob",
		value: 5
	},
	{
		id: "maintenance",
		labelAr: "احتياطي الصيانة المجانية",
		labelEn: "Free maintenance reserve",
		mode: "percent",
		base: "fob",
		value: 3.5
	},
	{
		id: "local",
		labelAr: "مواد محلية",
		labelEn: "Local materials",
		mode: "fixed",
		base: "none",
		value: 250
	},
	{
		id: "scaffold",
		labelAr: "سقالات",
		labelEn: "Scaffolding",
		mode: "fixed",
		base: "none",
		value: 400
	},
	{
		id: "install",
		labelAr: "التركيب المحلي",
		labelEn: "Local installation",
		mode: "fixed",
		base: "none",
		value: 0
	},
	{
		id: "design",
		labelAr: "دراسة وتصميم",
		labelEn: "Design & study",
		mode: "percent",
		base: "fob",
		value: 3
	},
	{
		id: "margin",
		labelAr: "هامش الربح",
		labelEn: "Margin",
		mode: "percent",
		base: "subtotal",
		value: 18
	}
];
function computePricing(fob, lines, sellingOverride) {
	const safeFob = Math.max(0, fob || 0);
	const beforeMargin = lines.filter((l) => l.id !== "margin");
	const margin = lines.find((l) => l.id === "margin");
	const lineAmounts = [];
	let operating = safeFob;
	for (const line of beforeMargin) {
		const amount = line.mode === "percent" ? (line.base === "fob" ? safeFob : operating) * (line.value || 0) / 100 : line.value || 0;
		lineAmounts.push({
			id: line.id,
			amount
		});
		operating += amount;
	}
	const marginAmount = margin ? margin.mode === "percent" ? operating * (margin.value || 0) / 100 : margin.value || 0 : 0;
	if (margin) lineAmounts.push({
		id: margin.id,
		amount: marginAmount
	});
	const computed = Math.round(operating + marginAmount);
	return {
		fob: safeFob,
		lineAmounts,
		operating: Math.round(operating),
		marginAmount: Math.round(marginAmount),
		selling: sellingOverride && sellingOverride > 0 ? Math.round(sellingOverride) : computed
	};
}
function escapeXml(value) {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function toRunXml(value) {
	return escapeXml(value).split("\n").join("</w:t></w:r><w:r><w:br/><w:t xml:space=\"preserve\">");
}
var TOKEN_RE = () => /\{\{\s*((?:SPEC:[^{}]+?)|[A-Z0-9_]+)\s*\}\}/g;
var ITEM_TOKEN_RE = () => /\{\{\s*items\.([a-zA-Z0-9_]+)\s*\}\}/g;
var WORD_PARTS_RE = /^word\/(document|header\d*|footer\d*)\.xml$/;
var normLabel = (v) => v.toLowerCase().replace(/[\s:：\-_/()،,.]+/g, "");
function lookupSpec(specs, label) {
	const want = normLabel(label);
	if (!want) return void 0;
	const filled = specs.filter((s) => s.value?.trim());
	const names = (s) => [s.label, s.key].filter((x) => !!x).map(normLabel);
	return (filled.find((s) => names(s).some((n) => n === want)) ?? filled.find((s) => names(s).some((n) => n.includes(want))))?.value.trim();
}
function mergeSplitTokens(xml) {
	return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) => {
		const nodeRe = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g;
		const nodes = [...para.matchAll(nodeRe)];
		if (nodes.length < 2) return para;
		const texts = nodes.map((n) => n[2]);
		const concat = texts.join("");
		if (!concat.includes("{{")) return para;
		let changed = false;
		for (const m of concat.matchAll(/\{\{[^{}]*\}\}/g)) {
			const s = m.index, e = s + m[0].length;
			const bounds = [0];
			for (const t of texts) bounds.push(bounds[bounds.length - 1] + t.length);
			let i = -1, j = -1;
			for (let k = 0; k < texts.length; k++) {
				if (i < 0 && bounds[k] <= s && s < bounds[k + 1]) i = k;
				if (j < 0 && bounds[k] < e && e <= bounds[k + 1]) j = k;
			}
			if (i < 0 || j < 0 || i === j) continue;
			const prefix = texts[i].slice(0, s - bounds[i]);
			const suffix = texts[j].slice(e - bounds[j]);
			texts[i] = prefix + m[0];
			for (let k = i + 1; k < j; k++) texts[k] = "";
			texts[j] = suffix;
			changed = true;
		}
		if (!changed) return para;
		let idx = 0;
		return para.replace(nodeRe, (_full, attrs, _t) => {
			const text = texts[idx++];
			const a = attrs ?? "";
			return `<w:t${/xml:space=/.test(a) ? a : `${a} xml:space="preserve"`}>${text}</w:t>`;
		});
	});
}
function findLastRowStart(xml, beforeIndex) {
	const re = /<w:tr[ >]/g;
	let m;
	let last = -1;
	while (m = re.exec(xml)) {
		if (m.index >= beforeIndex) break;
		last = m.index;
	}
	return last;
}
function expandItemsRow(xml, items) {
	const markerIdx = xml.indexOf("{{ITEMS_ROW}}");
	if (markerIdx === -1) return xml;
	const rowStart = findLastRowStart(xml, markerIdx);
	const closeIdx = xml.indexOf("</w:tr>", markerIdx);
	if (rowStart === -1 || closeIdx === -1) return xml;
	const rowEnd = closeIdx + 7;
	const rowTemplate = xml.slice(rowStart, rowEnd).replace("{{ITEMS_ROW}}", "");
	const rows = (items.length ? items : [{}]).map((item) => rowTemplate.replace(ITEM_TOKEN_RE(), (_m, key) => item[key] !== void 0 && item[key] !== "" ? toRunXml(String(item[key])) : "—"));
	return xml.slice(0, rowStart) + rows.join("") + xml.slice(rowEnd);
}
async function fillDocxTemplate(templateBuffer, tokens, items = [], specs = []) {
	const zip = await import_lib.default.loadAsync(templateBuffer);
	if (!zip.file("word/document.xml")) throw new Error("القالب غير صالح: word/document.xml غير موجود");
	const unfilled = /* @__PURE__ */ new Set();
	const resolve = (key) => key.startsWith("SPEC:") ? lookupSpec(specs, key.slice(5)) : tokens[key];
	for (const path of Object.keys(zip.files).filter((p) => WORD_PARTS_RE.test(p))) {
		let xml = await zip.file(path).async("text");
		xml = mergeSplitTokens(xml);
		xml = expandItemsRow(xml, items);
		xml = xml.replace(TOKEN_RE(), (match, key) => {
			const value = resolve(key.trim());
			return value !== void 0 ? toRunXml(value) : match;
		});
		xml = xml.replace(TOKEN_RE(), (_m, key) => {
			unfilled.add(key.trim());
			return "—";
		});
		xml = xml.replace(ITEM_TOKEN_RE(), (_m, key) => {
			unfilled.add(`items.${key}`);
			return "—";
		});
		zip.file(path, xml);
	}
	return {
		blob: await zip.generateAsync({
			type: "blob",
			mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		}),
		unfilledTokens: [...unfilled]
	};
}
async function scanDocxTemplate(buffer) {
	const empty = {
		tokens: [],
		specLabels: [],
		itemFields: [],
		hasItemsRow: false
	};
	let zip;
	try {
		zip = await import_lib.default.loadAsync(buffer);
	} catch {
		return {
			ok: false,
			error: "الملف ليس ملف Word (.docx) صالحاً",
			...empty
		};
	}
	if (!zip.file("word/document.xml")) return {
		ok: false,
		error: "الملف ليس ملف Word (.docx) صالحاً: word/document.xml غير موجود",
		...empty
	};
	const tokens = /* @__PURE__ */ new Set(), specs = /* @__PURE__ */ new Set(), fields = /* @__PURE__ */ new Set();
	let hasItemsRow = false;
	for (const path of Object.keys(zip.files).filter((p) => WORD_PARTS_RE.test(p))) {
		const xml = mergeSplitTokens(await zip.file(path).async("text"));
		if (xml.includes("{{ITEMS_ROW}}")) hasItemsRow = true;
		for (const m of xml.matchAll(TOKEN_RE())) {
			const k = m[1].trim();
			if (k === "ITEMS_ROW") continue;
			if (k.startsWith("SPEC:")) specs.add(k.slice(5).trim());
			else tokens.add(k);
		}
		for (const m of xml.matchAll(ITEM_TOKEN_RE())) fields.add(m[1]);
	}
	return {
		ok: true,
		tokens: [...tokens],
		specLabels: [...specs],
		itemFields: [...fields],
		hasItemsRow
	};
}
function findSpec(specs, pattern) {
	return specs.find((s) => pattern.test(s.label || s.key))?.value?.trim() || "";
}
function buildProposalTokens(proposal, project, client) {
	const specs = proposal.specs;
	const extraction = proposal.extraction;
	const generalSpecs = extraction?.generalSpecifications.map((s) => ({
		key: s.key,
		label: s.key,
		value: s.value
	})) ?? specs;
	const model = findSpec(generalSpecs, /model|موديل/i);
	const type = findSpec(generalSpecs, /type|نوع/i);
	const capacity = findSpec(generalSpecs, /capacity|حمولة|قدرة/i);
	const rating = findSpec(generalSpecs, /speed|rating|rated|سرعة|تصنيف/i);
	const control = findSpec(generalSpecs, /control|تحكم/i);
	const consumed = new Set([
		model,
		type,
		capacity,
		rating,
		control
	].filter(Boolean));
	const extraSpecText = generalSpecs.filter((s) => s.value && !consumed.has(s.value)).map((s) => `${s.label || s.key}: ${s.value}`).join("\n");
	const itemQty = extraction?.items.reduce((n, x) => n + Math.max(0, x.quantity), 0) || proposal.units?.reduce((n, u) => n + u.quantity, 0) || 0;
	const projectUnderstanding = `يتم إعداد العرض بناءً على متطلبات المشروع والوثائق المتاحة، مع مراعاة التنسيق الهندسي، التوريد، التركيب، الاختبارات والتشغيل والتسليم وفق نطاق الأعمال المعتمد.`;
	const proposedSolution = `تقديم حل ${systemLabel[proposal.systemType].en} متكامل وفق البيانات الفنية المستخرجة من كوتيشن المورد والمراجعة البشرية قبل الاعتماد.`;
	const scope = `• التوريد وفق المواصفات المعتمدة\n• التنسيق الهندسي والتركيب ضمن حدود العرض\n• الاختبارات والتشغيل والتسليم\n• الضمان والصيانة المجانية حسب الشروط المبينة`;
	const exclusions = `• أي أعمال أو مواد غير مذكورة صراحة في هذا العرض\n• الأعمال المدنية الرئيسية والتغذية الكهربائية العامة ما لم تُذكر ضمن نطاق العرض\n• أي تغيير بعد الاعتماد يخضع لتقييم وأمر تغيير منفصل`;
	const generalTerms = `تخضع الأسعار لصلاحية العرض ${proposal.validityDays} يوماً من تاريخ العرض. أي تعديل في النطاق أو المواصفات أو الكميات بعد الاعتماد قد يؤدي إلى تعديل القيمة والمدة. جميع البيانات المستخرجة من عروض الموردين تخضع للمراجعة والاعتماد قبل إصدار العرض النهائي.`;
	return {
		PROPOSAL_REF: `${proposal.number}${proposal.revision ? ` / Rev ${proposal.revision}` : ""}`,
		PROPOSAL_DATE: proposal.date,
		CLIENT_NAME: client.name || client.nameAr || "—",
		PROJECT_NAME: project.name || project.nameAr || "",
		PROJECT_LOCATION: project.location || "",
		SYSTEM_TYPE_EN: extraction?.systemLabel || systemLabel[proposal.systemType].en,
		SYSTEM_TYPE_AR: systemLabel[proposal.systemType].ar,
		COMPANY_PROFILE: `FAAT Engineering، بجذور تعود إلى عام 1968، هي مقاول إقليمي للأعمال الكهروميكانيكية يركز على الأنظمة الهندسية الموثوقة والتنفيذ المنضبط والأداء طويل الأمد. تقدم الشركة حلولاً متكاملة في المصاعد والسلالم الكهربائية، HVAC، وحدات معالجة الهواء الصحية، وأنظمة التهوية وإدارة الدخان، وتشمل خدماتها التصميم والتوريد والتركيب والتشغيل والتسليم والتحديث والدعم طوال دورة حياة النظام.`,
		PROJECT_UNDERSTANDING: projectUnderstanding,
		PROPOSED_SOLUTION: proposedSolution,
		SCOPE_OF_WORK: scope,
		TECHNICAL_SPECIFICATIONS: extraSpecText,
		MODEL: model || "—",
		TYPE: type || "—",
		CAPACITY: capacity || "—",
		RATING: rating || "—",
		CONTROL_SYSTEM: control || "—",
		COMMERCIAL_OFFER: "القيمة الإجمالية للعرض بالدولار الأمريكي، شاملة التوريد والتركيب والتشغيل وفق نطاق الأعمال أعلاه:",
		QUANTITY: String(itemQty || proposal.units?.reduce((n, u) => n + u.quantity, 0) || 1),
		CONTRACT_VALUE: formatMoney(proposal.sellingPrice, proposal.currency),
		ADDITIONAL_QTY: "",
		ADDITIONAL_VALUE: "",
		TOTAL_CONTRACT_VALUE: formatMoney(proposal.sellingPrice, proposal.currency),
		DELIVERY_SCHEDULE: `التوريد: ${proposal.schedule.supplyMin}–${proposal.schedule.supplyMax} أسبوع · التركيب: ${proposal.schedule.installMin}–${proposal.schedule.installMax} أسبوع · الاختبار والتشغيل: ${proposal.schedule.testMin}–${proposal.schedule.testMax} أسبوع`,
		PAYMENT_TERMS: `دفعة مقدمة ${proposal.payment.advance}% - عند الشحن ${proposal.payment.shipping}% - عند التسليم ${proposal.payment.handover}%`,
		WARRANTY_TERMS: extraction?.terms.warranty || `ضمان ${proposal.schedule.warrantyMonths} شهر، وصيانة مجانية ${proposal.schedule.freeMaintenanceMonths} شهر.`,
		EXCLUSIONS: exclusions,
		GENERAL_TERMS: generalTerms,
		AUTHORIZED_SIGNATORY: proposal.owner || ""
	};
}
var ARABIC_MONTHS = [
	"كانون الثاني",
	"شباط",
	"آذار",
	"نيسان",
	"أيار",
	"حزيران",
	"تموز",
	"آب",
	"أيلول",
	"تشرين الأول",
	"تشرين الثاني",
	"كانون الأول"
];
function arabicDate(isoDate) {
	const d = new Date(isoDate);
	if (isNaN(d.getTime())) return isoDate;
	return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
var ELEVATOR_SPEC_ALIASES = {
	ELV_NAME: [
		"اسم المصعد",
		"elevator name",
		"lift name",
		"product name"
	],
	ELV_MODEL: [
		"طراز المصعد",
		"طراز",
		"موديل",
		"elevator model",
		"lift model",
		"model no",
		"model"
	],
	ELV_TYPE: [
		"نوع المصعد",
		"elevator type",
		"lift type",
		"type of elevator",
		"usage",
		"application"
	],
	ELV_CAPACITY: [
		"الحمولة",
		"rated load",
		"load capacity",
		"capacity",
		"load"
	],
	ELV_PERSONS: [
		"عدد الأشخاص",
		"persons",
		"passengers",
		"people"
	],
	ELV_FLOORS_STOPS_OPENINGS: [
		"الطوابق/ المواقف",
		"الطوابق",
		"floors/stops/openings",
		"floors stops",
		"stops/doors",
		"floors",
		"stops",
		"landings"
	],
	ELV_SERVED_STOPS: [
		"أسماء المواقف",
		"served floors",
		"served stops",
		"floor names",
		"stop names",
		"floors served"
	],
	ELV_DOOR_DIM: [
		"أبعاد الباب",
		"door size",
		"door dimension",
		"door opening",
		"opening size",
		"clear opening",
		"door width"
	],
	ELV_LANDING_DOOR_DIRECTION: [
		"اتجاه الأبواب",
		"door opening direction",
		"door opening",
		"opening direction",
		"door direction",
		"opening mode",
		"door opening mode",
		"center opening",
		"side opening"
	],
	ELV_LANDING_DOOR_TYPE: [
		"نوع الأبواب الطابقية",
		"landing door type",
		"hall door type",
		"landing door material",
		"landing door"
	],
	ELV_SHAFT_CONSTRUCTION: [
		"إنشاء البئر",
		"shaft construction",
		"shaft structure",
		"hoistway construction",
		"hoistway structure",
		"shaft type"
	],
	ELV_SHAFT_DIM: [
		"أبعاد البئر",
		"shaft size",
		"shaft dimension",
		"hoistway size",
		"hoistway dimension",
		"shaft width",
		"shaft"
	],
	ELV_OVERHEAD: [
		"ارتفاع البئر",
		"overhead",
		"headroom",
		"top floor height",
		"top height"
	],
	ELV_PIT_DEPTH: [
		"عمق الحفرة",
		"pit depth",
		"pit"
	],
	ELV_TRAVEL: [
		"شوط الصاعدة",
		"travel height",
		"lifting height",
		"travel",
		"rise"
	],
	ELV_TOTAL_HEIGHT: [
		"الارتفاع الكلي",
		"total height",
		"overall height"
	],
	ELV_CAR_DIM: [
		"أبعاد الصاعدة",
		"car size",
		"car dimension",
		"cabin size",
		"cabin dimension",
		"car internal",
		"internal size"
	],
	ELV_MOTOR: [
		"المحرك",
		"traction machine",
		"motor",
		"machine type",
		"gearless",
		"machine"
	],
	ELV_MACHINE_ROOM: [
		"غرفة المحرك",
		"machine room",
		"machine-room",
		"mrl",
		"mr/mrl"
	],
	ELV_CONTROL_PANEL: [
		"لوحة التحكم",
		"control panel",
		"control cabinet",
		"controller",
		"vvvf",
		"control system"
	],
	ELV_OPERATION_SYSTEM: [
		"نظام التشغيل",
		"operation mode",
		"operation system",
		"control mode",
		"collective",
		"duplex",
		"simplex"
	],
	ELV_SPEED: [
		"السرعة",
		"rated speed",
		"speed",
		"velocity",
		"m/s"
	],
	CABIN_WALL_RIGHT: [
		"الجدار اليميني",
		"right wall",
		"right side wall",
		"side wall"
	],
	CABIN_WALL_LEFT: [
		"الجدار اليساري",
		"left wall",
		"left side wall",
		"side wall"
	],
	CABIN_WALL_REAR: [
		"الجدار الخلفي",
		"rear wall",
		"back wall"
	],
	CABIN_CEILING: [
		"سقف الصاعدة",
		"car ceiling",
		"cabin ceiling",
		"ceiling"
	],
	CABIN_FLOOR: [
		"أرضية الصاعدة",
		"car floor",
		"cabin floor",
		"floor finish",
		"flooring",
		"floor material"
	],
	CABIN_DOOR: [
		"باب الصاعدة",
		"car door",
		"cabin door"
	],
	CABIN_COP: [
		"لوحة الطلب الداخلية",
		"car operating panel",
		"cop"
	],
	CABIN_LIGHTING: [
		"الإضاءة",
		"lighting",
		"light"
	],
	CABIN_VENTILATION: [
		"التهوية",
		"ventilation",
		"fan"
	],
	CABIN_HANDRAIL: [
		"مسكة اليد",
		"handrail",
		"hand rail"
	],
	LANDING_GROUND_DOOR: [
		"باب الطابق الأرضي",
		"باب الطابق",
		"main landing door",
		"ground floor door",
		"main floor door"
	],
	LANDING_GROUND_FRAME: [
		"إطار الباب الأرضي",
		"main landing frame",
		"ground floor frame",
		"main floor frame"
	],
	LANDING_DOORS: [
		"الأبواب الطابقية",
		"other landing doors",
		"landing doors",
		"hall doors"
	],
	LANDING_FRAME: [
		"إطار الأبواب الطابقية",
		"landing door frame",
		"landing frame",
		"hall door frame"
	],
	LANDING_LOP: [
		"لوحة الطلب الطابقية",
		"landing operating panel",
		"hall call",
		"landing call",
		"hall button",
		"lop"
	]
};
var WALL_FALLBACK = [
	"car wall",
	"cabin wall",
	"wall panel",
	"walls",
	"جدار",
	"الجدران"
];
var PAYMENT_SPLIT = [
	.8,
	.15,
	.05
];
function buildElevatorTokens(proposal, project, client) {
	const extraction = proposal.extraction;
	const itemSpecs = extraction?.items.flatMap((it) => it.specifications.map((s) => ({
		key: s.key,
		label: s.key,
		value: s.value
	}))) ?? [];
	const unitSpecs = (proposal.units ?? []).flatMap((u) => (u.specs ?? []).map((s) => ({
		key: s.key,
		label: s.label || s.key,
		value: s.value
	})));
	const generalSpecs = [
		...extraction?.generalSpecifications.map((s) => ({
			key: s.key,
			label: s.key,
			value: s.value
		})) ?? proposal.specs,
		...itemSpecs,
		...unitSpecs
	].filter((s) => s.value?.trim());
	const used = /* @__PURE__ */ new Set();
	const missing = [];
	const names = (s) => [s.label, s.key].filter((x) => !!x).map(normLabel);
	const find = (aliases) => {
		for (const alias of aliases) {
			const a = normLabel(alias);
			if (!a) continue;
			const hit = generalSpecs.find((s) => !used.has(s) && names(s).some((n) => n === a)) ?? generalSpecs.find((s) => !used.has(s) && names(s).some((n) => n.includes(a)));
			if (hit) return hit;
		}
	};
	const pick = (token, extraAliases = []) => {
		const hit = find([...ELEVATOR_SPEC_ALIASES[token] ?? [], ...extraAliases]);
		if (!hit) {
			missing.push(token);
			return "—";
		}
		used.add(hit);
		return hit.value.trim();
	};
	const pickShared = (token) => {
		const own = find(ELEVATOR_SPEC_ALIASES[token] ?? []);
		if (own) {
			used.add(own);
			return own.value.trim();
		}
		const general = find(WALL_FALLBACK);
		if (general) return general.value.trim();
		missing.push(token);
		return "—";
	};
	const firstItem = extraction?.items[0];
	const units = proposal.units?.length ? proposal.units : [{
		id: "u1",
		code: "L1",
		description: "المجموعة الرئيسية",
		quantity: 1,
		specs: []
	}];
	const totalQty = units.reduce((n, u) => n + u.quantity, 0) || 1;
	const t = {};
	for (const k of [
		"ELV_LANDING_DOOR_TYPE",
		"ELV_DOOR_DIM",
		"ELV_LANDING_DOOR_DIRECTION",
		"ELV_SHAFT_CONSTRUCTION",
		"ELV_SHAFT_DIM",
		"ELV_OVERHEAD",
		"ELV_PIT_DEPTH",
		"ELV_TOTAL_HEIGHT",
		"ELV_TRAVEL",
		"ELV_CAR_DIM",
		"ELV_SERVED_STOPS",
		"ELV_FLOORS_STOPS_OPENINGS",
		"ELV_PERSONS",
		"ELV_CAPACITY",
		"ELV_MACHINE_ROOM",
		"ELV_MOTOR",
		"ELV_CONTROL_PANEL",
		"ELV_OPERATION_SYSTEM",
		"ELV_SPEED",
		"ELV_NAME",
		"ELV_TYPE",
		"ELV_MODEL",
		"CABIN_COP",
		"CABIN_DOOR",
		"CABIN_CEILING",
		"CABIN_FLOOR",
		"CABIN_LIGHTING",
		"CABIN_VENTILATION",
		"CABIN_HANDRAIL",
		"LANDING_GROUND_FRAME",
		"LANDING_GROUND_DOOR",
		"LANDING_FRAME",
		"LANDING_DOORS",
		"LANDING_LOP"
	]) t[k] = pick(k);
	for (const k of [
		"CABIN_WALL_RIGHT",
		"CABIN_WALL_LEFT",
		"CABIN_WALL_REAR"
	]) t[k] = pickShared(k);
	const fb = (token, value) => {
		if (t[token] === "—" && value) {
			t[token] = value;
			const i = missing.indexOf(token);
			if (i >= 0) missing.splice(i, 1);
		}
	};
	fb("ELV_NAME", firstItem?.description);
	fb("ELV_MODEL", firstItem?.code || firstItem?.description);
	fb("ELV_TYPE", firstItem?.category);
	const items = units.map((u) => {
		const unitSpecCapacity = u.specs.find((s) => ELEVATOR_SPEC_ALIASES.ELV_CAPACITY.some((a) => normLabel(s.label || s.key).includes(normLabel(a))))?.value;
		const unitSpecStops = u.specs.find((s) => ELEVATOR_SPEC_ALIASES.ELV_FLOORS_STOPS_OPENINGS.some((a) => normLabel(s.label || s.key).includes(normLabel(a))))?.value;
		const share = u.quantity / totalQty;
		return {
			name: u.code ? `${u.code} — ${u.description}` : u.description,
			capacity: unitSpecCapacity || t.ELV_CAPACITY || "—",
			stops: unitSpecStops || t.ELV_FLOORS_STOPS_OPENINGS || "—",
			qty: String(u.quantity),
			price: formatMoney(Math.round(proposal.sellingPrice * share), proposal.currency)
		};
	});
	const totalFormatted = formatMoney(proposal.sellingPrice, proposal.currency);
	return {
		tokens: {
			OFFER_NO: `${proposal.number}${proposal.revision ? ` / Rev ${proposal.revision}` : ""}`,
			PROPOSAL_DATE: proposal.date,
			PROPOSAL_DATE_AR: arabicDate(proposal.date),
			SIGN_CITY: "دمشق",
			PROJECT_NAME: project.name || project.nameAr || "",
			CLIENT_NAME: client.name || client.nameAr || "—",
			VALIDITY_DAYS: String(proposal.validityDays || ""),
			ELV_COUNT: String(totalQty),
			...t,
			INSTALL_DURATION: proposal.schedule ? `${proposal.schedule.installMin}–${proposal.schedule.installMax} أسبوع من تاريخ توريد التجهيزات إلى الموقع` : "",
			TOTAL_QTY: String(totalQty),
			TOTAL_PRICE: totalFormatted,
			TOTAL_PRICE_WORDS: totalFormatted,
			PAYMENT_1_AMOUNT: formatMoney(Math.round(proposal.sellingPrice * PAYMENT_SPLIT[0]), proposal.currency),
			PAYMENT_2_AMOUNT: formatMoney(Math.round(proposal.sellingPrice * PAYMENT_SPLIT[1]), proposal.currency),
			PAYMENT_3_AMOUNT: formatMoney(Math.round(proposal.sellingPrice * PAYMENT_SPLIT[2]), proposal.currency)
		},
		items,
		missing,
		unmatchedSpecs: generalSpecs.filter((s) => !used.has(s)).map((s) => `${s.label || s.key}: ${s.value}`)
	};
}
function isPlaceholderTemplate(wb) {
	return wb.SheetNames.some((name) => {
		const ws = wb.Sheets[name];
		return Object.keys(ws).some((addr) => addr[0] !== "!" && typeof ws[addr]?.v === "string" && /\{\{[A-Za-z0-9_.]+\}\}/.test(ws[addr].v));
	});
}
function fillXlsxTemplate(wb, tokens, items) {
	const unfilled = /* @__PURE__ */ new Set();
	for (const name of wb.SheetNames) {
		const ws = wb.Sheets[name];
		const ref = ws["!ref"] ? utils.decode_range(ws["!ref"]) : null;
		if (!ref) continue;
		let markerRow = null;
		for (let r = ref.s.r; r <= ref.e.r; r++) {
			const first = ws[utils.encode_cell({
				r,
				c: ref.s.c
			})];
			if (typeof first?.v === "string" && first.v.includes("{{ITEMS_ROW}}")) {
				markerRow = r;
				break;
			}
		}
		if (markerRow !== null && items.length) {
			const templateCells = {};
			for (let c = ref.s.c; c <= ref.e.c; c++) {
				const cell = ws[utils.encode_cell({
					r: markerRow,
					c
				})];
				if (typeof cell?.v === "string") templateCells[c] = cell.v;
			}
			items.forEach((item, i) => {
				const r = markerRow + i;
				for (const [cStr, template] of Object.entries(templateCells)) {
					const c = Number(cStr);
					const filled = template.replace("{{ITEMS_ROW}}", "").replace(/\{\{items\.([a-zA-Z0-9_]+)\}\}/g, (m, key) => item[key] !== void 0 ? String(item[key]) : "—");
					const isNumeric = /^-?\d+(\.\d+)?$/.test(filled);
					ws[utils.encode_cell({
						r,
						c
					})] = isNumeric ? {
						t: "n",
						v: Number(filled)
					} : {
						t: "s",
						v: filled
					};
				}
			});
			const newEnd = Math.max(ref.e.r, markerRow + items.length - 1);
			ws["!ref"] = utils.encode_range({
				s: ref.s,
				e: {
					r: newEnd,
					c: ref.e.c
				}
			});
		}
		for (const addr of Object.keys(ws)) {
			if (addr[0] === "!") continue;
			const cell = ws[addr];
			if (typeof cell?.v !== "string") continue;
			cell.v = cell.v.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key) => {
				if (tokens[key] === void 0) {
					unfilled.add(key);
					return "—";
				}
				return String(tokens[key]);
			});
			if (/^-?\d+(\.\d+)?$/.test(cell.v)) {
				cell.t = "n";
				cell.v = Number(cell.v);
			}
		}
	}
	return { unfilled: Array.from(unfilled) };
}
/** How many groups of each family the supplied workbook physically contains. */
var CCS_CAPACITY = {
	L: 5,
	E: 2,
	M: 2
};
var CCS_KIND_LABEL = {
	L: "Elevators",
	E: "Escalators",
	M: "Moving Walks"
};
function parseCcsCode(code) {
	const m = /^\s*([LEMlem])\s*[-_ ]?\s*(\d{1,3})\s*$/.exec(code ?? "");
	if (!m) return null;
	const index = Number(m[2]);
	if (index < 1) return null;
	return {
		kind: m[1].toUpperCase(),
		index
	};
}
var COST_SHEET = {
	L1: "L1",
	L2: "L2",
	L3: "L3",
	L4: "L4",
	L5: "L5 Cost",
	E1: "E1",
	E2: "E2",
	M1: "M1",
	M2: "M2"
};
var INFO_SHEET = {
	L1: "L1 Info",
	L2: "L2 Info",
	L3: "L3 Info",
	L4: "L4 Info",
	L5: "L5 Info"
};
var ROW_ORDER = [
	"L1",
	"L2",
	"L3",
	"L4",
	"L5",
	"E1",
	"E2",
	"M1",
	"M2"
];
var PROPOSED_BLOCK_START_ROWS = [
	8,
	21,
	34,
	50,
	63
];
var escXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function colToNum(col) {
	let n = 0;
	for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
	return n;
}
function splitAddr(addr) {
	const m = /^([A-Z]+)(\d+)$/.exec(addr);
	return {
		col: m[1],
		row: Number(m[2])
	};
}
function buildCell(addr, style, value) {
	const s = style ? ` s="${style}"` : "";
	if (typeof value === "number") return `<c r="${addr}"${s}><v>${Number.isFinite(value) ? value : 0}</v></c>`;
	return `<c r="${addr}"${s} t="inlineStr"><is><t xml:space="preserve">${escXml(value)}</t></is></c>`;
}
/** Write one INPUT cell (never a formula cell). Keeps the cell's existing style. */
function setCell(xml, addr, value, fallbackStyle = null) {
	const existing = new RegExp(`<c r="${addr}"(?:\\s[^>]*?)?(?:/>|>[\\s\\S]*?</c>)`).exec(xml);
	if (existing) {
		if (/<f[\s>/]/.test(existing[0])) throw new Error(`Refusing to overwrite formula cell ${addr}`);
		const style = /\ss="(\d+)"/.exec(existing[0].slice(0, existing[0].indexOf(">") + 1))?.[1] ?? fallbackStyle;
		return xml.replace(existing[0], buildCell(addr, style, value));
	}
	const { col, row } = splitAddr(addr);
	const newCell = buildCell(addr, fallbackStyle, value);
	const rowMatch = new RegExp(`<row r="${row}"(?:\\s[^>]*?)?(?:/>|>[\\s\\S]*?</row>)`).exec(xml);
	if (rowMatch) {
		const rowXml = rowMatch[0];
		if (rowXml.endsWith("/>")) return xml.replace(rowXml, rowXml.slice(0, -2) + `>${newCell}</row>`);
		const after = [...rowXml.matchAll(/<c r="([A-Z]+)\d+"/g)].find((c) => colToNum(c[1]) > colToNum(col));
		const patched = after ? rowXml.replace(new RegExp(`<c r="${after[1]}${row}"`), `${newCell}<c r="${after[1]}${row}"`) : rowXml.replace(/<\/row>$/, `${newCell}</row>`);
		return xml.replace(rowXml, patched);
	}
	const next = [...xml.matchAll(/<row r="(\d+)"/g)].find((r) => Number(r[1]) > row);
	const newRow = `<row r="${row}">${newCell}</row>`;
	if (next) return xml.replace(new RegExp(`<row r="${next[1]}"`), `${newRow}<row r="${next[1]}"`);
	return xml.replace("</sheetData>", `${newRow}</sheetData>`);
}
/** Drop cached results of formula cells so no stale number (e.g. the sample L1 total) is ever shown. */
function stripFormulaCaches(xml) {
	return xml.replace(/<c\b([^>]*?)(?<!\/)>([\s\S]*?)<\/c>/g, (full, attrs, inner) => {
		if (!/<f[\s>/]/.test(inner)) return full;
		return `<c${attrs.replace(/\st="[^"]*"/, "")}>${inner.replace(/<v>[\s\S]*?<\/v>/, "")}</c>`;
	});
}
async function readWorkbookParts(zip) {
	const wbXml = await zip.file("xl/workbook.xml").async("string");
	const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
	const rels = /* @__PURE__ */ new Map();
	for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
		const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
		const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
		if (id && target) rels.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
	}
	const out = {};
	for (const m of wbXml.matchAll(/<sheet\b[^>]*>/g)) {
		const name = /\bname="([^"]+)"/.exec(m[0])?.[1];
		const rid = /\br:id="([^"]+)"/.exec(m[0])?.[1];
		if (name && rid && rels.has(rid)) out[name.replace(/&amp;/g, "&")] = rels.get(rid);
	}
	return out;
}
/** Tell Excel to recalculate every formula itself when the file is opened. */
async function enableFullCalcOnLoad(zip) {
	const wbXml = await zip.file("xl/workbook.xml").async("string");
	const withCalc = /<calcPr\b[^>]*>/.test(wbXml) ? wbXml.replace(/<calcPr\b([^>]*?)\/?>/, (_m, a) => `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"/>`) : wbXml.replace("</workbook>", `<calcPr fullCalcOnLoad="1"/></workbook>`);
	zip.file("xl/workbook.xml", withCalc);
}
var positive = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
/**
* Fill the CCS workbook with the project's groups.
* Every one of the 9 cost sheets is written (qty + FOB), including the groups the project does NOT
* have (set to 0), so the sample numbers the template shipped with can never leak into a real file.
*/
async function fillCcsWorkbook(template, project, groups) {
	const zip = await import_lib.default.loadAsync(template);
	const sheetPaths = await readWorkbookParts(zip);
	const sheets = /* @__PURE__ */ new Map();
	for (const [name, path] of Object.entries(sheetPaths)) sheets.set(name, await zip.file(path).async("string"));
	const placedByCode = /* @__PURE__ */ new Map();
	const skipped = [];
	for (const g of groups) {
		const parsed = parseCcsCode(g.code);
		if (!parsed) {
			skipped.push({
				code: g.code,
				reason: "الرمز غير معروف — استخدم L1.. للمصاعد، E1.. للسلالم المتحركة، M1.. للممرات المتحركة"
			});
			continue;
		}
		const code = `${parsed.kind}${parsed.index}`;
		if (parsed.index > CCS_CAPACITY[parsed.kind]) {
			skipped.push({
				code,
				reason: `ملف CCS الحالي يحتوي ${CCS_CAPACITY[parsed.kind]} مجموعات فقط من نوع ${CCS_KIND_LABEL[parsed.kind]}`
			});
			continue;
		}
		if (placedByCode.has(code)) {
			skipped.push({
				code,
				reason: "الرمز مكرر — لا يمكن وضع مجموعتين في نفس الورقة"
			});
			continue;
		}
		placedByCode.set(code, g);
	}
	const edit = (sheetName, fn) => {
		const xml = sheets.get(sheetName);
		if (xml === void 0) throw new Error(`ورقة "${sheetName}" غير موجودة في ملف CCS`);
		sheets.set(sheetName, fn(xml));
	};
	const missingFob = [];
	for (const code of ROW_ORDER) {
		const g = placedByCode.get(code);
		const qty = g && positive(g.quantity) ? g.quantity : 0;
		const fob = g && positive(g.fobUnit) ? g.fobUnit : 0;
		if (g && qty > 0 && fob === 0) missingFob.push(code);
		edit(COST_SHEET[code], (xml) => {
			let x = setCell(xml, "D12", qty);
			x = setCell(x, "E12", fob);
			if (project.projectName) x = setCell(x, "C2", project.projectName);
			if (project.quoteNumber) x = setCell(x, "D6", project.quoteNumber);
			if (project.quoteDate) x = setCell(x, "D7", project.quoteDate);
			return x;
		});
		const info = INFO_SHEET[code];
		if (g && info && sheets.has(info)) edit(info, (xml) => {
			let x = xml;
			if (positive(g.technical?.totalHeightM)) x = setCell(x, "C8", g.technical.totalHeightM);
			if (positive(g.technical?.landingDoors)) x = setCell(x, "C9", g.technical.landingDoors);
			if (positive(g.technical?.tractionRopes)) x = setCell(x, "C13", g.technical.tractionRopes);
			if (qty > 0) x = setCell(x, "C33", qty);
			return x;
		});
	}
	edit("Proposed Price", (xml) => {
		let x = xml;
		if (project.projectName) x = setCell(x, "C2", project.projectName);
		ROW_ORDER.forEach((code, i) => {
			const g = placedByCode.get(code);
			const label = g?.description?.trim() ? `${code} — ${g.description.trim()}` : code;
			for (const start of PROPOSED_BLOCK_START_ROWS) x = setCell(x, `B${start + i}`, label);
		});
		return x;
	});
	if (project.projectName) edit("Discounted Price", (xml) => setCell(xml, "C2", project.projectName));
	for (const [name, path] of Object.entries(sheetPaths)) zip.file(path, stripFormulaCaches(sheets.get(name)));
	await enableFullCalcOnLoad(zip);
	return {
		blob: await zip.generateAsync({
			type: "blob",
			compression: "DEFLATE",
			mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		}),
		placed: [...placedByCode.keys()],
		skipped,
		missingFob
	};
}
/** Sheets that fillCcsWorkbook writes to. A replacement CCS workbook must contain all of them. */
async function validateCcsWorkbook(buffer) {
	try {
		const zip = await import_lib.default.loadAsync(buffer);
		if (!zip.file("xl/workbook.xml")) return {
			ok: false,
			missing: [],
			error: "الملف ليس مصنف Excel صالحاً (xl/workbook.xml غير موجود)"
		};
		const names = new Set(Object.keys(await readWorkbookParts(zip)));
		const missing = [
			...Object.values(COST_SHEET),
			"Proposed Price",
			"Discounted Price"
		].filter((n) => !names.has(n));
		return {
			ok: missing.length === 0,
			missing
		};
	} catch {
		return {
			ok: false,
			missing: [],
			error: "تعذر فتح الملف — تأكد أنه .xlsx سليم"
		};
	}
}
var XL_TOKEN_RE = () => /\{\{\s*((?:SPEC:[^{}]+?)|items\.[a-zA-Z0-9_]+|[A-Z0-9_]+)\s*\}\}/g;
var MARKER = "{{ITEMS_ROW}}";
var CELL_ADDR_RE = /^([A-Z]{1,3})([1-9]\d{0,6})$/;
var decodeXml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
async function readSharedStrings(zip) {
	const f = zip.file("xl/sharedStrings.xml");
	if (!f) return [];
	return [...(await f.async("string")).replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map((m) => [...(m[1] ?? "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeXml(t[1])).join(""));
}
function scanCells(xml, sst) {
	const out = [];
	for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
		const attrs = m[1], inner = m[2] ?? "";
		const addr = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
		if (!addr) continue;
		const a = /^([A-Z]+)(\d+)$/.exec(addr);
		const t = /\bt="([^"]*)"/.exec(attrs)?.[1];
		const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
		const hasFormula = /<f[\s>/]/.test(inner);
		let text = null;
		if (!hasFormula && t === "s" && v !== void 0) text = sst[Number(v)] ?? null;
		else if (!hasFormula && t === "inlineStr") text = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decodeXml(x[1])).join("");
		const hasValue = hasFormula || (text !== null ? text.trim() !== "" : v !== void 0 && v !== "");
		out.push({
			addr,
			col: a[1],
			row: Number(a[2]),
			style: /\bs="(\d+)"/.exec(attrs)?.[1] ?? null,
			hasFormula,
			hasValue,
			text
		});
	}
	return out;
}
var isPlaceholder = (c) => c.text !== null && c.text.includes("{{");
function typed(value) {
	if (typeof value === "number") return value;
	return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
}
function parseCellMap(jsonText) {
	let raw;
	try {
		raw = JSON.parse(jsonText);
	} catch {
		return {
			ok: false,
			map: [],
			errors: ["ملف الربط ليس JSON صالحاً"]
		};
	}
	const list = Array.isArray(raw) ? raw : raw?.cells;
	if (!Array.isArray(list)) return {
		ok: false,
		map: [],
		errors: ["ملف الربط يجب أن يكون قائمة، أو كائناً فيه الحقل cells"]
	};
	const map = [], errors = [];
	list.forEach((e, i) => {
		const o = e;
		const where = `الإدخال ${i + 1}`;
		if (!o || typeof o.sheet !== "string" || !o.sheet.trim()) return void errors.push(`${where}: sheet مفقود`);
		if (typeof o.cell !== "string" || !CELL_ADDR_RE.test(o.cell)) return void errors.push(`${where}: عنوان الخلية غير صالح (مثال: D12)`);
		if (typeof o.source !== "string" || !o.source.trim()) return void errors.push(`${where}: source مفقود`);
		if (o.repeat !== void 0 && o.repeat !== "down") return void errors.push(`${where}: repeat يقبل القيمة "down" فقط`);
		if (o.repeat === "down" && !o.source.startsWith("items.")) return void errors.push(`${where}: repeat يعمل مع مصادر items.* فقط`);
		if (o.max !== void 0 && (!Number.isInteger(o.max) || o.max < 1 || o.max > 500)) return void errors.push(`${where}: max يجب أن يكون بين 1 و500`);
		map.push({
			sheet: o.sheet.trim(),
			cell: o.cell,
			source: o.source.trim(),
			repeat: o.repeat,
			max: o.max
		});
	});
	return {
		ok: errors.length === 0,
		map,
		errors
	};
}
async function scanXlsxTemplate(buffer, cellMap = []) {
	const base = {
		tokens: [],
		specLabels: [],
		itemFields: [],
		hasItemsRow: false,
		placeholderCells: 0,
		mapEntries: cellMap.length,
		mapProblems: []
	};
	let zip;
	try {
		zip = await import_lib.default.loadAsync(buffer);
	} catch {
		return {
			ok: false,
			error: "الملف ليس ملف Excel (.xlsx) صالحاً",
			...base
		};
	}
	if (!zip.file("xl/workbook.xml")) return {
		ok: false,
		error: "الملف ليس ملف Excel (.xlsx) صالحاً: xl/workbook.xml غير موجود",
		...base
	};
	const sheetPaths = await readWorkbookParts(zip);
	const sst = await readSharedStrings(zip);
	const tokens = /* @__PURE__ */ new Set(), specs = /* @__PURE__ */ new Set(), fields = /* @__PURE__ */ new Set();
	let hasItemsRow = false, placeholderCells = 0;
	const addKey = (k) => {
		if (k === "ITEMS_ROW") return;
		if (k.startsWith("SPEC:")) specs.add(k.slice(5).trim());
		else if (k.startsWith("items.")) fields.add(k.slice(6));
		else tokens.add(k);
	};
	for (const path of Object.values(sheetPaths)) {
		const xml = await zip.file(path)?.async("string");
		if (!xml) continue;
		for (const c of scanCells(xml, sst).filter(isPlaceholder)) {
			placeholderCells++;
			if (c.text.includes(MARKER)) hasItemsRow = true;
			for (const m of c.text.matchAll(XL_TOKEN_RE())) addKey(m[1].trim());
		}
	}
	const mapProblems = [];
	for (const e of cellMap) {
		if (!(e.sheet in sheetPaths)) mapProblems.push(`الورقة "${e.sheet}" غير موجودة في الملف (الإدخال ${e.cell})`);
		addKey(e.source);
	}
	return {
		ok: true,
		tokens: [...tokens],
		specLabels: [...specs],
		itemFields: [...fields],
		hasItemsRow,
		placeholderCells,
		mapEntries: cellMap.length,
		mapProblems
	};
}
async function fillXlsxXml(templateBuffer, values, items, cellMap = [], specs = []) {
	const zip = await import_lib.default.loadAsync(templateBuffer);
	const sheetPaths = await readWorkbookParts(zip);
	const sst = await readSharedStrings(zip);
	const sheets = /* @__PURE__ */ new Map();
	for (const [name, path] of Object.entries(sheetPaths)) sheets.set(name, await zip.file(path).async("string"));
	const unfilled = /* @__PURE__ */ new Set();
	const skipped = [];
	let written = 0;
	const resolve = (key, item) => {
		if (key.startsWith("items.")) return item?.[key.slice(6)];
		if (key.startsWith("SPEC:")) return lookupSpec(specs, key.slice(5));
		return values[key];
	};
	const render = (text, item) => {
		const clean = text.replace(MARKER, "");
		const sole = /^\s*\{\{\s*((?:SPEC:[^{}]+?)|items\.[a-zA-Z0-9_]+|[A-Z0-9_]+)\s*\}\}\s*$/.exec(clean);
		if (sole) {
			const key = sole[1].trim();
			const v = resolve(key, item);
			if (v === void 0) {
				unfilled.add(key);
				return "—";
			}
			return v === "" ? "" : typed(v);
		}
		return clean.replace(XL_TOKEN_RE(), (_m, k) => {
			const v = resolve(k.trim(), item);
			if (v === void 0) {
				unfilled.add(k.trim());
				return "—";
			}
			return String(v);
		});
	};
	const put = (sheet, xml, addr, value, style) => {
		try {
			const out = setCell(xml, addr, value, style);
			written++;
			return out;
		} catch {
			skipped.push({
				where: `${sheet}!${addr}`,
				reason: "الخلية تحتوي معادلة — لا يتم الكتابة فوق المعادلات"
			});
			return xml;
		}
	};
	for (const [sheet, original] of sheets) {
		let xml = original;
		const cells = scanCells(xml, sst);
		const placeholders = cells.filter(isPlaceholder);
		const markerRow = placeholders.find((c) => c.text.includes(MARKER))?.row ?? null;
		for (const c of placeholders.filter((p) => p.row !== markerRow)) xml = put(sheet, xml, c.addr, render(c.text), c.style);
		if (markerRow !== null) {
			const tpl = placeholders.filter((c) => c.row === markerRow);
			const rows = items.length ? items : [void 0];
			for (let i = 0; i < rows.length; i++) {
				const r = markerRow + i;
				if (i > 0) {
					if (cells.some((c) => c.row === r && tpl.some((t) => t.col === c.col) && c.hasValue)) {
						skipped.push({
							where: `${sheet}!${r}`,
							reason: `لا توجد صفوف فارغة كافية تحت صف البنود — لم تُكتب ${rows.length - i} من ${rows.length} بنود. اترك صفوفاً فارغة أسفل الجدول.`
						});
						break;
					}
				}
				for (const t of tpl) {
					const v = rows[i] ? render(t.text, rows[i]) : t.text.replace(MARKER, "").trim() === "" ? "" : "—";
					if (i > 0 && v === "") continue;
					xml = put(sheet, xml, `${t.col}${r}`, v, t.style);
				}
			}
		}
		for (const e of cellMap.filter((m) => m.sheet === sheet)) {
			const a = CELL_ADDR_RE.exec(e.cell);
			if (e.repeat === "down") {
				const max = e.max ?? 100;
				const field = e.source.slice(6);
				items.slice(0, max).forEach((it, i) => {
					const v = it[field];
					if (v === void 0) {
						unfilled.add(e.source);
						return;
					}
					xml = put(sheet, xml, `${a[1]}${Number(a[2]) + i}`, typed(v), null);
				});
				if (items.length > max) skipped.push({
					where: `${sheet}!${e.cell}`,
					reason: `البنود ${items.length} أكثر من الحد ${max} في ملف الربط — لم تُكتب الزائدة`
				});
				continue;
			}
			const v = resolve(e.source);
			if (v === void 0) {
				unfilled.add(e.source);
				continue;
			}
			xml = put(sheet, xml, e.cell, typed(v), null);
		}
		sheets.set(sheet, xml);
	}
	for (const e of cellMap) if (!sheets.has(e.sheet)) skipped.push({
		where: `${e.sheet}!${e.cell}`,
		reason: "الورقة غير موجودة في الملف"
	});
	for (const [name, path] of Object.entries(sheetPaths)) zip.file(path, stripFormulaCaches(sheets.get(name)));
	await enableFullCalcOnLoad(zip);
	return {
		blob: await zip.generateAsync({
			type: "blob",
			compression: "DEFLATE",
			mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		}),
		written,
		unfilled: [...unfilled],
		skipped
	};
}
var DB_NAME = "faat-templates";
var STORE = "templates";
var available = () => typeof indexedDB !== "undefined";
function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			req.result.createObjectStore(STORE, { keyPath: "id" });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("تعذر فتح مخزن القوالب"));
	});
}
async function run(mode, fn) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, mode);
		const req = fn(tx.objectStore(STORE));
		let result;
		if (req) req.onsuccess = () => {
			result = req.result;
		};
		tx.oncomplete = () => {
			db.close();
			resolve(result);
		};
		tx.onerror = tx.onabort = () => {
			db.close();
			reject(tx.error ?? /* @__PURE__ */ new Error("فشلت عملية حفظ القالب"));
		};
	});
}
var all = async () => (await run("readonly", (s) => s.getAll()) ?? []).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
var put = (rec) => run("readwrite", (s) => {
	s.put(rec);
});
var del = (id) => run("readwrite", (s) => {
	s.delete(id);
});
var sameSlot = (a, b) => a.systemType === b.systemType && a.kind === b.kind;
/** The one place that decides where templates live. Swap this for a server-backed store later. */
var templateStore = {
	async list() {
		return available() ? all() : [];
	},
	async getActive(systemType, kind) {
		if (!available()) return null;
		return (await all()).find((r) => r.active && r.systemType === systemType && r.kind === kind) ?? null;
	},
	async save(input) {
		if (!available()) throw new Error("هذا المتصفح لا يدعم التخزين المحلي للقوالب (IndexedDB)");
		const existing = (await all()).filter((r) => sameSlot(r, input));
		const rec = {
			...input,
			id: `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
			version: Math.max(0, ...existing.map((r) => r.version)) + 1,
			uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
			size: input.data.byteLength,
			active: true
		};
		for (const r of existing.filter((x) => x.active)) await put({
			...r,
			active: false
		});
		await put(rec);
		const stale = [...existing].sort((a, b) => b.version - a.version).slice(4);
		for (const r of stale) await del(r.id);
		return rec;
	},
	async activate(id) {
		const rows = await all();
		const target = rows.find((r) => r.id === id);
		if (!target) return;
		for (const r of rows.filter((x) => sameSlot(x, target) && x.active && x.id !== id)) await put({
			...r,
			active: false
		});
		await put({
			...target,
			active: true
		});
	},
	async useDefault(systemType, kind) {
		for (const r of (await all()).filter((x) => x.active && x.systemType === systemType && x.kind === kind)) await put({
			...r,
			active: false
		});
	},
	async remove(id) {
		await del(id);
	}
};
/** Template-driven system types, in the order they are shown in the UI. */
var TEMPLATE_SYSTEM_TYPES = [
	"elevators",
	"escalators",
	"chiller",
	"hvac",
	"vrf",
	"bms",
	"smoke",
	"other"
];
var DEFAULT_WORD_TEMPLATE_PATH = "/templates/FAAT Proposal Master Template.docx";
var DEFAULT_ELEVATOR_WORD_TEMPLATE_PATH = "/templates/FAAT Elevator Offer Template.docx";
var DEFAULT_CCS_TEMPLATE_PATH = "/templates/FAAT CCS Pricing Workbook.xlsx";
var DEFAULT_EXCEL_TEMPLATE_PATH = "/templates/FAAT Excel Template.xlsx";
/**
* Escalators share the elevators' CCS workbook (E1/E2 groups live in the same file), so the Excel slot
* of "escalators" is the elevators' slot.
*/
function excelSlotType(systemType) {
	return systemType === "escalators" ? "elevators" : systemType;
}
/** "ccs" = the pricing workbook with fixed input cells. "tokens" = {{TOKEN}} placeholders (Word or Excel). */
function templateModeFor(systemType, kind) {
	return kind === "xlsx" && excelSlotType(systemType) === "elevators" ? "ccs" : "tokens";
}
function defaultTemplateInfo(systemType, kind) {
	if (kind === "docx") return systemType === "elevators" ? {
		path: DEFAULT_ELEVATOR_WORD_TEMPLATE_PATH,
		label: "FAAT Elevator Offer Template.docx"
	} : {
		path: DEFAULT_WORD_TEMPLATE_PATH,
		label: "FAAT Proposal Master Template.docx"
	};
	return excelSlotType(systemType) === "elevators" ? {
		path: DEFAULT_CCS_TEMPLATE_PATH,
		label: "FAAT CCS Pricing Workbook.xlsx"
	} : {
		path: null,
		label: "ملف يُبنى تلقائياً (لا يوجد قالب)"
	};
}
/** Every spec the quotation really contained (project-wide + per line item). Used by {{SPEC:label}}. */
function collectSpecs(proposal) {
	const ex = proposal.extraction;
	const general = ex?.generalSpecifications.map((s) => ({
		key: s.key,
		label: s.key,
		value: s.value
	})) ?? proposal.specs;
	const perItem = ex?.items.flatMap((it) => it.specifications.map((s) => ({
		key: s.key,
		label: s.key,
		value: s.value
	}))) ?? [];
	const perUnit = (proposal.units ?? []).flatMap((u) => u.specs);
	return [
		...general,
		...perItem,
		...perUnit
	];
}
function buildGenericWordItems(proposal) {
	return (proposal.extraction?.items ?? []).map((x) => ({
		location: x.location ?? "",
		category: x.category ?? "",
		code: x.code ?? "",
		description: x.description ?? "",
		qty: String(x.quantity ?? ""),
		unit: x.unit ?? ""
	}));
}
/** Tokens + repeating rows for a Word template of any system type. */
function buildWordValues(proposal, project, client) {
	const generic = buildProposalTokens(proposal, project, client);
	if (proposal.systemType === "elevators") {
		const elv = buildElevatorTokens(proposal, project, client);
		return {
			tokens: {
				...generic,
				...elv.tokens
			},
			items: elv.items,
			specs: collectSpecs(proposal),
			missing: elv.missing,
			unmatchedSpecs: elv.unmatchedSpecs
		};
	}
	return {
		tokens: generic,
		items: buildGenericWordItems(proposal),
		specs: collectSpecs(proposal),
		missing: [],
		unmatchedSpecs: []
	};
}
/** Values for an Excel template (internal sheet): numbers stay numbers so formulas can use them. */
function buildExcelValues(proposal, project, client) {
	const { tokens, specs } = buildWordValues(proposal, project, client);
	const ex = proposal.extraction;
	return {
		values: {
			...tokens,
			SYSTEM_LABEL: ex?.systemLabel || tokens.SYSTEM_TYPE_EN || "",
			SUPPLIER: ex?.supplier ?? "",
			QUOTE_NUMBER: ex?.quoteNumber ?? "",
			QUOTE_DATE: ex?.quoteDate ?? "",
			CURRENCY: proposal.currency,
			FOB_TOTAL: proposal.fob,
			SUPPLIER_GRAND_TOTAL: ex?.commercial.grandTotal ?? proposal.fob,
			SELLING_PRICE: proposal.sellingPrice,
			TOTAL_QTY_NUM: (ex?.items ?? []).reduce((n, x) => n + Math.max(0, x.quantity), 0) || (proposal.units ?? []).reduce((n, u) => n + u.quantity, 0),
			SELLING_PRICE_FORMATTED: formatMoney(proposal.sellingPrice, proposal.currency)
		},
		items: (ex?.items ?? []).map((x) => ({
			location: x.location,
			category: x.category,
			code: x.code,
			description: x.description,
			qty: x.quantity,
			unit: x.unit,
			unit_price: x.unitPrice,
			total: x.total
		})),
		specs
	};
}
function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.rel = "noopener";
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function names(proposal, project) {
	return {
		docx: `${`FAAT ${systemLabel[proposal.systemType].en} Proposal - ${project.name} - ${proposal.number}`}.docx`,
		xlsx: `FAAT Cost Sheet - ${project.name} - ${proposal.number}.xlsx`
	};
}
var EXCEL_TEMPLATE_PATH = DEFAULT_EXCEL_TEMPLATE_PATH;
var CCS_TEMPLATE_PATH = DEFAULT_CCS_TEMPLATE_PATH;
async function generateCcsExcel(proposal, project) {
	const custom = await templateStore.getActive(excelSlotType(proposal.systemType), "xlsx");
	const buffer = custom && custom.mode === "ccs" ? custom.data : await fetchTemplate(CCS_TEMPLATE_PATH, "Excel");
	const groups = (proposal.units ?? []).map((u) => ({
		code: u.code,
		description: u.description,
		quantity: u.quantity,
		fobUnit: u.fobUnit,
		technical: u.technical
	}));
	const { blob, skipped, missingFob } = await fillCcsWorkbook(buffer, {
		projectName: project.name,
		quoteNumber: proposal.extraction?.quoteNumber,
		quoteDate: proposal.extraction?.quoteDate
	}, groups);
	for (const sk of skipped) toast.warning(`لم تُضف المجموعة ${sk.code} إلى ملف Excel: ${sk.reason}`);
	if (missingFob.length) toast.warning(`FOB غير محدد للمجموعات: ${missingFob.join("، ")} — أدخله في ورقة التكلفة داخل Excel`);
	const filename = names(proposal, project).xlsx;
	downloadBlob(blob, filename);
	return filename;
}
async function generateExcel(proposal, project, client) {
	if ((proposal.systemType === "elevators" || proposal.systemType === "escalators") && proposal.units?.length) return generateCcsExcel(proposal, project);
	const pricing = computePricing(proposal.fob, proposal.costLines, proposal.sellingPrice);
	const extraction = proposal.extraction;
	const custom = await templateStore.getActive(excelSlotType(proposal.systemType), "xlsx");
	if (custom && custom.mode === "tokens") {
		const { values, items, specs } = buildExcelValues(proposal, project, client);
		const res = await fillXlsxXml(custom.data, values, items, custom.cellMap ?? [], specs);
		if (res.unfilled.length) toast.warning(`قالب Excel: لا توجد بيانات للحقول التالية وتُركت "—": ${res.unfilled.join("، ")}`);
		for (const sk of res.skipped) toast.warning(`قالب Excel — ${sk.where}: ${sk.reason}`);
		const filename = names(proposal, project).xlsx;
		downloadBlob(res.blob, filename);
		return filename;
	}
	const templateRes = await fetch(encodeURI(EXCEL_TEMPLATE_PATH)).catch(() => null);
	if (templateRes?.ok) {
		const buf = await templateRes.arrayBuffer();
		const wb = readSync(buf, {
			type: "array",
			cellStyles: true
		});
		if (isPlaceholderTemplate(wb)) {
			const { unfilled } = fillXlsxTemplate(wb, {
				PROJECT_NAME: project.name,
				CLIENT_NAME: client.name || client.nameAr,
				SYSTEM_LABEL: extraction?.systemLabel || systemLabel[proposal.systemType].en,
				SUPPLIER: extraction?.supplier ?? "",
				QUOTE_NUMBER: extraction?.quoteNumber ?? "",
				QUOTE_DATE: extraction?.quoteDate ?? "",
				CURRENCY: proposal.currency,
				SUPPLIER_GRAND_TOTAL: extraction?.commercial.grandTotal ?? proposal.fob,
				SELLING_PRICE: proposal.sellingPrice,
				MARGIN: pricing.marginAmount,
				OPERATING_COST: pricing.operating
			}, (extraction?.items ?? []).map((x) => ({
				location: x.location,
				category: x.category,
				code: x.code,
				description: x.description,
				qty: x.quantity,
				unit: x.unit,
				unit_price: x.unitPrice,
				total: x.total
			})));
			if (unfilled.length) console.warn("Excel template: unmapped placeholders left blank —", unfilled.join(", "));
			const out = writeSync(wb, {
				bookType: "xlsx",
				type: "array",
				cellStyles: true,
				compression: true
			});
			const filename = names(proposal, project).xlsx;
			downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
			return filename;
		}
	}
	const wb = utils.book_new();
	const summary = utils.aoa_to_sheet([
		["FAAT Engineering — Quotation / Proposal"],
		["Project", project.name],
		["Client", client.name || client.nameAr],
		["System", extraction?.systemLabel || systemLabel[proposal.systemType].en],
		["Supplier", extraction?.supplier ?? ""],
		["Quotation", extraction?.quoteNumber ?? ""],
		["Date", extraction?.quoteDate ?? ""],
		["Currency", proposal.currency],
		["Supplier Grand Total", extraction?.commercial.grandTotal ?? proposal.fob],
		["Proposal Selling Price", proposal.sellingPrice]
	]);
	const items = utils.aoa_to_sheet([[
		"Location",
		"Category",
		"Code",
		"Description",
		"Qty",
		"Unit",
		"Unit Price",
		"Total",
		"Specifications"
	], ...(extraction?.items ?? []).map((x) => [
		x.location,
		x.category,
		x.code,
		x.description,
		x.quantity,
		x.unit,
		x.unitPrice,
		x.total,
		x.specifications.map((s) => `${s.key}: ${s.value}`).join(" | ")
	])]);
	const specs = utils.aoa_to_sheet([["Specification", "Value"], ...(extraction?.generalSpecifications ?? proposal.specs.map((s) => ({
		key: s.label || s.key,
		value: s.value
	}))).map((x) => [x.key, x.value])]);
	const commercial = utils.aoa_to_sheet([
		["Commercial Item", "Amount"],
		["Supplier quotation", extraction?.commercial.grandTotal ?? proposal.fob],
		["Operating cost", pricing.operating],
		["Selling price", proposal.sellingPrice],
		["Margin", pricing.marginAmount]
	]);
	const sheets = [
		[summary, "Summary"],
		[items, "Items"],
		[specs, "Specifications"],
		[commercial, "Commercial"]
	];
	if (extraction?.dynamicTables.length) extraction.dynamicTables.forEach((table, i) => {
		const rows = [table.columns.map((c) => c.label || c.key), ...table.rows.map((r) => table.columns.map((c) => r.cells.find((cell) => cell.key === c.key)?.value ?? ""))];
		sheets.push([utils.aoa_to_sheet(rows), (table.title || `Table ${i + 1}`).slice(0, 31)]);
	});
	sheets.forEach(([ws]) => {
		ws["!cols"] = [
			{ wch: 24 },
			{ wch: 24 },
			{ wch: 18 },
			{ wch: 45 },
			{ wch: 10 },
			{ wch: 10 },
			{ wch: 14 },
			{ wch: 14 },
			{ wch: 55 }
		];
	});
	sheets.forEach(([ws, name]) => utils.book_append_sheet(wb, ws, name));
	const out = writeSync(wb, {
		bookType: "xlsx",
		type: "array",
		compression: true
	});
	const filename = names(proposal, project).xlsx;
	downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
	return filename;
}
var WORD_TEMPLATE_PATH = DEFAULT_WORD_TEMPLATE_PATH;
var ELEVATOR_WORD_TEMPLATE_PATH = DEFAULT_ELEVATOR_WORD_TEMPLATE_PATH;
async function fetchTemplate(path, kind = "Word") {
	const res = await fetch(encodeURI(path));
	if (!res.ok) throw new Error(`قالب ${kind} غير موجود على ${path} (HTTP ${res.status}). تأكد أن الملف موجود فعلاً تحت public${path}.`);
	const buffer = await res.arrayBuffer();
	const bytes = new Uint8Array(buffer.slice(0, 2));
	if (bytes[0] !== 80 || bytes[1] !== 75) throw new Error(`الملف الذي تم جلبه من ${path} ليس ملف ${kind} صالحاً (ربما تم إرجاع صفحة أخرى بدلاً منه). تأكد من مسار الملف تحت public${path}.`);
	return buffer;
}
async function generateWord(proposal, project, client) {
	const custom = await templateStore.getActive(proposal.systemType, "docx");
	const path = proposal.systemType === "elevators" ? ELEVATOR_WORD_TEMPLATE_PATH : WORD_TEMPLATE_PATH;
	const templateBuffer = custom ? custom.data : await fetchTemplate(path);
	const { tokens, items, specs, missing, unmatchedSpecs } = buildWordValues(proposal, project, client);
	const { blob, unfilledTokens } = await fillDocxTemplate(templateBuffer, tokens, items, specs);
	if (missing.length) {
		console.warn("Word template: no matching spec for —", missing.join(", "), "| extracted but unused —", unmatchedSpecs);
		toast.warning(`لم تُطابَق هذه الحقول مع مواصفات الكوتيشن وبقيت "—": ${missing.join("، ")}`);
	}
	if (unfilledTokens.length) {
		console.warn("Word template: unmapped placeholders left blank —", unfilledTokens.join(", "));
		toast.warning(`قالب Word: لا توجد بيانات للحقول التالية وتُركت "—": ${unfilledTokens.join("، ")}`);
	}
	const filename = names(proposal, project).docx;
	downloadBlob(blob, filename);
	return filename;
}
async function generateAll(proposal, project, client) {
	return {
		xlsx: await generateExcel(proposal, project, client),
		docx: await generateWord(proposal, project, client)
	};
}
//#endregion
export { defaultCostLines as a, generateAll as c, scanXlsxTemplate as d, templateModeFor as f, computePricing as i, parseCellMap as l, validateCcsWorkbook as m, buildElevatorTokens as n, defaultTemplateInfo as o, templateStore as p, buildProposalTokens as r, excelSlotType as s, TEMPLATE_SYSTEM_TYPES as t, scanDocxTemplate as u };
