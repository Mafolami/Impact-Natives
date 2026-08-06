// src/lib/ddItems.ts
//
// Shared DD readiness checklist config -- used by DashboardProfile.tsx
// (collecting evidence) and DashboardNatives.tsx (displaying it on the
// public profile). Kept in one place so the two never drift out of sync.

import { COUNTRIES } from "@/lib/countries";

export type DDQuestion =
  | { key: string; label: string; type: "text"; required?: boolean; showIf?: { key: string; equals: boolean } }
  | { key: string; label: string; type: "date"; required?: boolean; showIf?: { key: string; equals: boolean } }
  | { key: string; label: string; type: "select"; options: string[]; required?: boolean; showIf?: { key: string; equals: boolean } }
  | { key: string; label: string; type: "yesno"; required?: boolean; showIf?: { key: string; equals: boolean }; followUpIfYes?: { key: string; label: string; required?: boolean } };

export interface DDItemDef {
  key: string;
  label: string;
  sub: string;
  questions: DDQuestion[];
}

// A single uploaded evidence file for one DD item. Shared between the
// editor (DashboardProfile.tsx) and the public viewer (DashboardNatives.tsx)
// so the shape never drifts between the two.
export interface DDDocument {
  id: string;
  organization_id: string;
  dd_item_key: string;
  file_path: string;
  file_name: string;
  visibility: "private" | "relationship" | "public";
  created_at: string;
}

// Fields whose evidence is sensitive enough to gate behind a live
// relationship (open conversation or accepted partnership) rather than
// showing to any visitor. Currently just the two identifying fields on
// legal registration -- everything else is fine to show to anyone.
export const DD_SENSITIVE_EVIDENCE_KEYS = new Set(["registrationNumber", "registeringBody"]);

// Short, plain-language explanations for the three similar-looking score
// cards (DD Readiness, Delivery, Impact & Track Record), so a viewer can
// tell them apart instead of reading three green cards as one thing.
export const PILLAR_INFO = {
  ddReadiness: "What the organisation has confirmed about itself directly. Not verified by Impact Natives.",
  delivery: "How relationships tracked on this platform have actually turned out, based on outcomes recorded here, not self-reported.",
  trackRecord: "Numbers and history the organisation has entered about its own past work. Not verified by Impact Natives.",
} as const;

export const DD_ITEMS: DDItemDef[] = [
    {
      key: "financial_model",
      label: "Financial model available",
      sub: "A current financial model or projections document",
      questions: [
        { key: "preparedBy", label: "Prepared by", type: "select", options: ["Internal team", "External consultant", "Board-reviewed", "Other"] },
        { key: "lastUpdated", label: "Last updated (date)", type: "date" },
        { key: "notes", label: "Anything else worth noting?", type: "text", required: false },
      ],
    },
    {
      key: "audited_accounts",
      label: "Audited accounts on file",
      sub: "Most recent audited financial statements",
      questions: [
        { key: "auditor", label: "Auditor / audit firm", type: "text" },
        { key: "dateAudited", label: "Date of audit", type: "date" },
        { key: "auditOpinion", label: "Audit opinion", type: "select", options: ["Clean", "Qualified", "Not sure"] },
      ],
    },
    {
      key: "governance_doc",
      label: "Governance documentation",
      sub: "Board structure, org chart, or governance policy",
      questions: [
        { key: "boardSize", label: "Board size", type: "select", options: ["1–3", "4–6", "7–10", "10+", "Other"] },
        { key: "meetingCadence", label: "Meeting cadence", type: "select", options: ["Monthly", "Quarterly", "Semi-annually", "Annually", "Ad hoc", "Other"] },
        { key: "notes", label: "Anything else worth noting?", type: "text", required: false },
      ],
    },
    {
      key: "esg_assessment",
      label: "ESG self-assessment completed",
      sub: "Environmental, social and governance baseline assessment",
      questions: [
        { key: "framework", label: "Framework used", type: "select", options: ["GRI", "SASB", "UN Global Compact", "B Corp", "TCFD", "SDG Reporting", "Custom"] },
        { key: "conductedBy", label: "Conducted by", type: "select", options: ["Internal team", "External consultant", "Board", "Other"] },
        { key: "notes", label: "Anything else worth noting?", type: "text", required: false },
      ],
    },
    {
      key: "impact_framework",
      label: "Impact measurement framework",
      sub: "Theory of change, IRIS+ alignment, or outcome tracking methodology",
      questions: [
        { key: "framework", label: "Framework used", type: "select", options: ["IRIS+", "SDG Indicators", "LogFrame", "Custom"] },
        { key: "dateAdopted", label: "Date adopted", type: "date" },
        { key: "notes", label: "Anything else worth noting?", type: "text", required: false },
      ],
    },
    {
      key: "environmental_policy",
      label: "Environmental policy",
      sub: "Energy, travel, and waste practices for fieldwork and operations",
      questions: [
        { key: "hasWrittenPolicy", label: "Written environmental policy in place?", type: "yesno" },
        { key: "areasCovered", label: "Areas covered", type: "select", options: ["Field travel / transport", "Office energy use", "Waste / paper reduction", "Multiple areas", "Other"], showIf: { key: "hasWrittenPolicy", equals: true } },
        { key: "notes", label: "Anything else worth noting?", type: "text", required: false },
      ],
    },
    {
      key: "safeguarding_policy",
      label: "Safeguarding policy",
      sub: "Child protection / protection from sexual exploitation and abuse policy",
      questions: [
        { key: "ownership", label: "Ownership", type: "select", options: ["Dedicated Safeguarding Officer", "Shared responsibility (HR/Ops)", "Board-level oversight", "Other"] },
        { key: "dateAdopted", label: "Date adopted", type: "date" },
        { key: "notes", label: "Anything else worth noting?", type: "text", required: false },
      ],
    },
    {
      key: "legal_registration",
      label: "Legal registration / tax-exempt status",
      sub: "Registered legal entity with valid tax status",
      questions: [
        { key: "registrationNumber", label: "Registration number", type: "text" },
        { key: "country", label: "Country", type: "select", options: COUNTRIES },
        { key: "registeringBody", label: "Registering body", type: "text" },
      ],
    },
    {
      key: "legal_compliance_declaration",
      label: "Legal & compliance declaration",
      sub: "Blacklisting, pending disputes, and undisclosed conflicts",
      questions: [
        { key: "hasBlacklisting", label: "Do you have any current blacklisting by any government or regulatory agency?", type: "yesno", followUpIfYes: { key: "blacklistingDetail", label: "Please briefly describe (optional)", required: false } },
        { key: "hasPendingDisputes", label: "Do you have any pending legal disputes, investigations, or allegations?", type: "yesno", followUpIfYes: { key: "pendingDisputesDetail", label: "Please briefly describe (optional)", required: false } },
        { key: "conflictsToDisclose", label: "Any related-party conflicts with funders or partners to disclose?", type: "yesno", followUpIfYes: { key: "conflictsDetail", label: "Please briefly describe (optional)", required: false } },
      ],
    },
  ];