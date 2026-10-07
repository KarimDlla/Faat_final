import "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { S as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as cn } from "./store-BmABQmXm.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
require_react();
var import_jsx_runtime = require_jsx_runtime();
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-opacity duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4", {
	variants: {
		variant: {
			default: "bg-accent text-accent-fg hover:opacity-90",
			navy: "bg-navy text-accent-fg hover:opacity-90",
			outline: "border border-line bg-surface text-ink hover:bg-paper",
			ghost: "text-ink hover:bg-paper",
			danger: "bg-danger text-accent-fg hover:opacity-90"
		},
		size: {
			default: "h-10 px-4",
			sm: "h-8 px-3 text-xs",
			lg: "h-11 px-5",
			icon: "size-10"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		...props
	});
}
var systemLabel = {
	elevators: {
		ar: "مصاعد",
		en: "Elevators"
	},
	chiller: {
		ar: "تشيلر مركزي",
		en: "Chiller"
	},
	hvac: {
		ar: "تكييف",
		en: "HVAC"
	},
	vrf: {
		ar: "نظام VRF",
		en: "VRF"
	},
	bms: {
		ar: "إدارة المباني",
		en: "BMS"
	},
	smoke: {
		ar: "إطفاء ودخان",
		en: "Smoke Mgmt."
	},
	escalators: {
		ar: "سلالم كهربائية",
		en: "Escalators"
	},
	other: {
		ar: "نظام مخصص",
		en: "Custom System"
	}
};
var statusLabel = {
	draft: "مسودة",
	review: "قيد المراجعة الداخلية",
	sent: "مرسل",
	under_review: "تحت مراجعة العميل",
	revision_required: "يحتاج تعديل",
	accepted: "مقبول",
	rejected: "مرفوض",
	expired: "منتهي",
	superseded: "نسخة سابقة"
};
//#endregion
export { statusLabel as n, systemLabel as r, Button as t };
