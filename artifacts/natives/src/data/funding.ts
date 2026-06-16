export interface FundingOpportunity {
  title: string;
  instrumentType: string;
  sector: string;
  deadline: string;
  leadOrganization: string;
  openSlots: number;
  description: string;
}

export const mockFundingOpportunities: FundingOpportunity[] = [
  {
    title: "Agritech Innovation Grant Program",
    instrumentType: "Grant",
    sector: "Agriculture Technology",
    deadline: "March 15, 2027",
    leadOrganization: "African Development Bank",
    openSlots: 12,
    description: "Funding for innovative agritech solutions that improve food security and farmer livelihoods across Sub-Saharan Africa."
  },
  {
    title: "Climate Resilience Impact Investment Fund",
    instrumentType: "Impact Investment",
    sector: "Renewable Energy",
    deadline: "April 30, 2027",
    leadOrganization: "Global Environment Facility",
    openSlots: 8,
    description: "Investment opportunities in renewable energy projects that build climate resilience in vulnerable communities."
  },
  {
    title: "Health Systems Accelerator Prize",
    instrumentType: "Prize",
    sector: "Healthcare Technology",
    deadline: "May 22, 2027",
    leadOrganization: "World Health Organization",
    openSlots: 5,
    description: "Prize competition for scalable digital health solutions that improve access to quality healthcare services."
  },
  {
    title: "EdTech Co-investment Partnership",
    instrumentType: "Co-investment",
    sector: "Education",
    deadline: "June 10, 2027",
    leadOrganization: "UNICEF",
    openSlots: 15,
    description: "Co-investment opportunities for educational technology platforms that improve learning outcomes for underserved populations."
  },
  {
    title: "Women's Economic Empowerment Accelerator",
    instrumentType: "Accelerator",
    sector: "Financial Technology",
    deadline: "July 5, 2027",
    leadOrganization: "African Union",
    openSlots: 10,
    description: "Accelerator program for fintech solutions that promote women's financial inclusion and economic empowerment."
  }
];