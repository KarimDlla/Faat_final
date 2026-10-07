import { S as require_jsx_runtime, x as useNavigate, y as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { a as useAppStore, n as formatMoney } from "./_ssr/store-BmABQmXm.mjs";
import { n as Route$1 } from "./_ssr/router-YoIebNk5.mjs";
import { t as StatusBadge } from "./_ssr/badge-BrelcX68.mjs";
import { n as statusLabel, r as systemLabel, t as Button } from "./_ssr/labels-DcR_-vm5.mjs";
import { n as toast, t as Toaster } from "./_libs/sonner.mjs";
import { c as generateAll, i as computePricing } from "./_ssr/documents-QZpdkq-M.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_proposalId-BQrgaLkV.js
var import_jsx_runtime = require_jsx_runtime();
function ProposalDetail() {
	const { proposalId } = Route$1.useParams();
	const nav = useNavigate();
	const proposal = useAppStore((s) => s.proposals.find((p) => p.id === proposalId));
	const project = useAppStore((s) => s.projects.find((p) => p.id === proposal?.projectId));
	const client = useAppStore((s) => s.clients.find((c) => c.id === proposal?.clientId));
	const setStatus = useAppStore((s) => s.setProposalStatus);
	const createRevision = useAppStore((s) => s.createRevision);
	const updateProposal = useAppStore((s) => s.updateProposal);
	if (!proposal || !project || !client) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "text-sm text-muted",
		children: ["العرض غير موجود. ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/proposals",
			className: "text-accent",
			children: "العودة"
		})]
	});
	const current = proposal;
	const currentProject = project;
	const currentClient = client;
	const pricing = computePricing(current.fob, current.costLines, current.sellingPrice);
	async function regen() {
		try {
			const files = await generateAll(current, currentProject, currentClient);
			const now = (/* @__PURE__ */ new Date()).toISOString();
			updateProposal(current.id, { files: [{
				kind: "docx",
				name: files.docx,
				generatedAt: now
			}, {
				kind: "xlsx",
				name: files.xlsx,
				generatedAt: now
			}] });
			toast.success("تم إعادة توليد الملفين");
		} catch (e) {
			console.error(e);
			toast.error(e instanceof Error ? `تعذر التوليد: ${e.message}` : "تعذر التوليد");
		}
	}
	function revision() {
		const id = createRevision(current.id);
		if (id) nav({
			to: "/proposals/$proposalId",
			params: { proposalId: id }
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
				position: "top-center",
				dir: "rtl"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 md:flex-row md:items-start md:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-xs text-muted",
						children: [
							proposal.number,
							" ",
							proposal.revision > 0 ? `· Rev ${proposal.revision}` : ""
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-xl font-semibold",
						children: project.nameAr
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							client.nameAr,
							" · ",
							project.location,
							" · ",
							systemLabel[proposal.systemType].ar
						]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: proposal.status }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							onClick: revision,
							children: "نسخة جديدة (Revision)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => void regen(),
							children: "إعادة توليد الملفات"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 md:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-[20px] border border-line bg-surface p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted",
							children: "القيمة التعاقدية"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-2xl font-medium tabular-nums",
							children: formatMoney(proposal.sellingPrice, proposal.currency)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-[20px] border border-line bg-surface p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted",
							children: "FOB"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-2xl font-medium tabular-nums",
							children: formatMoney(proposal.fob, proposal.currency)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-[20px] border border-line bg-surface p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted",
							children: "تكلفة التشغيل / الربح"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-2xl font-medium tabular-nums",
							children: [
								formatMoney(pricing.operating),
								" / ",
								formatMoney(proposal.sellingPrice - pricing.operating)
							]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-[20px] border border-line bg-surface p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mb-3 text-sm font-semibold",
					children: "الحالة"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						"draft",
						"review",
						"sent",
						"under_review",
						"accepted",
						"rejected"
					].map((st) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: current.status === st ? "navy" : "outline",
						onClick: () => setStatus(current.id, st),
						children: statusLabel[st]
					}, st))
				})]
			}),
			proposal.units?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-[20px] border border-line bg-surface p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3 mb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold",
						children: "مجموعات العرض"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "كل مجموعة مستقلة ويمكن ربطها بكوتيشن المورد."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs text-muted",
						children: [proposal.units?.length ?? 1, " مجموعات"]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-2",
					children: proposal.units.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 rounded-[12px] bg-paper p-3 md:grid-cols-[90px_1fr_100px_1fr] md:items-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-semibold",
								children: u.code
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-sm",
								children: u.description
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-sm tabular-nums",
								children: [u.quantity, " وحدة"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-muted",
								children: u.specs.slice(0, 3).map((s) => `${s.label || s.key}: ${s.value}`).join(" · ") || "لا توجد مواصفات"
							})
						]
					}, u.id))
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-[20px] border border-line bg-surface p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mb-3 text-sm font-semibold",
						children: "البيانات التي فهمها AI"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-4 grid gap-2 md:grid-cols-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl bg-paper p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted",
									children: "نوع النظام"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-medium",
									children: proposal.extraction?.systemLabel || systemLabel[proposal.systemType].ar
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl bg-paper p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted",
									children: "العناصر"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-medium",
									children: proposal.extraction?.items.length ?? 0
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-xl bg-paper p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted",
									children: "الجداول الديناميكية"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-medium",
									children: proposal.extraction?.dynamicTables.length ?? 0
								})]
							})
						]
					}),
					proposal.extraction?.projectStructure.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mb-4 space-y-2",
						children: proposal.extraction.projectStructure.map((section) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl bg-paper p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-medium",
								children: section.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-muted mt-1",
								children: section.summary
							})]
						}, section.id))
					}) : null,
					proposal.extraction?.dynamicTables.map((table) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-4 overflow-x-auto rounded-xl border border-line",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "bg-paper px-3 py-2 font-medium",
							children: table.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full min-w-[620px] text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: table.columns.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "border-t border-line px-3 py-2 text-right font-medium",
								children: c.label
							}, c.key)) }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: table.rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: table.columns.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "border-t border-line px-3 py-2",
								children: row.cells.find((cell) => cell.key === c.key)?.value ?? ""
							}, c.key)) }, row.id)) })]
						})]
					}, table.id))
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-[20px] border border-line bg-surface p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mb-3 text-sm font-semibold",
						children: "كوتيشن المورد"
					}),
					(proposal.supplierQuotations ?? []).map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-[12px] bg-paper p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-medium",
										children: q.supplier
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-sm",
										children: q.quoteNumber
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-xs text-muted",
										children: [
											"Rev ",
											q.activeRevision,
											" · ",
											q.revisions.length,
											" نسخة"
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-3 grid gap-2 md:grid-cols-3",
								children: (proposal.units ?? []).filter((u) => q.units.includes(u.id)).map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-lg border border-line bg-surface px-3 py-2 text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-semibold",
										children: u.code
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-muted",
										children: u.description
									})]
								}, u.id))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["الحالة الحالية: ", q.revisions[q.activeRevision]?.status ?? "—"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["المصدر: ", q.revisions[q.activeRevision]?.sourceName ?? "—"] })]
							})
						]
					}, q.id)),
					!proposal.supplierQuotations || proposal.supplierQuotations.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "لا يوجد كوتيشن مورد مسجل لهذا العرض القديم."
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-[20px] border border-line bg-surface p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mb-3 text-sm font-semibold",
					children: "الملفات المولَّدة"
				}), proposal.files.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "لا توجد ملفات بعد. اضغط إعادة التوليد لتنزيل Word و Excel."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "space-y-2 text-sm",
					children: proposal.files.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex justify-between rounded-[12px] bg-paper px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: f.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted",
							children: f.kind.toUpperCase()
						})]
					}, f.kind))
				})]
			}),
			proposal.specs.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-[20px] border border-line bg-surface p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mb-3 text-sm font-semibold",
					children: "المواصفات"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-2 md:grid-cols-2",
					children: proposal.specs.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between gap-3 border-b border-line py-1 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted",
							children: s.label || s.key
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: s.value || "—" })]
					}, `${s.key}-${i}`))
				})]
			}) : null
		]
	});
}
//#endregion
export { ProposalDetail as component };
