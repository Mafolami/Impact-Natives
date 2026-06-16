export interface Founder {
  founderName: string;
  businessModelType: string;
  stage: string;
  endorsements: number;
  sector: string;
  seeking: string[];
  verified: boolean;
}

export const mockFounders: Founder[] = [
  {
    founderName: "Amina Johnson",
    businessModelType: "B2B",
    stage: "Revenue-generating",
    endorsements: 12,
    sector: "Agriculture Technology",
    seeking: ["Series A Funding", "Strategic Partnerships"],
    verified: true
  },
  {
    founderName: "Kwame Osei",
    businessModelType: "B2C",
    stage: "Pilot",
    endorsements: 8,
    sector: "Healthcare Technology",
    seeking: ["Pilot Customers", "Technical Advisors"],
    verified: true
  },
  {
    founderName: "Fatima Hassan",
    businessModelType: "Marketplace",
    stage: "Prototype",
    endorsements: 5,
    sector: "Education",
    seeking: ["Seed Funding", "User Acquisition Partners"],
    verified: false
  },
  {
    founderName: "David Makau",
    businessModelType: "SaaS",
    stage: "Concept",
    endorsements: 3,
    sector: "Financial Technology",
    seeking: ["Co-founder", "Technical Validation"],
    verified: false
  },
  {
    founderName: "Ngozi Adebayo",
    businessModelType: "Cooperative",
    stage: "Revenue-generating",
    endorsements: 15,
    sector: "Renewable Energy",
    seeking: ["Expansion Capital", "Distribution Partners"],
    verified: true
  }
];