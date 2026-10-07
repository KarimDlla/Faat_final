import { i as __toESM } from "./_runtime.mjs";
import { n as require_react } from "./_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime, f as useRouterState, h as Outlet, y as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { a as useAppStore, t as cn } from "./_ssr/store-BmABQmXm.mjs";
import { a as Menu, i as Plus, o as FileText, r as Search, s as ArrowUpLeft, t as X } from "./_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app-C3jhNeIO.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var nav = [{
	to: "/proposals",
	label: "العروض",
	icon: FileText
}, {
	to: "/proposals/new",
	label: "إنشاء عرض جديد",
	icon: Plus
}];
function AppShell({ children }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [open, setOpen] = (0, import_react.useState)(false);
	const setHydrated = useAppStore((s) => s.setHydrated);
	const proposals = useAppStore((s) => s.proposals);
	const salesManager = useAppStore((s) => s.salesManager);
	const displayName = salesManager || "غير محدد";
	const initials = salesManager ? salesManager.split(" ").map((p) => p[0]).slice(0, 2).join("") : "—";
	const [query, setQuery] = (0, import_react.useState)("");
	const results = query.trim() ? proposals.filter((p) => p.number.toLowerCase().includes(query.toLowerCase())).slice(0, 8).map((p) => ({
		type: "عرض",
		label: p.number,
		to: `/proposals/${p.id}`
	})) : [];
	const limitedResults = results.slice(0, 8);
	(0, import_react.useEffect)(() => {
		useAppStore.persist.rehydrate();
		setHydrated(true);
	}, [setHydrated]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-ink",
		dir: "rtl",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: cn("fixed inset-y-0 start-0 z-40 flex w-72 flex-col bg-navy text-accent-fg shadow-xl", open ? "flex" : "hidden lg:flex"),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "border-b border-white/10 px-5 py-5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[11px] font-semibold tracking-[0.28em] text-accent-2",
								children: "FAAT"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 text-lg font-semibold",
								children: "فات للهندسة"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-0.5 text-xs text-white/55",
								children: "Proposal Generator"
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "rounded-md p-2 text-white/70 hover:bg-navy-2 hover:text-white lg:hidden",
							onClick: () => setOpen(false),
							"aria-label": "إغلاق",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-4 pt-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mb-2 px-2 text-[11px] font-medium text-white/40",
						children: "إنشاء العروض"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "flex flex-col gap-1",
						children: nav.map((item) => {
							const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
							const Icon = item.icon;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: item.to,
								onClick: () => setOpen(false),
								className: cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors", active ? "bg-navy-2 text-white" : "text-white/65 hover:bg-navy-2 hover:text-white"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-[18px]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label })]
							}, item.to);
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-auto border-t border-white/10 p-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 rounded-lg bg-white/5 p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-fg",
							children: initials
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-sm font-medium text-white",
								children: displayName
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-white/45",
								children: "منشئ العروض"
							})]
						})]
					})
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "lg:ps-72",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "rounded-md p-2 hover:bg-paper lg:hidden",
						onClick: () => setOpen(true),
						"aria-label": "القائمة",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative hidden max-w-md flex-1 md:block",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute right-3 top-3 size-4 text-subtle" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: query,
								onChange: (e) => setQuery(e.target.value),
								className: "h-10 w-full rounded-lg border border-line bg-paper pr-10 pl-3 text-sm outline-none placeholder:text-subtle focus:border-accent",
								placeholder: "بحث سريع في العروض"
							}),
							query.trim() ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "absolute start-0 end-0 top-12 z-50 overflow-hidden rounded-xl border border-line bg-surface shadow-xl",
								children: results.length ? limitedResults.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: r.to,
									onClick: () => setQuery(""),
									className: "flex items-center justify-between border-b border-line px-4 py-3 last:border-0 hover:bg-paper",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-sm font-medium",
										children: r.label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[11px] text-muted",
										children: r.type
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpLeft, { className: "size-4 text-subtle" })]
								}, `${r.type}-${r.to}-${i}`)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "p-4 text-sm text-muted",
									children: "لا توجد نتائج."
								})
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ms-auto flex items-center gap-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted",
							children: "منشئ العروض"
						})
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "mx-auto max-w-[1500px] p-4 md:p-6 xl:p-8",
				children
			})]
		})]
	});
}
function Layout() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) });
}
//#endregion
export { Layout as component };
