import { n as create, t as persist } from "../_libs/zustand.mjs";
import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/store-BmABQmXm.js
function seedData() {
	return {
		currencies: [{
			code: "USD",
			name: "US Dollar",
			symbol: "$",
			rateToUSD: 1
		}, {
			code: "EUR",
			name: "Euro",
			symbol: "€",
			rateToUSD: 1.08
		}],
		salesManager: "",
		salesManagers: [],
		clients: [],
		projects: [],
		opportunities: [],
		proposals: []
	};
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatMoney(value, currency = "USD") {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		maximumFractionDigits: 0
	}).format(value || 0);
}
function uid(prefix = "id") {
	return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}
function nextProposalNumber(existing) {
	const years = (/* @__PURE__ */ new Date()).getFullYear().toString().slice(-2);
	const nums = existing.map((n) => {
		const m = n.match(/FAAT-(\d+)-(\d+)/);
		return m ? Number(m[2]) : 0;
	}).filter(Boolean);
	return `FAAT-${years}-${(Math.max(0, ...nums) + 1).toString().padStart(4, "0")}`;
}
var useAppStore = create()(persist((set, get) => ({
	...seedData(),
	hydrated: false,
	setHydrated: (v) => set({ hydrated: v }),
	resetDemo: () => set({ ...seedData() }),
	addClient: (c) => {
		const id = uid("c");
		set({ clients: [...get().clients, {
			...c,
			id
		}] });
		return id;
	},
	updateClient: (id, patch) => set({ clients: get().clients.map((c) => c.id === id ? {
		...c,
		...patch
	} : c) }),
	addProject: (p) => {
		const id = uid("p");
		set({ projects: [...get().projects, {
			...p,
			id
		}] });
		return id;
	},
	addProposal: (p) => set({ proposals: [p, ...get().proposals] }),
	updateProposal: (id, patch) => set({ proposals: get().proposals.map((p) => p.id === id ? {
		...p,
		...patch,
		updatedAt: (/* @__PURE__ */ new Date()).toISOString()
	} : p) }),
	setProposalStatus: (id, status) => set({ proposals: get().proposals.map((p) => p.id === id ? {
		...p,
		status,
		updatedAt: (/* @__PURE__ */ new Date()).toISOString()
	} : p) }),
	setSalesManager: (name) => set({ salesManager: name }),
	updateCurrency: (code, patch) => set({ currencies: get().currencies.map((c) => c.code === code ? {
		...c,
		...patch
	} : c) }),
	createRevision: (id) => {
		const src = get().proposals.find((p) => p.id === id);
		if (!src) return null;
		const newId = uid("pr");
		set({ proposals: [{
			...src,
			id: newId,
			parentId: src.id,
			revision: src.revision + 1,
			status: "draft",
			files: [],
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}, ...get().proposals.map((p) => p.id === id ? {
			...p,
			status: "superseded"
		} : p)] });
		return newId;
	}
}), {
	name: "faat-proposal-v2",
	skipHydration: true,
	partialize: (s) => ({
		clients: s.clients,
		projects: s.projects,
		opportunities: s.opportunities,
		proposals: s.proposals,
		currencies: s.currencies,
		salesManager: s.salesManager,
		salesManagers: s.salesManagers
	})
}));
//#endregion
export { useAppStore as a, uid as i, formatMoney as n, nextProposalNumber as r, cn as t };
