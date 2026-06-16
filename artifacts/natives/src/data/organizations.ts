export interface Organization {
  name: string;
  sector: string;
  country: string;
  sdgs: string[];
  verified: boolean;
  description: string;
  partnershipType?: string;
  organizationType?: string;
}

export const mockOrganizations: Organization[] = [
  {
    name: "Green Future Initiatives",
    sector: "Renewable Energy",
    country: "Kenya",
    sdgs: ["SDG 7: Affordable and Clean Energy", "SDG 13: Climate Action"],
    verified: true,
    description: "Leading provider of solar microgrids for rural communities across East Africa.",
    partnershipType: "Implementation Partner",
    organizationType: "NGO"
  },
  {
    name: "AgriTech Solutions Ltd",
    sector: "Agriculture Technology",
    country: "Nigeria",
    sdgs: ["SDG 2: Zero Hunger", "SDG 8: Decent Work and Economic Growth"],
    verified: true,
    description: "AI-powered platform optimizing crop yields and supply chain for smallholder farmers.",
    partnershipType: "Technology Provider",
    organizationType: "For-profit"
  },
  {
    name: "Water Access Alliance",
    sector: "Water & Sanitation",
    country: "Uganda",
    sdgs: ["SDG 6: Clean Water and Sanitation", "SDG 3: Good Health and Well-being"],
    verified: false,
    description: "Coalition working to improve water infrastructure in underserved regions.",
    partnershipType: "Advocacy Partner",
    organizationType: "Non-profit"
  },
  {
    name: "HealthTech Innovators",
    sector: "Healthcare Technology",
    country: "Ghana",
    sdgs: ["SDG 3: Good Health and Well-being", "SDG 9: Industry, Innovation and Infrastructure"],
    verified: true,
    description: "Telemedicine platform connecting rural patients with specialist doctors via mobile.",
    partnershipType: "Service Partner",
    organizationType: "Startup"
  },
  {
    name: "Education For All Foundation",
    sector: "Education",
    country: "Senegal",
    sdgs: ["SDG 4: Quality Education", "SDG 5: Gender Equality"],
    verified: true,
    description: "Digital learning platform focused on STEM education for girls in West Africa.",
    partnershipType: "Content Partner",
    organizationType: "Foundation"
  }
];