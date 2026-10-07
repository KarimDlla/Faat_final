import type { SystemType } from "./types";
import type { CellMapEntry } from "./xlsx-fill";
import type { TemplateKind } from "./template-defaults";

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Template registry. A "slot" is (system type × Word/Excel). Each slot can hold several uploaded
// versions; at most one is active. With no active version the app falls back to the built-in template
// in public/templates — so nothing changes until someone uploads something.
//
// Storage is behind the TemplateStore interface. Today: IndexedDB in this browser only (templates are
// NOT shared between devices/users). When the MEPSOL backend exists, write a server-backed TemplateStore
// with the same methods and change the one `templateStore` export below — no other file changes.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export type TemplateMode = "tokens" | "ccs";

export type TemplateRecord = {
  id: string;
  systemType: SystemType;
  kind: TemplateKind;
  mode: TemplateMode;
  fileName: string;
  version: number;
  uploadedAt: string;
  size: number;
  active: boolean;
  /** Names found inside the file at upload time (for the history view). */
  tokensFound: string[];
  /** Optional Excel cell map (JSON) uploaded together with the workbook. */
  cellMap?: CellMapEntry[];
  data: ArrayBuffer;
};

export type NewTemplate = Omit<TemplateRecord, "id" | "version" | "uploadedAt" | "active" | "size">;

export interface TemplateStore {
  /** Every stored version, newest first. */
  list(): Promise<TemplateRecord[]>;
  getActive(systemType: SystemType, kind: TemplateKind): Promise<TemplateRecord | null>;
  /** Saves as the next version of its slot and makes it the active one. */
  save(input: NewTemplate): Promise<TemplateRecord>;
  activate(id: string): Promise<void>;
  /** No custom version active → built-in template is used again. Versions are kept. */
  useDefault(systemType: SystemType, kind: TemplateKind): Promise<void>;
  remove(id: string): Promise<void>;
}

const DB_NAME = "faat-templates";
const STORE = "templates";
const KEEP_VERSIONS_PER_SLOT = 5;

const available = () => typeof indexedDB !== "undefined";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: "id" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("تعذر فتح مخزن القوالب"));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    let result: T | undefined;
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error("فشلت عملية حفظ القالب")); };
  });
}

const all = async (): Promise<TemplateRecord[]> => ((await run<TemplateRecord[]>("readonly", (s) => s.getAll())) ?? []).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
const put = (rec: TemplateRecord) => run("readwrite", (s) => { s.put(rec); });
const del = (id: string) => run("readwrite", (s) => { s.delete(id); });
const sameSlot = (a: Pick<TemplateRecord, "systemType" | "kind">, b: Pick<TemplateRecord, "systemType" | "kind">) => a.systemType === b.systemType && a.kind === b.kind;

export const indexedDbTemplateStore: TemplateStore = {
  async list() { return available() ? all() : []; },

  async getActive(systemType, kind) {
    if (!available()) return null;
    return (await all()).find((r) => r.active && r.systemType === systemType && r.kind === kind) ?? null;
  },

  async save(input) {
    if (!available()) throw new Error("هذا المتصفح لا يدعم التخزين المحلي للقوالب (IndexedDB)");
    const existing = (await all()).filter((r) => sameSlot(r, input));
    const rec: TemplateRecord = {
      ...input,
      id: `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      version: Math.max(0, ...existing.map((r) => r.version)) + 1,
      uploadedAt: new Date().toISOString(),
      size: input.data.byteLength,
      active: true,
    };
    for (const r of existing.filter((x) => x.active)) await put({ ...r, active: false });
    await put(rec);
    // Keep the newest few versions per slot (the active one is always the newest here).
    const stale = [...existing].sort((a, b) => b.version - a.version).slice(KEEP_VERSIONS_PER_SLOT - 1);
    for (const r of stale) await del(r.id);
    return rec;
  },

  async activate(id) {
    const rows = await all();
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    for (const r of rows.filter((x) => sameSlot(x, target) && x.active && x.id !== id)) await put({ ...r, active: false });
    await put({ ...target, active: true });
  },

  async useDefault(systemType, kind) {
    for (const r of (await all()).filter((x) => x.active && x.systemType === systemType && x.kind === kind)) await put({ ...r, active: false });
  },

  async remove(id) { await del(id); },
};

/** The one place that decides where templates live. Swap this for a server-backed store later. */
export const templateStore: TemplateStore = indexedDbTemplateStore;
