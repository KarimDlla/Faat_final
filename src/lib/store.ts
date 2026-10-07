import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppData, Client, Project, Proposal, ProposalStatus } from "./types";
import { seedData } from "./seed";
import { uid } from "./utils";

type Store = AppData & {
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  resetDemo: () => void;
  addClient: (c: Omit<Client, "id">) => string;
  updateClient: (id: string, patch: Partial<Client>) => void;
  addProject: (p: Omit<Project, "id">) => string;
  addProposal: (p: Proposal) => void;
  updateProposal: (id: string, patch: Partial<Proposal>) => void;
  setProposalStatus: (id: string, status: ProposalStatus) => void;
  createRevision: (id: string) => string | null;
  setSalesManager: (name: string) => void;
  updateCurrency: (code: string, patch: Partial<AppData["currencies"][number]>) => void;
};

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      ...seedData(),
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      resetDemo: () => set({ ...seedData() }),
      addClient: (c) => {
        const id = uid("c");
        set({ clients: [...get().clients, { ...c, id }] });
        return id;
      },
      updateClient: (id, patch) => set({ clients: get().clients.map((c) => c.id === id ? { ...c, ...patch } : c) }),
      addProject: (p) => {
        const id = uid("p");
        set({ projects: [...get().projects, { ...p, id }] });
        return id;
      },
          addProposal: (p) => set({ proposals: [p, ...get().proposals] }),
      updateProposal: (id, patch) =>
        set({
          proposals: get().proposals.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
          ),
        }),
      setProposalStatus: (id, status) =>
        set({
          proposals: get().proposals.map((p) =>
            p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p,
          ),
        }),
      setSalesManager: (name) => set({ salesManager: name }),
      updateCurrency: (code, patch) => set({ currencies: get().currencies.map((c) => c.code === code ? { ...c, ...patch } : c) }),
      createRevision: (id) => {
        const src = get().proposals.find((p) => p.id === id);
        if (!src) return null;
        const newId = uid("pr");
        const rev: Proposal = {
          ...src,
          id: newId,
          parentId: src.id,
          revision: src.revision + 1,
          status: "draft",
          files: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set({
          proposals: [
            rev,
            ...get().proposals.map((p) => (p.id === id ? { ...p, status: "superseded" as const } : p)),
          ],
        });
        return newId;
      },
    }),
    {
      name: "faat-proposal-v2",
      skipHydration: true,
      partialize: (s) => ({
        clients: s.clients,
        projects: s.projects,
        opportunities: s.opportunities,
        proposals: s.proposals,
        currencies: s.currencies,
        salesManager: s.salesManager,
        salesManagers: s.salesManagers,
      }),
    },
  ),
);
