import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, x as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useAppStore, i as uid, n as formatMoney, r as nextProposalNumber } from "./store-BmABQmXm.mjs";
import { r as systemLabel, t as Button } from "./labels-DcR_-vm5.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { a as defaultCostLines, c as generateAll, d as scanXlsxTemplate, f as templateModeFor, i as computePricing, l as parseCellMap, m as validateCcsWorkbook, n as buildElevatorTokens, o as defaultTemplateInfo, p as templateStore, r as buildProposalTokens, s as excelSlotType, t as TEMPLATE_SYSTEM_TYPES, u as scanDocxTemplate } from "./documents-QZpdkq-M.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { n as Input, t as Field } from "./input-_x8AQeNh.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/new-f5DpgAtN.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var stubProposal = {
	id: "",
	number: "",
	revision: 0,
	projectId: "",
	clientId: "",
	systemType: "elevators",
	status: "draft",
	currency: "USD",
	validityDays: 30,
	date: "2026-01-01",
	validUntil: "2026-01-31",
	owner: "",
	quotationSource: "",
	specs: [],
	units: [{
		id: "u1",
		code: "L1",
		description: "",
		quantity: 1,
		specs: []
	}],
	notes: "",
	fob: 0,
	costLines: [],
	sellingPrice: 0,
	payment: {
		advance: 0,
		shipping: 0,
		handover: 0
	},
	schedule: {
		supplyMin: 0,
		supplyMax: 0,
		installMin: 0,
		installMax: 0,
		testMin: 0,
		testMax: 0,
		warrantyMonths: 0,
		freeMaintenanceMonths: 0
	},
	files: [],
	createdAt: "",
	updatedAt: ""
};
var stubProject = {
	name: "",
	nameAr: "",
	location: ""
};
var stubClient = {
	name: "",
	nameAr: ""
};
var EXCEL_ONLY_TOKENS = [
	"SYSTEM_LABEL",
	"SUPPLIER",
	"QUOTE_NUMBER",
	"QUOTE_DATE",
	"CURRENCY",
	"FOB_TOTAL",
	"SUPPLIER_GRAND_TOTAL",
	"SELLING_PRICE",
	"TOTAL_QTY_NUM",
	"SELLING_PRICE_FORMATTED"
];
var cached = null;
function getTokenCatalog() {
	if (cached) return cached;
	const common = Object.keys(buildProposalTokens(stubProposal, stubProject, stubClient));
	const elvAll = Object.keys(buildElevatorTokens(stubProposal, stubProject, stubClient).tokens);
	const commonSet = new Set(common);
	cached = {
		common,
		elevator: elvAll.filter((k) => !commonSet.has(k)),
		excelOnly: EXCEL_ONLY_TOKENS,
		wordItemFields: [
			"location",
			"category",
			"code",
			"description",
			"qty",
			"unit"
		],
		elevatorItemFields: Object.keys(buildElevatorTokens(stubProposal, stubProject, stubClient).items[0] ?? {}),
		excelItemFields: [
			"location",
			"category",
			"code",
			"description",
			"qty",
			"unit",
			"unit_price",
			"total"
		]
	};
	return cached;
}
function knownTokenSet(kind) {
	const c = getTokenCatalog();
	return /* @__PURE__ */ new Set([
		...c.common,
		...c.elevator,
		...kind === "xlsx" ? c.excelOnly : []
	]);
}
function knownItemFieldSet(kind) {
	const c = getTokenCatalog();
	return new Set(kind === "xlsx" ? c.excelItemFields : [...c.wordItemFields, ...c.elevatorItemFields]);
}
var MAX_BYTES = 15728640;
async function analyze(systemType, kind, fileName, data, cellMap, mapErrors, mapFileName) {
	const mode = templateModeFor(systemType, kind);
	const base = {
		systemType,
		kind,
		mode,
		fileName,
		data,
		cellMap,
		mapFileName,
		blocking: [...mapErrors],
		warnings: [],
		knownTokens: [],
		unknownTokens: [],
		specLabels: [],
		knownItemFields: [],
		unknownItemFields: [],
		hasItemsRow: false
	};
	if (mode === "ccs") {
		const v = await validateCcsWorkbook(data);
		if (!v.ok) base.blocking.push(v.error ?? `هذا ليس ملف CCS: الأوراق التالية مفقودة — ${v.missing.join("، ")}`);
		else base.warnings.push("سيُستخدم كبديل لملف CCS: يفترض النظام أن خلايا الإدخال (الكمية D12 وسعر FOB E12 في أوراق التكلفة) في نفس أماكنها. إذا غيّرت التخطيط فلن تُكتب البيانات في المكان الصحيح.");
		return base;
	}
	let scan;
	let mapped = 0;
	if (kind === "docx") scan = await scanDocxTemplate(data);
	else {
		const x = await scanXlsxTemplate(data, cellMap);
		scan = x;
		mapped = x.mapEntries;
		if (x.ok) base.blocking.push(...x.mapProblems);
	}
	if (!scan.ok) {
		base.blocking.push(scan.error ?? "ملف غير صالح");
		return base;
	}
	const known = knownTokenSet(kind), knownFields = knownItemFieldSet(kind);
	base.knownTokens = scan.tokens.filter((t) => known.has(t));
	base.unknownTokens = scan.tokens.filter((t) => !known.has(t));
	base.specLabels = scan.specLabels;
	base.knownItemFields = scan.itemFields.filter((f) => knownFields.has(f));
	base.unknownItemFields = scan.itemFields.filter((f) => !knownFields.has(f));
	base.hasItemsRow = scan.hasItemsRow;
	if (scan.tokens.length + scan.specLabels.length + scan.itemFields.length === 0 && mapped === 0) base.warnings.push("لم يُعثر على أي توكن ({{...}}) في الملف. سيخرج الملف الناتج مطابقاً للقالب بدون أي بيانات.");
	if (scan.itemFields.length && !scan.hasItemsRow) base.warnings.push("استخدمت {{items.حقل}} لكن لا يوجد صف يحتوي {{ITEMS_ROW}}، فلن تتكرر البنود.");
	if (kind === "xlsx" && scan.hasItemsRow) base.warnings.push("لا يُدرج النظام صفوفاً جديدة في Excel حتى لا تتزحزح المعادلات. اترك صفوفاً فارغة تحت صف البنود؛ ما لا يتسع منها يُبلَّغ عنه ولا يُحذف بصمت.");
	return base;
}
var fmtDate = (iso) => {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
};
var fmtSize = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
function Chip({ children, tone = "plain" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		dir: "ltr",
		className: `inline-block rounded-md px-1.5 py-0.5 font-mono text-[10px] ${tone === "ok" ? "bg-accent/10 text-accent" : tone === "warn" ? "bg-amber-100 text-amber-900" : "bg-paper text-muted"}`,
		children
	});
}
function TemplateManager() {
	const [records, setRecords] = (0, import_react.useState)([]);
	const [pending, setPending] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [history, setHistory] = (0, import_react.useState)(null);
	const refresh = (0, import_react.useCallback)(async () => {
		try {
			setRecords(await templateStore.list());
		} catch {}
	}, []);
	(0, import_react.useEffect)(() => {
		refresh();
	}, [refresh]);
	const catalog = (0, import_react.useMemo)(() => getTokenCatalog(), []);
	const slotRecords = (systemType, kind) => records.filter((r) => r.systemType === systemType && r.kind === kind).sort((a, b) => b.version - a.version);
	async function pick(systemType, kind, file) {
		if (!file) return;
		const ext = kind === "docx" ? ".docx" : ".xlsx";
		if (!file.name.toLowerCase().endsWith(ext)) return void toast.error(`الملف يجب أن يكون بصيغة ${ext}`);
		if (file.size > MAX_BYTES) return void toast.error("حجم الملف أكبر من 15MB");
		setBusy(true);
		try {
			setPending(await analyze(systemType, kind, file.name, await file.arrayBuffer(), [], []));
		} catch {
			toast.error("تعذر قراءة الملف");
		} finally {
			setBusy(false);
		}
	}
	async function attachMap(file) {
		if (!file || !pending) return;
		setBusy(true);
		try {
			const parsed = parseCellMap(await file.text());
			setPending(await analyze(pending.systemType, pending.kind, pending.fileName, pending.data, parsed.map, parsed.errors, file.name));
		} finally {
			setBusy(false);
		}
	}
	async function confirm() {
		if (!pending || pending.blocking.length) return;
		setBusy(true);
		try {
			const rec = await templateStore.save({
				systemType: excelSlotType(pending.systemType) === "elevators" && pending.kind === "xlsx" ? "elevators" : pending.systemType,
				kind: pending.kind,
				mode: pending.mode,
				fileName: pending.fileName,
				data: pending.data,
				tokensFound: [
					...pending.knownTokens,
					...pending.unknownTokens,
					...pending.specLabels.map((l) => `SPEC:${l}`)
				],
				cellMap: pending.cellMap.length ? pending.cellMap : void 0
			});
			toast.success(`تم اعتماد القالب (الإصدار ${rec.version}) — سيُستخدم في التوليد القادم`);
			setPending(null);
			await refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "تعذر حفظ القالب");
		} finally {
			setBusy(false);
		}
	}
	async function act(fn, okMsg) {
		setBusy(true);
		try {
			await fn();
			await refresh();
			if (okMsg) toast.success(okMsg);
		} catch {
			toast.error("تعذرت العملية");
		} finally {
			setBusy(false);
		}
	}
	function download(rec) {
		const url = URL.createObjectURL(new Blob([rec.data]));
		const a = document.createElement("a");
		a.href = url;
		a.download = rec.fileName;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1500);
	}
	function Slot({ systemType, kind }) {
		const slotType = kind === "xlsx" ? excelSlotType(systemType) : systemType;
		const recs = slotRecords(slotType, kind);
		const active = recs.find((r) => r.active) ?? null;
		const def = defaultTemplateInfo(systemType, kind);
		const key = `${slotType}:${kind}`;
		const accept = kind === "docx" ? ".docx" : ".xlsx";
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-[12px] border border-line bg-surface p-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs font-semibold",
						children: kind === "docx" ? "Word" : "Excel"
					}), active ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent",
						children: ["مخصص · v", active.version]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full bg-paper px-2 py-0.5 text-[10px] text-muted",
						children: "افتراضي"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 truncate text-[11px] text-muted",
					dir: "ltr",
					title: active?.fileName ?? def.label,
					children: active?.fileName ?? def.label
				}),
				active ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-[10px] text-muted",
					children: [
						fmtDate(active.uploadedAt),
						" · ",
						fmtSize(active.size),
						active.cellMap ? ` · ربط خلايا (${active.cellMap.length})` : ""
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 flex flex-wrap gap-1.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: `inline-flex h-8 cursor-pointer items-center rounded-[10px] bg-navy px-3 text-xs font-medium text-accent-fg hover:opacity-90 ${busy ? "pointer-events-none opacity-50" : ""}`,
							children: [active ? "استبدال" : "رفع قالب", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "file",
								accept,
								className: "hidden",
								onChange: (e) => {
									const f = e.target.files?.[0];
									e.target.value = "";
									pick(systemType, kind, f);
								}
							})]
						}),
						active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "outline",
							onClick: () => download(active),
							children: "تنزيل"
						}) : def.path ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							className: "inline-flex h-8 items-center rounded-[10px] border border-line bg-surface px-3 text-xs hover:bg-paper",
							href: encodeURI(def.path),
							download: true,
							children: "تنزيل الافتراضي"
						}) : null,
						active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							disabled: busy,
							onClick: () => void act(() => templateStore.useDefault(slotType, kind), "عُدنا إلى القالب الافتراضي"),
							children: "رجوع للافتراضي"
						}) : null,
						recs.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: () => setHistory(history === key ? null : key),
							children: [
								"الإصدارات (",
								recs.length,
								")"
							]
						}) : null
					]
				}),
				history === key ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 space-y-1 border-t border-line pt-2",
					children: recs.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-2 text-[11px]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-medium",
								children: ["v", r.version]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "min-w-0 flex-1 truncate text-muted",
								dir: "ltr",
								children: r.fileName
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted",
								children: fmtDate(r.uploadedAt)
							}),
							r.active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-accent",
								children: "فعّال"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								disabled: busy,
								onClick: () => void act(() => templateStore.activate(r.id), `تم تفعيل الإصدار ${r.version}`),
								children: "تفعيل"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "ghost",
								disabled: busy,
								onClick: () => {
									if (window.confirm(`حذف الإصدار ${r.version} نهائياً؟`)) act(() => templateStore.remove(r.id));
								},
								children: "حذف"
							})
						]
					}, r.id))
				}) : null
			]
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs leading-5 text-muted",
				children: [
					"القوالب تُحفظ في هذا المتصفح فقط (لا تُشارك بين الأجهزة أو المستخدمين). عند عدم رفع قالب يُستخدم القالب الافتراضي المرفق مع النظام. لا حاجة لأي برمجة: اكتب في القالب أسماء الحقول بين ",
					"{{ }}",
					" (انظر قائمة الحقول أدناه) وارفعه."
				]
			}),
			pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-[14px] border-2 border-accent/40 bg-accent/5 p-4 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2 text-sm font-semibold",
						children: [
							"فحص القالب قبل الاعتماد ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: pending.fileName }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-muted font-normal",
								children: [
									"← ",
									systemLabel[pending.systemType].ar,
									" / ",
									pending.kind === "docx" ? "Word" : "Excel"
								]
							})
						]
					}),
					pending.blocking.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 space-y-1 rounded-lg border border-red-300 bg-red-50 p-3 text-red-800",
						children: pending.blocking.map((m, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["⛔ ", m] }, i))
					}) : null,
					pending.mode === "tokens" && !pending.blocking.some((b) => b.includes("ليس ملف")) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-medium",
									children: [
										"حقول معروفة (",
										pending.knownTokens.length,
										"):"
									]
								}),
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "inline-flex flex-wrap gap-1 align-middle",
									children: [pending.knownTokens.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
										tone: "ok",
										children: t
									}, t)), pending.knownTokens.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted",
										children: "—"
									}) : null]
								})
							] }),
							pending.specLabels.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-medium",
									children: [
										"حقول مواصفات بالاسم (",
										pending.specLabels.length,
										"):"
									]
								}),
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "inline-flex flex-wrap gap-1 align-middle",
									children: pending.specLabels.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, { children: ["SPEC:", t] }, t))
								}),
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted",
									children: "— تُطابَق بالاسم مع مواصفات الكوتيشن وقت التوليد؛ ما لا يوجد يظهر \"—\" مع تنبيه."
								})
							] }) : null,
							pending.knownItemFields.length || pending.hasItemsRow ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: "جدول بنود متكرر:"
								}),
								" ",
								pending.hasItemsRow ? "✅ صف {{ITEMS_ROW}} موجود" : "⚠ لا يوجد صف {{ITEMS_ROW}}",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "inline-flex flex-wrap gap-1 align-middle",
									children: pending.knownItemFields.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
										tone: "ok",
										children: ["items.", t]
									}, t))
								})
							] }) : null,
							pending.unknownTokens.length || pending.unknownItemFields.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-medium",
										children: "⚠ حقول غير معروفة — ستظهر \"—\" في الملف الناتج مع تنبيه:"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-1 flex flex-wrap gap-1",
										children: [pending.unknownTokens.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
											tone: "warn",
											children: t
										}, t)), pending.unknownItemFields.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
											tone: "warn",
											children: ["items.", t]
										}, `i${t}`))]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-1",
										children: [
											"غالباً خطأ إملائي. للمواصفات الفنية استخدم الصيغة العامة ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: "{{SPEC:اسم المواصفة}}" }),
											"."
										]
									})
								]
							}) : null
						]
					}) : null,
					pending.warnings.map((w, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 rounded-lg bg-surface p-2 text-muted",
						children: ["ℹ ", w]
					}, i)),
					pending.kind === "xlsx" && pending.mode === "tokens" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "inline-flex h-8 cursor-pointer items-center rounded-[10px] border border-line bg-surface px-3 text-xs hover:bg-paper",
							children: ["إرفاق ملف ربط خلايا (JSON) — اختياري", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "file",
								accept: ".json,application/json",
								className: "hidden",
								onChange: (e) => {
									const f = e.target.files?.[0];
									e.target.value = "";
									attachMap(f);
								}
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted",
							children: pending.mapFileName ? `${pending.mapFileName} (${pending.cellMap.length} خلية)` : "للخلايا التي فيها رقم جاهز ولا تحمل توكن"
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							disabled: busy || pending.blocking.length > 0,
							onClick: () => void confirm(),
							children: "اعتماد القالب"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: () => setPending(null),
							children: "إلغاء"
						})]
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: TEMPLATE_SYSTEM_TYPES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-[14px] border border-line bg-paper p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mb-2 text-sm font-semibold",
						children: systemLabel[t].ar
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-2",
						children: [Slot({
							systemType: t,
							kind: "docx"
						}), t === "escalators" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "rounded-[12px] border border-dashed border-line p-3 text-[11px] leading-5 text-muted",
							children: "ملف Excel للسلالم الكهربائية هو نفسه ملف CCS الخاص بالمصاعد (مجموعات E1/E2 في نفس المصنف). يُدار من بطاقة \"مصاعد\"."
						}) : Slot({
							systemType: t,
							kind: "xlsx"
						})]
					})]
				}, t))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				className: "rounded-[14px] border border-line bg-paper p-3 text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
					className: "cursor-pointer text-sm font-semibold",
					children: "قائمة الحقول المتاحة للقوالب"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 space-y-3 leading-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-medium",
							children: "حقول عامة (Word وExcel، كل الأنظمة)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 flex flex-wrap gap-1",
							children: catalog.common.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: `{{${t}}}` }, t))
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-medium",
							children: "حقول المصاعد (قالب المصاعد)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 flex flex-wrap gap-1",
							children: catalog.elevator.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: `{{${t}}}` }, t))
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-medium",
							children: "إضافية لـ Excel فقط (أرقام حقيقية تدخل المعادلات)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 flex flex-wrap gap-1",
							children: catalog.excelOnly.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: `{{${t}}}` }, t))
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-medium",
							children: "مواصفات فنية بالاسم — لأي نظام (تشيلر، VRF، ...)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1",
							children: [
								"اكتب ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: "{{SPEC:سعة التبريد}}" }),
								" أو ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: "{{SPEC:Capacity}}" }),
								"؛ يُطابَق مع اسم المواصفة كما وردت في الكوتيشن (تطابق تام أولاً ثم احتواء)."
							]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-medium",
							children: "جدول بنود يتكرر"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1",
							children: [
								"ضع ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: "{{ITEMS_ROW}}" }),
								" في أي خلية من صف الجدول، وفي نفس الصف حقول ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: "{{items.حقل}}" }),
								". حقول Word (بدون أسعار المورد): ",
								catalog.wordItemFields.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: f }, f)),
								" · المصاعد: ",
								catalog.elevatorItemFields.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: f }, f)),
								" · Excel: ",
								catalog.excelItemFields.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: f }, f))
							]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-medium",
							children: "ملف ربط الخلايا (Excel، اختياري)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
							dir: "ltr",
							className: "mt-1 overflow-x-auto rounded-lg bg-surface p-2 text-[10px]",
							children: `[
  { "sheet": "Cost", "cell": "D12", "source": "TOTAL_QTY_NUM" },
  { "sheet": "Cost", "cell": "B20", "source": "items.description", "repeat": "down", "max": 30 }
]`
						})] })
					]
				})]
			})
		]
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var extractQuotation = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("2acf7024f820d411ecbd5316d4e2b571a29542278e609728af209f84dea3f1ec"));
var steps = [
	"الكوتيشن + AI",
	"المراجعة والتسعير",
	"التوليد"
];
var selectCls = "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent";
function BlockHeader({ icon, title, hint, aside }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start gap-2.5",
		children: [
			icon,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-semibold leading-6",
					children: title
				}), hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs leading-5 text-muted",
					children: hint
				}) : null]
			}),
			aside
		]
	});
}
function NewProposal() {
	const nav = useNavigate();
	const store = useAppStore();
	const salesManager = useAppStore((s) => s.salesManager);
	const [step, setStep] = (0, import_react.useState)(0);
	const [projectMode, setProjectMode] = (0, import_react.useState)("new");
	const [projectId, setProjectId] = (0, import_react.useState)(store.projects[0]?.id ?? "");
	const [newProject, setNewProject] = (0, import_react.useState)({
		name: "",
		nameAr: "",
		location: "",
		clientName: "",
		division: "other"
	});
	const [selectedSystemType, setSelectedSystemType] = (0, import_react.useState)("other");
	const [detectedSystemType, setDetectedSystemType] = (0, import_react.useState)(null);
	const [filenameHint, setFilenameHint] = (0, import_react.useState)(null);
	const systemType = selectedSystemType !== "other" ? selectedSystemType : detectedSystemType ?? "other";
	const systemTypeMismatch = !!(detectedSystemType && selectedSystemType !== "other" && selectedSystemType !== detectedSystemType);
	const [extracting, setExtracting] = (0, import_react.useState)(false);
	const [specs, setSpecs] = (0, import_react.useState)([]);
	const [fob, setFob] = (0, import_react.useState)(0);
	const [qty, setQty] = (0, import_react.useState)(1);
	const [costLines, setCostLines] = (0, import_react.useState)(defaultCostLines());
	const [sellingOverride, setSellingOverride] = (0, import_react.useState)(0);
	const [pricingMode, setPricingMode] = (0, import_react.useState)("calculated");
	const [payment, setPayment] = (0, import_react.useState)({
		advance: 40,
		shipping: 50,
		handover: 10
	});
	const [schedule, setSchedule] = (0, import_react.useState)({
		supplyMin: 16,
		supplyMax: 20,
		installMin: 6,
		installMax: 8,
		testMin: 2,
		testMax: 3,
		warrantyMonths: 36,
		freeMaintenanceMonths: 12
	});
	const [confirmed, setConfirmed] = (0, import_react.useState)(false);
	const [generating, setGenerating] = (0, import_react.useState)(false);
	const [notes, setNotes] = (0, import_react.useState)("");
	const [units, setUnits] = (0, import_react.useState)([]);
	const [supplier, setSupplier] = (0, import_react.useState)("");
	const [quoteNumber, setQuoteNumber] = (0, import_react.useState)("");
	const [quoteDate, setQuoteDate] = (0, import_react.useState)((/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
	const [quoteRevision, setQuoteRevision] = (0, import_react.useState)(0);
	const [quoteFileName, setQuoteFileName] = (0, import_react.useState)("");
	const [quoteFile, setQuoteFile] = (0, import_react.useState)(null);
	const [aiFields, setAiFields] = (0, import_react.useState)([]);
	const [extraction, setExtraction] = (0, import_react.useState)(null);
	const [reviewFilter, setReviewFilter] = (0, import_react.useState)("all");
	const effectiveQty = units.length ? units.reduce((n, u) => n + u.quantity, 0) : qty;
	const groupFobMode = units.length > 0 && units.every((u) => (u.fobUnit ?? 0) > 0);
	const fobTotal = groupFobMode ? units.reduce((n, u) => n + u.quantity * (u.fobUnit ?? 0), 0) : fob * Math.max(1, effectiveQty);
	const pricing = (0, import_react.useMemo)(() => computePricing(fobTotal, costLines, pricingMode === "manual" && sellingOverride > 0 ? sellingOverride : void 0), [
		fobTotal,
		costLines,
		sellingOverride,
		pricingMode
	]);
	function addUnit() {
		const next = units.length + 1;
		setUnits([...units, {
			id: uid("u"),
			code: `L${next}`,
			description: `مجموعة ${next}`,
			quantity: 1,
			specs: [...specs]
		}]);
	}
	function updateUnit(id, patch) {
		setUnits(units.map((u) => u.id === id ? {
			...u,
			...patch
		} : u));
	}
	function removeUnit(id) {
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
				if (quoteFile.size > 52428800) throw new Error("الملف أكبر من 50MB");
				const bytes = new Uint8Array(await quoteFile.arrayBuffer());
				let binary = "";
				const chunk = 32768;
				for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
				fileBase64 = btoa(binary);
			}
			const res = await extractQuotation({ data: {
				text: "",
				fileBase64,
				mimeType,
				fileName: quoteFileName
			} });
			if (!res.ok) throw new Error(res.error);
			const x = res.extraction;
			setExtraction(x);
			setDetectedSystemType(x.systemType);
			setFilenameHint(res.filenameHint ?? null);
			setNewProject((v) => ({
				...v,
				name: x.project.name || v.name,
				nameAr: x.project.name || v.nameAr,
				location: x.project.location || v.location,
				division: selectedSystemType !== "other" ? selectedSystemType : x.systemType
			}));
			const genericSpecs = x.generalSpecifications.map((s) => ({
				key: s.key,
				label: s.key,
				value: s.value
			}));
			setSpecs(genericSpecs);
			const itemQty = x.items.reduce((n, item) => n + Math.max(0, item.quantity), 0);
			const q = Math.max(1, itemQty || 1);
			setUnits([{
				id: uid("u"),
				code: "L1",
				description: "المجموعة الرئيسية",
				quantity: q,
				specs: genericSpecs
			}]);
			const groups = x.pricingGroups ?? [];
			if (groups.length) setUnits(groups.map((g) => ({
				id: uid("u"),
				code: g.code,
				description: g.description || g.code,
				quantity: Math.max(1, g.quantity || 1),
				specs: genericSpecs,
				fobUnit: g.fobUnit > 0 ? g.fobUnit : void 0,
				fobSource: g.fobSource,
				technical: {
					totalHeightM: g.technical.totalHeightM || void 0,
					landingDoors: g.technical.landingDoors || void 0,
					tractionRopes: g.technical.tractionRopes || void 0
				}
			})));
			if (x.supplier) setSupplier(x.supplier);
			else setSupplier("");
			if (x.quoteNumber) setQuoteNumber(x.quoteNumber);
			else setQuoteNumber("");
			if (x.quoteDate) setQuoteDate(x.quoteDate.slice(0, 10));
			const grand = Number(x.commercial.grandTotal) || 0;
			const groupQty = groups.reduce((n, g) => n + Math.max(1, g.quantity || 1), 0);
			const groupFobSum = groups.reduce((n, g) => n + Math.max(1, g.quantity || 1) * (g.fobUnit || 0), 0);
			const groupsHaveFob = groups.length > 0 && groups.every((g) => g.fobUnit > 0);
			setQty(groups.length ? Math.max(1, groupQty) : q);
			setFob(groupsHaveFob ? groupFobSum / Math.max(1, groupQty) : groups.length ? 0 : grand > 0 ? grand / q : 0);
			if (x.terms.delivery) {
				const nums = x.terms.delivery.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
				if (nums.length) setSchedule((v) => ({
					...v,
					supplyMin: nums[0],
					supplyMax: nums[1] || nums[0]
				}));
			}
			const warranty = x.terms.warranty.match(/\d+(?:\.\d+)?/);
			if (warranty) setSchedule((v) => ({
				...v,
				warrantyMonths: Number(warranty[0])
			}));
			setAiFields(res.reviewFields);
			toast.success(`تم تحليل الكوتيشن تلقائياً — ${x.systemLabel || x.systemType}`);
			setStep(1);
		} catch (e) {
			console.error(e);
			toast.error(e instanceof Error ? e.message : "فشل تحليل المستند");
			setStep(1);
		} finally {
			setExtracting(false);
		}
	}
	function updateAIField(key, value) {
		setAiFields((fields) => fields.map((f) => f.key === key ? {
			...f,
			value,
			confidence: f.confidence === "review" ? "medium" : f.confidence
		} : f));
	}
	function updateExtractionItem(id, patch) {
		setExtraction((current) => current ? {
			...current,
			items: current.items.map((item) => item.id === id ? {
				...item,
				...patch
			} : item)
		} : current);
	}
	function updateDynamicTableCell(tableId, rowId, key, value) {
		setExtraction((current) => current ? {
			...current,
			dynamicTables: current.dynamicTables.map((table) => table.id === tableId ? {
				...table,
				rows: table.rows.map((row) => row.id === rowId ? {
					...row,
					cells: row.cells.map((cell) => cell.key === key ? {
						...cell,
						value
					} : cell)
				} : row)
			} : table)
		} : current);
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
				const clientId = existingClient ? existingClient.id : store.addClient({
					name: clientName,
					nameAr: clientName,
					type: "client",
					city: "",
					contact: "",
					position: "",
					phone: "",
					email: ""
				});
				pid = store.addProject({
					name: newProject.name || newProject.nameAr,
					nameAr: newProject.nameAr || newProject.name,
					clientId,
					location: newProject.location,
					division: newProject.division,
					manager: salesManager,
					status: "active",
					contractValue: pricing.selling
				});
			}
			const project = useAppStore.getState().projects.find((p) => p.id === pid);
			const client = store.clients.find((c) => c.id === project?.clientId);
			if (!project || !client) throw new Error("missing project");
			const proposalId = uid("pr");
			const now = (/* @__PURE__ */ new Date()).toISOString();
			const finalSpecs = extraction ? extraction.generalSpecifications.map((s) => ({
				key: s.key,
				label: s.key,
				value: s.value
			})) : specs;
			const normalizedUnits = units.length ? units.map((u) => ({
				...u,
				specs: finalSpecs
			})) : [{
				id: uid("u"),
				code: "L1",
				description: "المجموعة الرئيسية",
				quantity: qty,
				specs: finalSpecs
			}];
			const supplierQuotation = {
				id: uid("sq"),
				supplier,
				quoteNumber,
				currency: "USD",
				units: normalizedUnits.map((u) => u.id),
				activeRevision: 0,
				revisions: [{
					id: uid("sqr"),
					revision: quoteRevision,
					quoteNumber,
					date: quoteDate,
					sourceName: quoteFileName || "Supplier quotation",
					status: "reviewed"
				}]
			};
			const proposal = {
				id: proposalId,
				number: nextProposalNumber(store.proposals.map((p) => p.number)),
				revision: 0,
				projectId: pid,
				clientId: client.id,
				systemType,
				status: "sent",
				currency: "USD",
				validityDays: 30,
				date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
				validUntil: new Date(Date.now() + 2592e6).toISOString().slice(0, 10),
				owner: salesManager,
				quotationSource: "Supplier quotation",
				specs: finalSpecs,
				selectedSystemType: selectedSystemType !== "other" ? selectedSystemType : void 0,
				units: normalizedUnits,
				supplierQuotations: [supplierQuotation],
				notes,
				fob: fobTotal,
				costLines,
				sellingPrice: pricing.selling,
				payment,
				schedule,
				files: [],
				extraction: extraction ?? void 0,
				createdAt: now,
				updatedAt: now
			};
			const generated = await generateAll(proposal, project, client);
			proposal.files = [{
				kind: "docx",
				name: generated.docx,
				generatedAt: now
			}, {
				kind: "xlsx",
				name: generated.xlsx,
				generatedAt: now
			}];
			store.addProposal(proposal);
			toast.success("تم إنشاء العرض وتوليد الملفات");
			nav({
				to: "/proposals/$proposalId",
				params: { proposalId }
			});
		} catch (e) {
			console.error(e);
			toast.error(e instanceof Error ? `تعذر توليد الملفات: ${e.message}` : "تعذر توليد الملفات");
		} finally {
			setGenerating(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-6xl space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
				position: "top-center",
				dir: "rtl"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "overflow-hidden rounded-[20px] border border-line bg-surface shadow-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-navy px-5 py-4 text-accent-fg md:px-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-xl font-semibold tracking-tight",
						children: "إنشاء عرض جديد"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-xs text-white/60",
						children: "حلّل كوتيشن المورد، راجع البيانات، ثم حوّلها إلى عرض جاهز للتوليد."
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "grid grid-cols-3 border-t border-line bg-paper",
					children: steps.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: `relative flex items-center justify-center gap-2 px-3 py-2.5 text-xs ${i === step ? "bg-surface font-semibold text-navy" : i < step ? "text-accent" : "text-muted"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `grid size-5 shrink-0 place-items-center rounded-full text-[10px] ${i === step ? "bg-navy text-white" : i < step ? "bg-accent text-white" : "bg-line text-muted"}`,
								children: i + 1
							}),
							s,
							i === step ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-x-0 bottom-0 h-0.5 bg-accent" }) : null
						]
					}, s))
				})]
			}),
			step === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-3 rounded-[20px] border border-line bg-surface p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-[14px] border border-dashed border-accent/40 bg-accent/5 p-3.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BlockHeader, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-[11px] font-semibold text-white",
								children: "AI"
							}),
							title: "ارفع كوتيشن المورد",
							hint: "يستخرج AI المشروع والمواصفات والأسعار تلقائياً. اترك نوع النظام «غير محدد» ليحدده من محتوى الكوتيشن.",
							aside: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								dir: "ltr",
								className: "shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-accent",
								children: "PDF · XLSX · DOCX · TXT"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "ملف الكوتيشن",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "file",
										accept: ".pdf,.xlsx,.xls,.doc,.docx,.txt",
										className: "cursor-pointer p-0 pe-3 file:me-3 file:h-full file:cursor-pointer file:border-0 file:bg-paper file:px-3 file:text-xs file:font-medium file:text-ink",
										onChange: (e) => {
											const f = e.target.files?.[0] ?? null;
											setQuoteFile(f);
											setQuoteFileName(f?.name ?? "");
										}
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "نوع النظام",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
										className: selectCls,
										value: selectedSystemType,
										onChange: (e) => setSelectedSystemType(e.target.value),
										children: [
											"other",
											"elevators",
											"chiller",
											"hvac",
											"vrf",
											"bms",
											"escalators",
											"smoke"
										].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: t,
											children: t === "other" ? "غير محدد (يحدده AI)" : systemLabel[t].ar
										}, t))
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									className: "w-full md:w-auto",
									disabled: !quoteFileName || extracting,
									onClick: () => void runExtract(),
									children: extracting ? "جارٍ فهم الكوتيشن…" : "تحليل الكوتيشن"
								})
							]
						})]
					}),
					systemTypeMismatch ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-[14px] border border-amber-400 bg-amber-50 px-3.5 py-3 text-amber-900",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-sm font-semibold",
								children: "⚠ تعارض في نوع النظام"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-0.5 text-xs leading-5",
								children: [
									"اخترت ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: systemLabel[selectedSystemType].ar }),
									"، لكن AI حلّل محتوى الكوتيشن ورأى أنه على الأغلب ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: systemLabel[detectedSystemType].ar }),
									". راجع الملف قبل المتابعة — القرار النهائي بيدك."
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex flex-wrap gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "outline",
									onClick: () => setSelectedSystemType(detectedSystemType),
									children: [
										"اعتماد رأي AI (",
										systemLabel[detectedSystemType].ar,
										")"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => setDetectedSystemType(selectedSystemType),
									children: "الإبقاء على اختياري"
								})]
							})
						]
					}) : null,
					filenameHint ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-[14px] border border-line bg-paper px-3.5 py-2 text-xs text-muted",
						children: [
							"اسم الملف يوحي بنوع «",
							systemLabel[filenameHint].ar,
							"»، لكن AI اعتمد على محتوى المستند وليس اسمه. راجع النتيجة إذا كنت غير متأكد."
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-[14px] border border-line bg-paper p-3.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BlockHeader, {
							title: "المشروع والعميل",
							hint: "يقترح AI الاسم والموقع بعد التحليل، ويمكنك تعديلهما.",
							aside: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex shrink-0 gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: projectMode === "new" ? "navy" : "outline",
									onClick: () => setProjectMode("new"),
									children: "مشروع جديد"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: projectMode === "existing" ? "navy" : "outline",
									onClick: () => setProjectMode("existing"),
									children: "مشروع موجود"
								})]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3",
							children: projectMode === "existing" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "max-w-md",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "اختر المشروع",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
										className: selectCls,
										value: projectId,
										onChange: (e) => setProjectId(e.target.value),
										children: store.projects.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
											value: p.id,
											children: [
												p.nameAr,
												" — ",
												p.name
											]
										}, p.id))
									})
								})
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 md:grid-cols-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "اسم المشروع",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											value: newProject.name,
											onChange: (e) => setNewProject({
												...newProject,
												name: e.target.value
											}),
											placeholder: "يُعبّأ من AI إن وُجد"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "الموقع",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											value: newProject.location,
											onChange: (e) => setNewProject({
												...newProject,
												location: e.target.value
											}),
											placeholder: "يُعبّأ من AI إن وُجد"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "اسم العميل / الجهة",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											value: newProject.clientName,
											onChange: (e) => setNewProject({
												...newProject,
												clientName: e.target.value
											}),
											placeholder: "يُعبّأ من AI إن وُجد"
										})
									})
								]
							})
						})]
					}),
					selectedSystemType === "elevators" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3 rounded-[16px] border border-line bg-paper p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-semibold",
								children: "مجموعات المصاعد"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted",
								children: "أضف مجموعة لكل جزء يُخدم بمصاعد منفصلة (L1 للطوابق السفلية، L2 للعلوية...). الكمية وFOB لكل مجموعة."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: addUnit,
								children: "+ إضافة مجموعة"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-2",
							children: units.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid items-end gap-2 md:grid-cols-[100px_1fr_110px_150px_auto]",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "الرمز",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													value: u.code,
													onChange: (e) => updateUnit(u.id, { code: e.target.value })
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "الوصف",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													value: u.description,
													onChange: (e) => updateUnit(u.id, { description: e.target.value })
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "العدد",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													type: "number",
													value: u.quantity,
													onChange: (e) => updateUnit(u.id, { quantity: Math.max(1, Number(e.target.value) || 1) })
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "FOB للوحدة",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													type: "number",
													value: u.fobUnit ?? "",
													placeholder: "غير محدد",
													onChange: (e) => updateUnit(u.id, {
														fobUnit: Number(e.target.value) > 0 ? Number(e.target.value) : void 0,
														fobSource: "explicit_fob"
													})
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "sm",
												variant: "ghost",
												disabled: units.length <= 1,
												onClick: () => removeUnit(u.id),
												children: "حذف"
											})
										]
									}),
									u.fobSource === "unlabeled_price" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[11px] text-amber-700",
										children: "السعر لم يُذكر صراحة أنه FOB في الكوتيشن — تأكد منه قبل الاعتماد."
									}) : null,
									!(u.fobUnit && u.fobUnit > 0) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[11px] text-muted",
										children: "لم يجد الذكاء الاصطناعي FOB لهذه المجموعة — أدخله هنا أو في ملف Excel."
									}) : null
								]
							}, u.id))
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
						className: "rounded-[14px] border border-line bg-paper px-3.5 py-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
							className: "cursor-pointer text-sm font-semibold",
							children: ["إدارة قوالب Word و Excel ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-normal text-muted",
								children: "— إضافة قالب لنظام جديد أو استبدال قالب قديم"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TemplateManager, {})
						})]
					})
				]
			}) : null,
			step === 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-5 rounded-[20px] border border-line bg-surface p-4",
				children: [
					aiFields.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4 rounded-[18px] border border-line bg-paper p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded-full bg-navy px-2.5 py-1 text-xs text-accent-fg",
										children: "AI REVIEW"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "font-semibold",
										children: "نتيجة تحليل الكوتيشن"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-muted",
									children: "يمكن تعديل أي قيمة قبل الاعتماد."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "sm",
										variant: reviewFilter === "all" ? "navy" : "outline",
										onClick: () => setReviewFilter("all"),
										children: [
											"الكل (",
											aiFields.length,
											")"
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "sm",
										variant: reviewFilter === "review" ? "navy" : "outline",
										onClick: () => setReviewFilter("review"),
										children: [
											"يحتاج مراجعة (",
											aiFields.filter((f) => f.confidence === "review").length,
											")"
										]
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid gap-3 md:grid-cols-2",
								children: aiFields.filter((f) => reviewFilter === "all" || f.confidence === "review").map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-[14px] border border-line bg-surface p-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-xs font-semibold",
												children: f.label
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: `text-[11px] ${f.confidence === "high" ? "text-accent" : f.confidence === "medium" ? "text-muted" : "text-red-600"}`,
												children: f.confidence === "high" ? "ثقة عالية" : f.confidence === "medium" ? "ثقة متوسطة" : "يحتاج مراجعة"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											value: f.value,
											onChange: (e) => updateAIField(f.key, e.target.value)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-1 text-[11px] text-muted",
											children: ["المصدر: ", f.source]
										})
									]
								}, f.key))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-surface p-3 text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									"✓ ",
									aiFields.filter((f) => f.confidence === "high").length,
									" حقول بثقة عالية · ",
									aiFields.filter((f) => f.confidence !== "high").length,
									" تحتاج انتباه"
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted",
									children: "لا يتم اعتماد البيانات تلقائيًا."
								})]
							})
						]
					}) : null,
					extraction ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-3 border-b border-line pb-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-semibold",
								children: "بيانات الكوتيشن المستخرجة"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted",
								children: "يمكن تعديل أي عنصر قبل التوليد."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-full bg-paper px-3 py-1 text-[11px] text-muted",
								children: extraction.systemLabel || extraction.systemType
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-3 md:grid-cols-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "نوع النظام",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										value: extraction.systemLabel || extraction.systemType,
										onChange: (e) => setExtraction({
											...extraction,
											systemLabel: e.target.value
										})
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "المشروع",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										value: extraction.project.name,
										onChange: (e) => setExtraction({
											...extraction,
											project: {
												...extraction.project,
												name: e.target.value
											}
										})
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "المورد",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										value: extraction.supplier,
										onChange: (e) => setExtraction({
											...extraction,
											supplier: e.target.value
										})
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "الإجمالي",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "number",
										value: extraction.commercial.grandTotal,
										onChange: (e) => setExtraction({
											...extraction,
											commercial: {
												...extraction.commercial,
												grandTotal: Number(e.target.value)
											}
										})
									})
								})
							]
						}),
						extraction.dynamicTables.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-semibold",
									children: "جداول الكوتيشن"
								}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "rounded-full bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent",
									children: [extraction.dynamicTables.length, " جدول"]
								})]
							}), extraction.dynamicTables.map((table) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "overflow-x-auto rounded-[16px] border border-line",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "border-b border-line bg-paper px-4 py-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "font-semibold",
											children: table.title
										}),
										table.description ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-1 text-xs text-muted",
											children: table.description
										}) : null,
										table.sourceSection ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-1 text-[11px] text-muted",
											children: ["المصدر: ", table.sourceSection]
										}) : null
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
									className: "w-full min-w-[760px] text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
										className: "border-b border-line bg-surface text-right text-xs text-muted",
										children: table.columns.map((column) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "p-2",
											children: column.label
										}, column.key))
									}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: table.rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
										className: "border-b border-line align-top",
										children: table.columns.map((column) => {
											const cell = row.cells.find((c) => c.key === column.key);
											return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													type: column.type === "number" || column.type === "currency" ? "number" : "text",
													value: cell?.value ?? "",
													onChange: (e) => updateDynamicTableCell(table.id, row.id, column.key, e.target.value)
												})
											}, column.key);
										})
									}, row.id)) })]
								})]
							}, table.id))]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-semibold",
								children: "بنود التسعير"
							}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "overflow-x-auto rounded-[16px] border border-line",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
									className: "w-full min-w-[980px] text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										className: "border-b border-line bg-paper text-right text-xs text-muted",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "الموقع"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "التصنيف"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "الوصف"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "الكمية"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "الوحدة"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "سعر الوحدة"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "p-2",
												children: "الإجمالي"
											})
										]
									}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: extraction.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										className: "border-b border-line align-top",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													value: item.location,
													onChange: (e) => updateExtractionItem(item.id, { location: e.target.value })
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													value: item.category,
													onChange: (e) => updateExtractionItem(item.id, { category: e.target.value })
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													value: item.description,
													onChange: (e) => updateExtractionItem(item.id, { description: e.target.value })
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													type: "number",
													value: item.quantity,
													onChange: (e) => updateExtractionItem(item.id, { quantity: Number(e.target.value) })
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													value: item.unit,
													onChange: (e) => updateExtractionItem(item.id, { unit: e.target.value })
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													type: "number",
													value: item.unitPrice,
													onChange: (e) => updateExtractionItem(item.id, {
														unitPrice: Number(e.target.value),
														total: Number(e.target.value) * item.quantity
													})
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "p-2",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													type: "number",
													value: item.total,
													onChange: (e) => updateExtractionItem(item.id, { total: Number(e.target.value) })
												})
											})
										]
									}, item.id)) })]
								})
							})]
						}),
						extraction.generalSpecifications.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid gap-3 md:grid-cols-2",
							children: extraction.generalSpecifications.map((sp, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: sp.key,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: sp.value,
									onChange: (e) => setExtraction({
										...extraction,
										generalSpecifications: extraction.generalSpecifications.map((v, j) => j === i ? {
											...v,
											value: e.target.value
										} : v)
									})
								})
							}, `${sp.key}-${i}`))
						}) : null
					] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-3 border-b border-line pb-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-semibold",
									children: "المواصفات الفنية"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-muted",
									children: "أضف أي مواصفة تريدها — لا يوجد قالب حقول ثابت لأي نظام، حتى المصاعد."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "outline",
									onClick: () => setSpecs([...specs, {
										key: `spec_${specs.length + 1}`,
										label: "",
										value: ""
									}]),
									children: "+ إضافة مواصفة"
								})]
							}),
							specs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "rounded-[12px] border border-dashed border-line p-4 text-center text-xs text-muted",
								children: "لا توجد مواصفات بعد. ارفع كوتيشن ليقوم AI باستخراجها تلقائياً، أو أضفها يدوياً."
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid gap-3 md:grid-cols-2",
								children: specs.map((sp, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-end gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "اسم المواصفة",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												value: sp.label,
												onChange: (e) => setSpecs(specs.map((v, j) => j === i ? {
													...v,
													label: e.target.value,
													key: e.target.value || v.key
												} : v))
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "القيمة",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												value: sp.value,
												onChange: (e) => setSpecs(specs.map((v, j) => j === i ? {
													...v,
													value: e.target.value
												} : v))
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "sm",
											variant: "ghost",
											onClick: () => setSpecs(specs.filter((_, j) => j !== i)),
											children: "حذف"
										})
									]
								}, i))
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold",
						children: "التسعير المرن"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "سعر/قيمة الوحدة (USD)",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "number",
									readOnly: groupFobMode,
									value: groupFobMode ? Math.round(fobTotal / Math.max(1, effectiveQty)) : fob,
									onChange: (e) => setFob(Number(e.target.value))
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "الكمية",
								children: units.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									readOnly: true,
									value: effectiveQty
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "number",
									value: qty,
									onChange: (e) => {
										const v = Math.max(1, Number(e.target.value) || 1);
										setQty(v);
										if (units.length === 1) updateUnit(units[0].id, { quantity: v });
									}
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "إجمالي FOB",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									readOnly: true,
									value: fobTotal
								})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full min-w-[640px] text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-line text-right text-xs text-muted",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2",
										children: "البند"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "النوع" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "القيمة" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "المبلغ" })
								]
							}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: costLines.map((line) => {
								const amount = pricing.lineAmounts.find((a) => a.id === line.id)?.amount ?? 0;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "border-b border-line",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "py-2",
											children: line.labelAr
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											className: "h-9 rounded-[8px] border border-line px-2",
											value: line.mode,
											onChange: (e) => setCostLines(costLines.map((l) => l.id === line.id ? {
												...l,
												mode: e.target.value
											} : l)),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "fixed",
												children: "مبلغ"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "percent",
												children: "نسبة %"
											})]
										}) }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											type: "number",
											value: line.value,
											onChange: (e) => setCostLines(costLines.map((l) => l.id === line.id ? {
												...l,
												value: Number(e.target.value)
											} : l))
										}) }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "tabular-nums",
											children: formatMoney(amount)
										})
									]
								}, line.id);
							}) })]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-[16px] bg-paper p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted",
									children: "تكلفة التشغيل"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-lg font-medium tabular-nums",
									children: formatMoney(pricing.operating)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "طريقة تحديد سعر البيع",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									className: "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm",
									value: pricingMode,
									onChange: (e) => setPricingMode(e.target.value),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "calculated",
										children: "محسوب من التكلفة"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "manual",
										children: "إدخال يدوي"
									})]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: pricingMode === "manual" ? "سعر البيع النهائي يدويًا" : "سعر البيع النهائي (اضغط واكتب للتعديل)",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "number",
									inputMode: "decimal",
									min: 0,
									className: "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
									value: pricingMode === "manual" ? sellingOverride : sellingOverride || pricing.selling,
									onChange: (e) => setSellingOverride(Number(e.target.value))
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-[16px] bg-navy p-3 text-accent-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs opacity-80",
									children: "الربح التقديري"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-lg font-medium tabular-nums",
									children: formatMoney((sellingOverride || pricing.selling) - pricing.operating)
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "دفعة مقدمة %",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "number",
									value: payment.advance,
									onChange: (e) => setPayment({
										...payment,
										advance: Number(e.target.value)
									})
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "قبل الشحن %",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "number",
									value: payment.shipping,
									onChange: (e) => setPayment({
										...payment,
										shipping: Number(e.target.value)
									})
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "عند التسليم %",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									type: "number",
									value: payment.handover,
									onChange: (e) => setPayment({
										...payment,
										handover: Number(e.target.value)
									})
								})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: confirmed,
							onChange: (e) => setConfirmed(e.target.checked)
						}), "أكّدت مراجعة المواصفات والتسعير، وأسمح بتوليد الملفين."]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => setStep(0),
							children: "رجوع للكوتيشن"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							disabled: !confirmed,
							onClick: () => setStep(2),
							children: "إلى التوليد"
						})]
					})
				]
			}) : null,
			step === 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-4 rounded-[20px] border border-line bg-surface p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: "سيتم توليد ملفين من بيانات العرض التي راجعتها واعتمدتها، بالاعتماد على قوالب FAAT المعتمدة وليس بتأليف حر:"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "list-disc pr-5 text-sm text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "عرض Word فني ومالي — يُملأ داخل القالب المعتمد (Master Template)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Excel داخلي للتسعير — للمصاعد والسلالم والممرات المتحركة يُملأ داخل ملف CCS الأصلي (الكمية وFOB لكل مجموعة فقط، والمعادلات كما هي)، وغير ذلك يُبنى ديناميكياً من بيانات الكوتيشن" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-[16px] bg-paper p-4 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["القيمة التعاقدية: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
							className: "tabular-nums",
							children: formatMoney(sellingOverride || pricing.selling)
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["تكلفة داخلية: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular-nums",
							children: formatMoney(fobTotal)
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => setStep(1),
							children: "رجوع للمراجعة"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							disabled: generating,
							onClick: () => void generate(),
							children: generating ? "جار التوليد…" : "تأكيد وتوليد الملفات"
						})]
					})
				]
			}) : null
		]
	});
}
//#endregion
export { NewProposal as component };
