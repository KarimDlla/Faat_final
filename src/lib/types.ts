export type SystemType =
  | "elevators"
  | "chiller"
  | "hvac"
  | "vrf"
  | "bms"
  | "smoke"
  | "escalators"
  | "other";


export type QuotationItem = {
  id: string;
  code: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  location: string;
  specifications: { key: string; value: string }[];
};

export type DynamicQuotationTable = {
  id: string;
  title: string;
  description: string;
  columns: { key: string; label: string; type: "text" | "number" | "currency" | "date" }[];
  rows: { id: string; cells: { key: string; value: string }[] }[];
  sourceSection: string;
};

export type ProjectStructureSection = {
  id: string;
  title: string;
  type: "system" | "location" | "equipment" | "scope" | "commercial" | "terms" | "other";
  summary: string;
};

// One equipment group as the CCS pricing workbook sees it: L1..Ln (elevators), E1..En (escalators),
// M1..Mn (moving walks). The AI only READS these facts from the quotation — it never calculates a
// price. `fobUnit` is the FOB of ONE unit of this group (0 = the quotation doesn't state it).
export type PricingGroupKind = "L" | "E" | "M";
export type PricingGroupFobSource = "explicit_fob" | "unlabeled_price" | "not_found";
export type PricingGroup = {
  code: string;
  kind: PricingGroupKind;
  description: string;
  quantity: number;
  fobUnit: number;
  fobTotal: number;
  fobSource: PricingGroupFobSource;
  evidence: string;
  technical: { totalHeightM: number; landingDoors: number; tractionRopes: number };
};

export type UniversalQuotationExtraction = {
  systemType: SystemType | "other";
  systemLabel: string;
  project: { name: string; building: string; location: string };
  supplier: string;
  quoteNumber: string;
  quoteDate: string;
  currency: string;
  items: QuotationItem[];
  projectStructure: ProjectStructureSection[];
  dynamicTables: DynamicQuotationTable[];
  pricingGroups?: PricingGroup[];
  commercial: { subtotal: number; discount: number; tax: number; grandTotal: number };
  terms: { delivery: string; warranty: string; payment: string; validity: string };
  generalSpecifications: { key: string; value: string }[];
  notes: string[];
  validation: { itemsTotal: number; difference: number; totalsMatch: boolean };
};

export type AIField = {
  key: string;
  label: string;
  value: string;
  confidence: "high" | "medium" | "review";
  source: string;
};

export type ProposalStatus =
  | "draft"
  | "review"
  | "sent"
  | "under_review"
  | "revision_required"
  | "accepted"
  | "rejected"
  | "expired"
  | "superseded";

export type OpportunityStage =
  | "new"
  | "estimating"
  | "proposal_sent"
  | "negotiation"
  | "awaiting_award"
  | "awarded"
  | "lost"
  | "on_hold";

export type CostMode = "fixed" | "percent";
export type CostBase = "fob" | "subtotal" | "none";

export type CostLine = {
  id: string;
  labelAr: string;
  labelEn: string;
  mode: CostMode;
  base: CostBase;
  value: number;
};

export type PaymentTerms = {
  advance: number;
  shipping: number;
  handover: number;
};

export type ScheduleTerms = {
  supplyMin: number;
  supplyMax: number;
  installMin: number;
  installMax: number;
  testMin: number;
  testMax: number;
  warrantyMonths: number;
  freeMaintenanceMonths: number;
};

// Generic technical spec pair. Every system type (elevators included) is described this way —
// the key/value pairs come from whatever the AI actually found in the quotation, not from a
// hard-coded field list, so a new system type never requires new fields here.
export type SpecField = { key: string; label: string; value: string };

export type CurrencySetting = {
  code: string;
  name: string;
  symbol: string;
  rateToUSD: number;
};

export type Client = {
  id: string;
  name: string;
  nameAr: string;
  type: "developer" | "consultant" | "contractor" | "government" | "client";
  city: string;
  contact: string;
  position: string;
  phone: string;
  email: string;
};

export type Project = {
  id: string;
  name: string;
  nameAr: string;
  clientId: string;
  location: string;
  latitude?: number;
  longitude?: number;
  division: SystemType;
  manager: string;
  status: "active" | "completed" | "on_hold";
  contractValue: number;
  signedDate?: string;
};

export type Opportunity = {
  id: string;
  code: string;
  projectName: string;
  clientId: string;
  division: SystemType;
  location: string;
  stage: OpportunityStage;
  value: number;
  date: string;
  owner: string;
};

export type ProposalUnit = {
  id: string;
  code: string;
  description: string;
  quantity: number;
  specs: SpecField[];
  supplierQuoteId?: string;
  // Per-group FOB (one unit). Never merged into a single project-wide FOB.
  fobUnit?: number;
  fobSource?: PricingGroupFobSource;
  technical?: { totalHeightM?: number; landingDoors?: number; tractionRopes?: number };
};

export type SupplierQuotationRevision = {
  id: string;
  revision: number;
  quoteNumber: string;
  date: string;
  sourceName: string;
  status: "uploaded" | "extracted" | "reviewed" | "approved";
  notes?: string;
};

export type SupplierQuotation = {
  id: string;
  supplier: string;
  quoteNumber: string;
  currency: "USD" | "EUR";
  units: string[];
  revisions: SupplierQuotationRevision[];
  activeRevision: number;
};

export type GeneratedFile = {
  kind: "docx" | "xlsx";
  name: string;
  generatedAt: string;
};

export type Proposal = {
  id: string;
  number: string;
  revision: number;
  parentId?: string;
  projectId: string;
  clientId: string;
  opportunityId?: string;
  systemType: SystemType;
  status: ProposalStatus;
  currency: "USD" | "EUR";
  validityDays: number;
  date: string;
  validUntil: string;
  owner: string;
  quotationSource: string;
  specs: SpecField[];
  selectedSystemType?: SystemType;
  units?: ProposalUnit[];
  supplierQuotations?: SupplierQuotation[];
  notes: string;
  fob: number;
  costLines: CostLine[];
  sellingPrice: number;
  payment: PaymentTerms;
  schedule: ScheduleTerms;
  files: GeneratedFile[];
  extraction?: UniversalQuotationExtraction;
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  clients: Client[];
  currencies: CurrencySetting[];
  salesManager: string;
  salesManagers: string[];
  projects: Project[];
  opportunities: Opportunity[];
  proposals: Proposal[];
};
