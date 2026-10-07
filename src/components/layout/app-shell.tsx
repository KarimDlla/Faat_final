import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, Menu, Plus, Search, X, ArrowUpLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/proposals", label: "العروض", icon: FileText },
  { to: "/proposals/new", label: "إنشاء عرض جديد", icon: Plus },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const setHydrated = useAppStore((s) => s.setHydrated);
  const proposals = useAppStore((s) => s.proposals);
  const salesManager = useAppStore((s) => s.salesManager);
  const displayName = salesManager || "غير محدد";
  const initials = salesManager ? salesManager.split(" ").map((p) => p[0]).slice(0, 2).join("") : "—";
  const [query, setQuery] = useState("");
  const results = query.trim() ? proposals
    .filter((p) => p.number.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)
    .map((p) => ({ type: "عرض", label: p.number, to: `/proposals/${p.id}` })) : [];
  const limitedResults = results.slice(0, 8);

  useEffect(() => {
    void useAppStore.persist.rehydrate();
    setHydrated(true);
  }, [setHydrated]);

  return (
    <div className="min-h-dvh bg-bg text-ink" dir="rtl">
      <aside className={cn("fixed inset-y-0 start-0 z-40 flex w-72 flex-col bg-navy text-accent-fg shadow-xl", open ? "flex" : "hidden lg:flex")}>
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold tracking-[0.28em] text-accent-2">FAAT</div>
              <div className="mt-1 text-lg font-semibold">فات للهندسة</div>
              <div className="mt-0.5 text-xs text-white/55">Proposal Generator</div>
            </div>
            <button className="rounded-md p-2 text-white/70 hover:bg-navy-2 hover:text-white lg:hidden" onClick={() => setOpen(false)} aria-label="إغلاق">
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="px-4 pt-5">
          <div className="mb-2 px-2 text-[11px] font-medium text-white/40">إنشاء العروض</div>
          <nav className="flex flex-col gap-1">
            {nav.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors", active ? "bg-navy-2 text-white" : "text-white/65 hover:bg-navy-2 hover:text-white")}>
                  <Icon className="size-[18px]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
            <div className="grid size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-fg">{initials}</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{displayName}</div>
              <div className="text-xs text-white/45">منشئ العروض</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:ps-72">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-6">
          <button className="rounded-md p-2 hover:bg-paper lg:hidden" onClick={() => setOpen(true)} aria-label="القائمة"><Menu className="size-5" /></button>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute right-3 top-3 size-4 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-paper pr-10 pl-3 text-sm outline-none placeholder:text-subtle focus:border-accent" placeholder="بحث سريع في العروض" />
            {query.trim() ? <div className="absolute start-0 end-0 top-12 z-50 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
              {results.length ? limitedResults.map((r, i) => <Link key={`${r.type}-${r.to}-${i}`} to={r.to as any} onClick={() => setQuery("")} className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0 hover:bg-paper"><div><div className="text-sm font-medium">{r.label}</div><div className="text-[11px] text-muted">{r.type}</div></div><ArrowUpLeft className="size-4 text-subtle" /></Link>) : <div className="p-4 text-sm text-muted">لا توجد نتائج.</div>}
            </div> : null}
          </div>
          <div className="ms-auto flex items-center gap-2">
            <div className="text-xs text-muted">منشئ العروض</div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 md:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
