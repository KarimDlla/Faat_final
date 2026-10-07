# FAAT Proposal Generator — Handoff

Proposal-generation module prepared for MEPSOL CRM integration.

## Workflow

1. Upload supplier quotation.
2. AI detects the system type and project automatically.
3. AI extracts normalized data and builds dynamic review tables from the actual quotation structure.
4. User reviews and edits extracted values.
5. Pricing engine calculates internal cost and selling price.
6. Customer-facing proposal is generated without supplier cost or margin.

## Dynamic quotation tables

The extraction model creates a variable number of tables. Each table chooses its own columns and rows from the quotation instead of using fixed Elevator/Chiller/VRF forms. The included VRF and Elevator quotations are test fixtures only and are used to demonstrate two different document structures.

## Run

```bash
npm install
npm run dev
```

Set `GEMINI_API_KEY` in `.env.local` for real AI extraction.

Production database, authentication, hosting and MEPSOL CRM/API integration are intentionally excluded. The MEPSOL team will connect these pieces in the target system.


## v2 direction
The quotation pipeline now records a dynamic project structure before dynamic tables.

## Known gaps before production
- No database or authentication yet — data is stored in browser localStorage only (see `src/lib/store.ts`).
- The `extractQuotation` server function (`src/lib/extract-quotation.ts`) has a basic in-memory rate limit but no real auth; add proper access control before public deployment.
- `seedData()` in `src/lib/seed.ts` now returns an empty dataset — all clients/projects/proposals shown in the app come from real usage, not placeholders.

## v3 — Fully dynamic fields + template-based document generation

**No fixed fields anywhere, including elevators.** `ElevatorSpecs` is gone. Every system type (elevators included) is described with `SpecField[]` (`{key, label, value}`), populated from whatever the AI actually found in `generalSpecifications`, or added/edited manually. There is no per-system field schema to extend when a new system type shows up.

**System-type conflict is now surfaced, never silently applied.** The user's manual selection (`selectedSystemType`) and the AI's read of the document content (`detectedSystemType`) are tracked separately. A mismatch shows a warning banner in `new.tsx` with an explicit choice — the AI never overwrites the user's pick. The filename is only ever a weak hint (`filenameHint`); document content always wins over the filename (see `inferSystemFromFileName` usage in `extract-quotation.ts`).

**Word and Excel are filled into approved templates, not built from scratch in code.**
- `src/lib/docx-template.ts` fills `public/templates/FAAT Proposal Master Template.docx` (already has `{{TOKEN}}` placeholders) using JSZip — string-level XML substitution, no prose is invented, unmapped placeholders are logged and left visibly blank ("—").
- `src/lib/xlsx-template.ts` does the same for Excel, with an optional `{{ITEMS_ROW}}` marker row that repeats once per line item. **No placeholder-based Excel template exists yet** — `generateExcel()` looks for one at `public/templates/FAAT Excel Template.xlsx` first, and only if that isn't found falls back to the plain dynamic workbook builder in `documents.ts`. Drop a real template at that path (with `{{TOKEN}}` cells, matching the token names in `documents.ts`) and it will be used automatically — no code change needed.
- PowerPoint generation has been removed entirely (`pptxgenjs` and the `docx` builder-library dependency are both gone from `package.json`) — it was never in the approved scope (Word + Excel only) and `generateAll()` now returns `{ xlsx, docx }`.

**Environment note:** this container has no network access, so `npm install` / `npm run typecheck` / `npm run build` could not be run here to confirm a clean compile. A manual review (including a scoped offline `tsc` pass against a system TypeScript install, ignoring only "module not found" noise from the missing `node_modules`) found no real type errors introduced by this refactor — but please run `npm install && npm run typecheck` before trusting this in production, and report back anything that surfaces.

## v4 — Real elevator template + UI simplification

**Elevators now use FAAT's real proposal document as the Word template.** `public/templates/FAAT Elevator Offer Template.docx` is the actual SHARP-elevator proposal (converted to a `{{TOKEN}}` template — see `buildElevatorTokens` in `docx-template.ts`): elevator/cabin/landing-hall spec tables, FAAT's real legal & responsibility clauses, the 80/15/5 payment schedule, and a commercial table that **repeats one row per L1/L2/L3 group** via a `{{ITEMS_ROW}}` marker row (implemented generically in `fillDocxTemplate` / `expandItemsRow`, reusable by any future template). Non-elevator system types still use the older generic `FAAT Proposal Master Template.docx` until a real template exists for them too — `generateWord()` branches on `proposal.systemType`.

