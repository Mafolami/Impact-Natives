// src/lib/ddItems.ts
//
// Shared DD readiness checklist config -- used by DashboardProfile.tsx
// (collecting evidence) and DashboardNatives.tsx (displaying it on the
// public profile). Kept in one place so the two never drift out of sync.

import { COUNTRIES } from "@/lib/countries";

export type DDQuestion =
  | { key: string; label: string; type: "text" }
  | { key: string; label: string; type: "select"; options: string[] }
  | { key: string; label: string; type: "yesno"; followUpIfYes?: { key: string; label: string } };

export interface DDItemDef {
  key: string;
  label: string;
  sub: string;
  questions: DDQuestion[];
}

// Fields whose evidence is sensitive enough to gate behind a live
// relationship (open conversation or accepted partnership) rather than
// showing to any visitor. Currently just the two identifying fields on
// legal registration -- everything else is fine to show to anyone.
export const DD_SENSITIVE_EVIDENCE_KEYS = new Set(["registrationNumber", "registeringBody"]);

export const DD_ITEMS: DDItemDef[] = [
    {
      key: "financial_model",
      label: "Financial model available",
      sub: "A current financial model or projections document",
      questions: [
        { key: "preparedBy", label: "Prepared by", type: "select", options: ["Internal team", "External consultant", "Board-reviewed", "Other"] },
        { key: "lastUpdated", label: "Last updated (date)", type: "text" },
        { key: "notes", label: "Anything else worth noting?", type: "text" },
      ],
    },
    {
      key: "audited_accounts",
      label: "Audited accounts on file",
      sub: "Most recent audited financial statements",
      questions: [
        { key: "auditor", label: "Auditor / audit firm", type: "text" },
        { key: "dateAudited", label: "Date of audit", type: "text" },
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
        { key: "notes", label: "Anything else worth noting?", type: "text" },
      ],
    },
    {
      key: "esg_assessment",
      label: "ESG self-assessment completed",
      sub: "Environmental, social and governance baseline assessment",
      questions: [
        { key: "framework", label: "Framework used", type: "select", options: ["GRI", "SASB", "UN Global Compact", "B Corp", "TCFD", "SDG Reporting", "Custom"] },
        { key: "conductedBy", label: "Conducted by", type: "select", options: ["Internal team", "External consultant", "Board", "Other"] },
        { key: "notes", label: "Anything else worth noting?", type: "text" },
      ],
    },
    {
      key: "impact_framework",
      label: "Impact measurement framework",
      sub: "Theory of change, IRIS+ alignment, or outcome tracking methodology",
      questions: [
        { key: "framework", label: "Framework used", type: "select", options: ["IRIS+", "SDG Indicators", "LogFrame", "Custom"] },
        { key: "dateAdopted", label: "Date adopted", type: "text" },
        { key: "notes", label: "Anything else worth noting?", type: "text" },
      ],
    },
    {
      key: "safeguarding_policy",
      label: "Safeguarding policy",
      sub: "Child protection / protection from sexual exploitation and abuse policy",
      questions: [
        { key: "ownership", label: "Ownership", type: "select", options: ["Dedicated Safeguarding Officer", "Shared responsibility (HR/Ops)", "Board-level oversight", "Other"] },
        { key: "dateAdopted", label: "Date adopted", type: "text" },
        { key: "notes", label: "Anything else worth noting?", type: "text" },
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
      sub: "No blacklisting, pending disputes, or undisclosed conflicts",
      questions: [
        { key: "noBlacklisting", label: "No current blacklisting by any government or regulatory agency?", type: "yesno" },
        { key: "noPendingDisputes", label: "No pending legal disputes, investigations, or allegations?", type: "yesno" },
        { key: "conflictsToDisclose", label: "Any related-party conflicts with funders or partners to disclose?", type: "yesno", followUpIfYes: { key: "conflictsDetail", label: "Please describe" } },
      ],
    },
  ];