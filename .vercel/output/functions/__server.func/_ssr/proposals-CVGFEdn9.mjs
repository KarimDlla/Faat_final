import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useAppStore, n as formatMoney } from "./store-BmABQmXm.mjs";
import { i as Plus, r as Search } from "../_libs/lucide-react.mjs";
import { t as StatusBadge } from "./badge-BrelcX68.mjs";
import { r as systemLabel, t as Button } from "./labels-DcR_-vm5.mjs";
import { n as Input } from "./input-_x8AQeNh.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/proposals-CVGFEdn9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ProposalsPage() {
	const proposals = useAppStore((s) => s.proposals);
	const projects = useAppStore((s) => s.projects);
	const clients = useAppStore((s) => s.clients);
	const [q, setQ] = (0, import_react.useState)("");
	const [filter, setFilter] = (0, import_react.useState)("all");
	const rows = (0, import_react.useMemo)(() => {
		return proposals.filter((p) => {
			if (filter !== "all" && p.status !== filter) return false;
			const project = projects.find((x) => x.id === p.projectId);
			const client = clients.find((x) => x.id === p.clientId);
			return `${p.number} ${project?.name} ${project?.nameAr} ${client?.name} ${client?.nameAr}`.toLowerCase().includes(q.toLowerCase());
		});
	}, [
		proposals,
		projects,
		clients,
		q,
		filter
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold",
					children: "العروض"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "ابدأ من عرض موجود أو أنشئ عرضاً جديداً من كوتيشن المورد."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/proposals/new",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " عرض جديد"]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 md:flex-row md:items-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-3 right-3 size-4 text-subtle" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "pr-10",
						placeholder: "بحث برقم العرض أو المشروع أو العميل",
						value: q,
						onChange: (e) => setQ(e.target.value)
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						{
							id: "all",
							label: "الكل"
						},
						{
							id: "draft",
							label: "مسودة"
						},
						{
							id: "sent",
							label: "مرسل"
						},
						{
							id: "under_review",
							label: "تحت المراجعة"
						},
						{
							id: "accepted",
							label: "مقبول"
						}
					].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setFilter(c.id),
						className: `h-9 rounded-full px-3 text-xs ${filter === c.id ? "bg-navy text-accent-fg" : "bg-surface border border-line"}`,
						children: c.label
					}, c.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "overflow-hidden rounded-[20px] border border-line bg-surface",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "hidden grid-cols-12 gap-2 border-b border-line bg-paper px-4 py-2 text-xs text-muted md:grid",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-2",
								children: "رقم العرض"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-3",
								children: "المشروع"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-2",
								children: "العميل"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-1",
								children: "النظام"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-2",
								children: "القيمة"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "col-span-2",
								children: "الحالة"
							})
						]
					}),
					rows.map((p) => {
						const project = projects.find((x) => x.id === p.projectId);
						const client = clients.find((x) => x.id === p.clientId);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/proposals/$proposalId",
							params: { proposalId: p.id },
							className: "grid grid-cols-1 gap-1 border-b border-line px-4 py-3 last:border-0 hover:bg-paper md:grid-cols-12 md:items-center md:gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "col-span-2 text-sm font-medium",
									children: [p.number, p.revision > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "mr-1 text-xs text-muted",
										children: ["Rev ", p.revision]
									}) : null]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "col-span-3 text-sm",
									children: project?.nameAr ?? project?.name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "col-span-2 text-sm text-muted",
									children: client?.nameAr ?? client?.name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "col-span-1 text-xs",
									children: systemLabel[p.systemType].ar
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "col-span-2 text-sm tabular-nums",
									children: formatMoney(p.sellingPrice, p.currency)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "col-span-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: p.status })
								})
							]
						}, p.id);
					}),
					rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-4 py-10 text-center text-sm text-muted",
						children: "لا توجد عروض مطابقة."
					}) : null
				]
			})
		]
	});
}
//#endregion
export { ProposalsPage as component };