Two things worth knowing about this template:
- It prices in Syrian Lira in its own static wording; the actual number filled in just follows `proposal.currency` as-is (e.g. shows "12,000 USD" if that's what the proposal is in) rather than guessing an exchange rate. Update the template's static wording if most quotes are in a different currency.
- `TOTAL_PRICE_WORDS` (amount spelled out in Arabic words, e.g. "اثنا عشر ألف دولار فقط لا غير") is left as the same formatted number rather than a generated Arabic word-form — an auto-generated number-to-words conversion risks being grammatically wrong, so this field needs a manual pass, or a proper Arabic numeral-to-words routine added later.

**Elevator groups (L1/L2/L3) are now a real, editable list**, not just internal plumbing: `src/routes/_app/proposals/new.tsx`'s review screen has an "add group" UI wired to the `addUnit`/`updateUnit`/`removeUnit` helpers that already existed in `ProposalUnit`. Total quantity for pricing is now the sum of the groups' quantities (`effectiveQty`), computed instead of a separately-typed number once more than one group exists.

**UI simplification, per request:**
- The client picker + "add new client" modal are gone. New-project mode now just has a plain "اسم العميل / الجهة" text field; at save time the app finds-or-creates a lightweight `Client` record by that name behind the scenes (`store.addClient`), so the data model and Word/Excel `CLIENT_NAME` token are unaffected — the person just never sees client management as a separate concept.
- System-type selection moved up next to the quotation file upload (step 0), instead of being buried in a card near the client picker.
- The "paste quotation text" textarea is gone — file upload only.
- "New project" is now the default choice (previously "existing project" was default).



## v4.4 — CCS pricing workbook replaces the old Excel template

**The old `__S168 Local CCS.xlsx` is gone** (it was never even loaded by the code). The owner's real pricing workbook is now `public/templates/FAAT CCS Pricing Workbook.xlsx` (L1–L5 Info + cost sheets, E1–E2, M1–M2, "Proposed Price", "Discounted Price").

**Golden rule: Excel stays the source of truth.** `src/lib/ccs-workbook.ts` never re-implements or edits a formula. It patches only INPUT cells at XML level (so styles/merges/formulas survive), drops stale cached results and sets `fullCalcOnLoad` so Excel recalculates everything itself on open.

What gets written, per group (L1..L5, E1..E2, M1..M2):
- `D12` = quantity, `E12` = FOB of ONE unit (the only price taken from the quotation).
- Groups the project doesn't have are written as 0/0 so the template's sample numbers never leak.
- Header labels (project, quote ref/date, row names on "Proposed Price"). Elevators only: `Lx Info` C8/C9/C13/C33 (height, landing doors, ropes, qty) when the quotation states them.
- NOT written (manual in Excel): banking, overhead, maintenance, local costs, installation, bonds, profit %, customs, income tax %, discount %.

**AI (`extract-quotation.ts`)** now also returns `pricingGroups[]`: code (L#/E#/M#), quantity, FOB per unit, FOB total, `fobSource` (`explicit_fob` | `unlabeled_price` | `not_found`), a short `evidence` string, and elevator technical facts. The prompt forbids treating `grandTotal` as FOB, forbids extracting profit/overhead/etc., and forbids calculating any price. `normalizePricingGroups()` cleans codes/duplicates server-side.

**UI (`new.tsx`)**: each group row has its own "FOB للوحدة". When every group has a FOB, the total = Σ(qty × group FOB). The old blind `grandTotal ÷ qty → FOB` only remains as a fallback when the AI found no groups at all.

**Known limits (flagged, not hidden):**
- The workbook physically has 5 L / 2 E / 2 M groups. A 6th elevator etc. is NOT silently dropped — a warning toast lists it. Fully dynamic group count means cloning cost sheets and extending the Proposed/Discounted Price blocks; not done yet.
- Template still carries the owner's sample inputs (L1: local materials 500, scaffolding 750, local installation 2000; customs 14,000; profit/tax/discount %). They are manual inputs and were left untouched.
- Inherited Excel behavior: `#DIV/0!` in "Proposed Price" unit prices of empty groups, and in `Lx Info` until shifts / working days / teams are filled. Original formulas, unchanged.
- The Word proposal still uses the legacy `pricing.ts` for its selling price (unchanged, out of scope here).
- Not run here: `npm install && npm run typecheck && npm run build` (no network). Run them before trusting.

**Verification done (LibreOffice recalculation):** with the original inputs (L1: 2 × 8,800) the filled workbook gives the same value as the supplied file in all 609 formula cells, and all 609 formulas are textually identical. A second scenario (4 groups, special characters, overflow L6/X9) matched an independent openpyxl-built reference in all 609 cells.


## v4.5 — Template manager (add / replace Word & Excel templates, no code per template)

**Where:** extraction page (step 0), collapsible "إدارة قوالب Word و Excel" → `src/components/templates/template-manager.tsx`.

**Idea:** one shared vocabulary of tokens + a registry of templates keyed by *system type × Word/Excel*. Adding a chiller/VRF/BMS template or replacing an old file needs **no new code** — the template author only writes token names; the engine fills them.

Token vocabulary (all derived from the real builders in `template-catalog.ts`, so the list can't drift):
- `{{CLIENT_NAME}}`, `{{TOTAL_PRICE}}`… plain UPPER_SNAKE tokens (generic + elevator `ELV_*`, `CABIN_*`, `LANDING_*`; Excel-only extras like `{{FOB_TOTAL}}` as real numbers).
- `{{SPEC:<name>}}` — generic technical spec resolved BY NAME against the quotation's real specifications (exact match first, then "label contains"). This is what removes the need for per-system token builders. Unresolved → "—" **and** a warning toast (never silent).
- `{{ITEMS_ROW}}` + `{{items.field}}` — repeating table row. Word items never include supplier unit prices (client-facing).

Flow: upload → **scan before saving** (known / unknown tokens, SPEC names, items row, errors) → confirm → saved as next version of the slot and activated. Up to 5 versions per slot are kept; roll back or "back to built-in default" any time. No active custom template = exactly the old behaviour (built-in files under `public/templates`).

Files:
- `template-defaults.ts` — built-in template paths, slot rules (escalators' Excel = elevators' CCS slot).
- `template-registry.ts` — `TemplateStore` interface + IndexedDB implementation (**browser-local only, not shared between users/devices**). To go server-side, implement `TemplateStore` against the MEPSOL backend and change the single `templateStore` export.
- `template-values.ts` — turns a Proposal into token values / specs / items for Word and Excel.
- `docx-template.ts` — now merges tokens that Word split across runs (`mergeSplitTokens`; without it hand-edited templates silently lose tokens), supports `SPEC:`, also fills headers/footers, adds `scanDocxTemplate`.
- `xlsx-fill.ts` — Excel filling at XML level, same philosophy as `ccs-workbook.ts`: formulas never touched (formula target cells are refused + reported), styles survive, Excel recalculates on open. Placeholder cells and/or an optional JSON cell map (`[{sheet, cell, source, repeat?, max?}]`). Item rows are written downward into free rows; rows are never inserted (would shift formula references) — overflow is reported, not dropped silently.
- CCS workbook (elevators/escalators Excel) keeps its fixed-cell mode; a replacement upload is validated (all required sheets must exist). It assumes the same input cells (D12 qty / E12 FOB) — a layout change needs `ccs-workbook.ts` updated.
- `ccs-workbook.ts`: only exports + a `fallbackStyle` param + `enableFullCalcOnLoad` extracted; verified output byte-identical to v4.4 on the supplied workbook.

Verification done offline (no network → no `npm install`): scoped `tsc` with stubs for third-party types (clean); Word fill test (split tokens, SPEC, repeating rows, header, XML escaping); Excel fill test with LibreOffice recalculation (formulas intact and recalculated, overflow/formula/unknown-sheet reported); shipped Elevator template output byte-identical to v4.4; the catalog matches both shipped Word templates with 0 unknown tokens. NOT tested here: the IndexedDB store and the UI in a real browser — run `npm install && npm run typecheck && npm run dev` and try one upload.

## AI Provider Migration (OpenAI + Gemini)

The quotation extraction layer now supports both providers through the same normalized FAAT extraction schema. Provider priority is controlled only by `AI_PROVIDER_ORDER`; the default is `openai,gemini`. If the selected provider is unavailable, fails, or times out, extraction falls back to the next provider.

Required environment variables:
- `AI_PROVIDER_ORDER=openai,gemini`
- `OPENAI_API_KEY` and `OPENAI_MODEL`
- `GEMINI_API_KEY` and `GEMINI_MODEL`
- Optional: `OPENAI_MODEL_FALLBACK_1..3`, `GEMINI_MODEL_FALLBACK_1..5`, `AI_TIMEOUT_MS`, `AI_MAX_REQUESTS_PER_MINUTE`

The extraction prompt, JSON schema, AutoDetect behavior, pricing-group normalization, and downstream Word/Excel processing remain unchanged. OpenAI is called through the Responses API using structured JSON output; Gemini continues to use its native JSON response schema.

Copy `example.env` to the deployment environment and provide real API keys there. Never commit real keys to the repository.


## AI model switch (header toggle)
- Header shows a two-button toggle `OpenAI | Gemini` — no settings dialog. The selected provider is tried first; the other stays as fallback (original provider chain). Default selection: OpenAI.
- **API keys and model names are never entered or stored in the browser.** They come only from the server env (`OPENAI_API_KEY`, `OPENAI_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, fallbacks, `AI_PROVIDER_ORDER`). The toggle dims a button whose key is missing (`getAiStatus`, booleans only).
- Browser state (`src/lib/ai-settings.ts`, localStorage `faat-ai-settings`): just the selected provider.
- OpenAI `file_data` is now sent as a data URL (`data:application/pdf;base64,...`); images use `input_image`. Optional `OPENAI_TIMEOUT_MS`.
- Also merged: quotation tables (`dynamicTables`) are flattened into specs for the Word template (`flattenTableSpecs` in docx-template.ts).
