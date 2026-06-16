export interface Lab {
  title: string;
  description: string;
  activeChallenges: number;
  participantCount: number;
  fundingOpportunities: number;
  status: string;
}

export const mockLabs: Lab[] = [
  {
    title: "Agritech Innovation Lab",
    description: "Accelerating sustainable agriculture solutions through technology and data-driven approaches.",
    activeChallenges: 3,
    participantCount: 45,
    fundingOpportunities: 2,
    status: "Active"
  },
  {
    title: "Climate Resilience Lab",
    description: "Building adaptive capacity and innovative solutions for climate-vulnerable communities.",
    activeChallenges: 2,
    participantCount: 38,
    fundingOpportunities: 1,
    status: "Active"
  },
  {
    title: "Health Systems Lab",
    description: "Strengthening healthcare delivery systems through digital innovation and process optimization.",
    activeChallenges: 4,
    participantCount: 52,
    fundingOpportunities: 3,
    status: "Active"
  }
];