import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as cn } from "./store-BmABQmXm.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-BrelcX68.js
var import_jsx_runtime = require_jsx_runtime();
function Badge({ className, tone = "neutral", children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", {
			neutral: "bg-paper text-muted",
			ok: "bg-[#e8f7ee] text-ok",
			warn: "bg-[#fef4e6] text-warn",
			danger: "bg-[#fdeaea] text-danger",
			navy: "bg-[#e8eef5] text-navy",
			accent: "bg-[#eaf3e2] text-accent"
		}[tone], className),
		children
	});
}
function StatusBadge({ status }) {
	const m = {
		draft: {
			tone: "neutral",
			label: "مسودة"
		},
		review: {
			tone: "navy",
			label: "مراجعة داخلية"
		},
		sent: {
			tone: "accent",
			label: "مرسل"
		},
		under_review: {
			tone: "warn",
			label: "تحت المراجعة"
		},
		revision_required: {
			tone: "warn",
			label: "يحتاج تعديل"
		},
		accepted: {
			tone: "ok",
			label: "مقبول"
		},
		rejected: {
			tone: "danger",
			label: "مرفوض"
		},
		expired: {
			tone: "neutral",
			label: "منتهي"
		},
		superseded: {
			tone: "neutral",
			label: "نسخة سابقة"
		}
	}[status];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		tone: m.tone,
		children: m.label
	});
}
//#endregion
export { StatusBadge as t };
