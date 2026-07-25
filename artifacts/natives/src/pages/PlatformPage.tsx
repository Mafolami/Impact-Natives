import { Link } from "wouter";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { FindPartnerSection } from "@/components/platform/FindPartnerSection";
import { ImpactMarketplace } from "@/components/platform/ImpactMarketplace";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Network, Database, Zap, LayoutDashboard, FileText, Search, AlignJustify, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VerifiedOrgCard } from "@/components/platform/VerifiedOrgCard";
import { FundingOpportunityCard } from "@/components/platform/FundingOpportunityCard";
import { LabCard } from "@/components/platform/LabCard";
import { FounderCard } from "@/components/platform/FounderCard";
import { mockOrganizations } from "@/data/organizations";
import { mockFundingOpportunities } from "@/data/funding";
import { mockLabs } from "@/data/labs";
import { mockFounders } from "@/data/founders";

export default function PlatformPage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const tab = params.tab || "overview";

  const [selectedSdgs, setSelectedSdgs] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [filterType, setFilterType] = useState("All");
  const [filterSector, setFilterSector] = useState("All");
  const [filterGeo, setFilterGeo] = useState("All");
  const [filterDeadline, setFilterDeadline] = useState("All");

  const SDG_OPTIONS = ["Zero Hunger", "Good Health", "Climate Action"];

  const filteredOrgs = mockOrganizations.filter((org) => {
    const matchesSdg =
      selectedSdgs.length === 0 ||
      selectedSdgs.some((sdg) =>
        org.sdgs.some((s) => s.toLowerCase().includes(sdg.toLowerCase()))
      );
    const matchesVerified = !verifiedOnly || org.verified;
    return matchesSdg && matchesVerified;
  });

  const filteredFunding = mockFundingOpportunities.filter((f) => {
    const matchesType = filterType === "All" || f.instrumentType === filterType;
    const matchesSector = filterSector === "All" || f.sector === filterSector;
    return matchesType && matchesSector;
  });

  if (tab === "impact-marketplace") {
    return <ImpactMarketplace />;
  }

  if (tab === "partnership-os") {
    return (
      <div className="w-full">
        <div className="space-y-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <FindPartnerSection />
        </div>
      </div>
    );
  }

  // Only the three navbar destinations are live. Redirect any other tab
  // (overview, funding-infrastructure, direct-URL guesses) to home.
  const liveTab: string = tab;
  if (liveTab !== "impact-marketplace" && liveTab !== "partnership-os") {
    navigate("/");
    return null;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-0">

      {/* Overview grid — retired. Only the three navbar pages are live; redirect above sends any other tab home. Kept for future use. */}
      {false && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader>
              <Network className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>Partnership OS</CardTitle>
              <CardDescription>Organisation discovery and collaboration workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Match with verified partners and manage joint initiatives in a structured environment.</p>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader>
              <Database className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>Impact Marketplace</CardTitle>
              {/*<CardDescription>SDG mapping and metrics dashboard.</CardDescription>*/}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Standardized reporting templates and verifiable outcome tracking.</p>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader>
              <Zap className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>Funding Infrastructure</CardTitle>
              <CardDescription>Grant alignment and co-funding tools.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Coordinate capital deployment across multiple stakeholders efficiently.</p>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader>
              <ShieldCheck className="w-8 h-8 text-[#2D6A4F] mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>API & Integrations</CardTitle>
              <CardDescription>Institutional-grade transparency signals.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Verification badges and compliance indicators for confident partnership.</p>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
            <CardHeader>
              <ShieldCheck className="w-8 h-8 text-[#2D6A4F] mb-2 group-hover:scale-110 transition-transform" />
              <CardTitle>Founder Ecosystem</CardTitle>
              <CardDescription>Institutional-grade transparency signals.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Verification badges and compliance indicators for confident partnership.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* partnership-os handled above */}

      {/* Funding Infrastructure — retired empty shell. Kept for future use. */}
      {false && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Hero */}
          <section data-reveal className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Create and access funding opportunities</h1>
            <Link href="/signup">
              <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-4">Get Started</Button>
            </Link>
          </section>

          {/* Instrument Types */}
          <section data-reveal className="max-w-7xl mx-auto content-padding py-12">
            <h2 className="text-3xl font-semibold mb-8 text-center">
              Funding Instruments
            </h2>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
              {[
                {
                  title: "Grant",
                  desc1:
                    "Non-repayable funding for early-stage initiatives and proof-of-concept projects.",
                  desc2:
                    "Ideal for innovation validation and capacity building without financial obligation.",
                },
                {
                  title: "Impact Investment",
                  desc1:
                    "Patient capital that seeks both financial return and measurable social/environmental impact.",
                  desc2:
                    "Scalable solutions with clear impact metrics and sustainable business models.",
                },
                {
                  title: "Co-investment",
                  desc1:
                    "Shared investment where multiple partners contribute capital and expertise together.",
                  desc2:
                    "Risk mitigation through partnership and shared due diligence processes.",
                },
                {
                  title: "Prize",
                  desc1:
                    "Competitive funding awarded for achieving specific milestones or solving defined challenges.",
                  desc2:
                    "Results-based financing that incentivizes innovation and rapid solution development.",
                },
                {
                  title: "Accelerator",
                  desc1:
                    "Time-bound program providing funding, mentorship, and resources for rapid growth.",
                  desc2:
                    "Intensive support cohort designed to accelerate market readiness and scale.",
                },
              ].map((item) => (
                <Card
                  key={item.title}
                  className="group relative h-72 overflow-hidden border bg-background transition-all duration-500 hover:bg-primary/5 hover:border-primary/30"
                >
                  {/* Title */}
                  <div className="absolute inset-0 flex items-center justify-center p-4 transition-all duration-500 group-hover:items-start group-hover:pt-6">
                    <h3 className="text-2xl font-bold text-center transition-all duration-500 group-hover:text-lg">
                      {item.title}
                    </h3>
                  </div>

                  {/* Content */}
                  <div className="absolute inset-x-0 bottom-0 p-5 opacity-0 translate-y-6 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0">
                    <p className="text-sm text-muted-foreground mb-3">
                      {item.desc1}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.desc2}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </section>
          
          {/* Filters */}
          <section data-reveal className="max-w-7xl mx-auto content-padding py-12">
            <h2 className="text-2xl font-bold mb-6">Filter Opportunities</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">Instrument Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full bg-background"><SelectValue placeholder="All Types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Types</SelectItem>
                    <SelectItem value="Grant">Grant</SelectItem>
                    <SelectItem value="Impact Investment">Impact Investment</SelectItem>
                    <SelectItem value="Co-investment">Co-investment</SelectItem>
                    <SelectItem value="Prize">Prize</SelectItem>
                    <SelectItem value="Accelerator">Accelerator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Sector</label>
                <Select value={filterSector} onValueChange={setFilterSector}>
                  <SelectTrigger className="w-full bg-background"><SelectValue placeholder="All Sectors" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Sectors</SelectItem>
                    <SelectItem value="Agriculture Technology">Agriculture Technology</SelectItem>
                    <SelectItem value="Renewable Energy">Renewable Energy</SelectItem>
                    <SelectItem value="Healthcare Technology">Healthcare Technology</SelectItem>
                    <SelectItem value="Education">Education</SelectItem>
                    <SelectItem value="Financial Technology">Financial Technology</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Geography</label>
                <Select value={filterGeo} onValueChange={setFilterGeo}>
                  <SelectTrigger className="w-full bg-background"><SelectValue placeholder="All Regions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Regions</SelectItem>
                    <SelectItem value="East Africa">East Africa</SelectItem>
                    <SelectItem value="West Africa">West Africa</SelectItem>
                    <SelectItem value="Southern Africa">Southern Africa</SelectItem>
                    <SelectItem value="Central Africa">Central Africa</SelectItem>
                    <SelectItem value="North Africa">North Africa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Deadline</label>
                <Select value={filterDeadline} onValueChange={setFilterDeadline}>
                  <SelectTrigger className="w-full bg-background"><SelectValue placeholder="All Deadlines" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Deadlines</SelectItem>
                    <SelectItem value="Upcoming">Upcoming (Next 3 months)</SelectItem>
                    <SelectItem value="3-6 Months">3-6 Months Out</SelectItem>
                    <SelectItem value="6+ Months">6+ Months Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>


      {/* Opportunity Feed */}
      <div className="border rounded-lg overflow-hidden max-w-7xl mx-auto content-padding py-8">
            <div className="bg-muted p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">Active Funding Opportunities</h3>
              <Link href="/signup">
                <Button size="sm" className="bg-primary text-white">Create Opportunity</Button>
              </Link>
            </div>
            <div className="divide-y">
              {/* Funding opportunity cards — kept for future use
              {filteredFunding.map((funding, index) => (
                <FundingOpportunityCard
                  key={index}
                  title={funding.title}
                  instrumentType={funding.instrumentType}
                  sector={funding.sector}
                  deadline={funding.deadline}
                  leadOrganization={funding.leadOrganization}
                  openSlots={funding.openSlots}
                  description={funding.description}
                />
              ))}
              */}
              <div className="py-12 text-center text-muted-foreground text-sm">
                Be the first to create a funding opportunity on Natives.
              </div>
            </div>
          </div>

        </div>
      )} {/* END funding-infrastructure */}

      

      {/* api-integrations — kept for future use
      {tab === "api-integrations" && (
        <div className="min-h-[400px] border rounded-xl bg-card flex flex-col items-center justify-center text-center px-16 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Database className="w-16 h-16 text-muted-foreground mb-6" />
          <h2 className="text-3xl font-bold mb-4">API & Integrations</h2>
          <p className="text-xl text-muted-foreground max-w-lg mb-8">
            Connect Natives infrastructure directly to your internal systems. Programmatic access to the ecosystem's verification and discovery layers.
          </p>
          <Badge variant="outline" className="text-lg px-4 py-2 border-primary text-primary">Coming Soon</Badge>
        </div>
      )}

      {tab === "founders-ecosystem" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 px-16">
          <div>
            <h2 className="text-3xl font-bold mb-2">Founder Ecosystem</h2>
            <p className="text-muted-foreground">Discover and connect with vetted founders building innovative solutions across Africa.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockFounders.map((founder, index) => (
              <FounderCard
                key={index}
                founderName={founder.founderName}
                businessModelType={founder.businessModelType}
                stage={founder.stage}
                endorsements={founder.endorsements}
                sector={founder.sector}
                seeking={founder.seeking}
                verified={founder.verified}
              />
            ))}
          </div>
        </div>
      )}
      */}

    </div> 
  );
}