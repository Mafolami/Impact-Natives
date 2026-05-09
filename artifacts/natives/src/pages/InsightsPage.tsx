import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3, FileText, Library, Download, ArrowUpRight,
  Users, MapPin, Calendar, TrendingUp, Globe, Layers,
  BookOpen, ClipboardList, FileCheck, Lightbulb, Target
} from "lucide-react";

const CASE_STUDIES = [
  {
    title: "Scaling smallholder financing through blended capital in East Africa",
    sector: "Agritech",
    country: "Kenya",
    sdg: "SDG 2",
    problem: "Over 4 million smallholder farmers in Kenya lack access to formal credit, leaving them unable to invest in inputs, storage, or technology during planting season.",
    stakeholders: "Equity Bank Kenya, two DFIs, Twiga Foods, and an NGO consortium providing last-mile extension services across 6 counties.",
    implementation: "A shared risk-mitigation framework was built across the consortium, pooling first-loss capital from DFIs to de-risk commercial bank lending. Natives coordinated milestone reporting and co-funding disbursement across all parties.",
    outcomes: "$2.4M in agricultural credit unlocked. 1,200 farmers reached in pilot year. 34% average yield improvement reported across participant cohort."
  },
  {
    title: "Community health worker networks as primary care infrastructure in rural Nigeria",
    sector: "Health",
    country: "Nigeria",
    sdg: "SDG 3",
    problem: "Rural communities in Kano State face a physician-to-patient ratio of 1:8,000. Preventable disease burden remains high due to lack of accessible primary care touchpoints.",
    stakeholders: "Kano State Ministry of Health, Living Goods Nigeria, PharmAccess Foundation, and a digital health startup providing the CHW data platform.",
    implementation: "Trained 400 community health workers equipped with diagnostic protocols and digital tools. Monthly supervision by NGO clinical teams. State government provided certification and stipend infrastructure.",
    outcomes: "87,000 community members reached. Malaria diagnosis and treatment turnaround reduced from 4.2 days to 18 hours. Programme now adopted as state policy across 3 additional LGAs."
  },
  {
    title: "Climate finance mobilisation for smallholder climate adaptation in the Sahel",
    sector: "Climate",
    country: "Senegal",
    sdg: "SDG 13",
    problem: "Senegalese farming communities face worsening rainfall unpredictability. Existing climate finance instruments are designed for large-scale infrastructure, not community-level adaptation.",
    stakeholders: "GIZ, USAID, a Dakar-based climate NGO, and two community cooperatives managing land across 3 regions.",
    implementation: "Structured a nature-based solutions project with verifiable carbon credit outcomes. Farmers received advance payments against future carbon revenue. Natives provided the co-funding coordination layer and verification framework.",
    outcomes: "3,200 hectares under regenerative land management. $1.1M in advance climate finance disbursed. Carbon verification submitted to Verra registry."
  },
  {
    title: "Corporate ESG execution via verified NGO partnerships in Southern Africa",
    sector: "Corporate ESG",
    country: "South Africa",
    sdg: "SDG 8",
    problem: "A large mining company's social licence commitments were undermined by inability to identify credible local implementation partners — previous grantees lacked governance and reporting capacity.",
    stakeholders: "Anglo American Foundation, four verified NGOs across Limpopo and Mpumalanga, and a social enterprise providing youth skills training.",
    implementation: "Natives was used to identify and pre-verify implementation partners against the company's governance standards. Partnership agreements, milestone tracking, and impact reporting were coordinated through the platform.",
    outcomes: "1,800 youth enrolled in skills programmes. 100% of grantees submitted standardised quarterly reports. Corporate team reduced partner management overhead by 60%."
  }
];

const REPORTS = [
  {
    title: "State of the African Impact Ecosystem 2024",
    type: "Annual Report",
    date: "December 2024",
    description: "Comprehensive analysis of capital flows, partnership formation trends, and verification standards adoption across 22 African markets. Includes a sector breakdown of Agritech, Climate, and Health.",
    tags: ["Ecosystem Overview", "Funding Trends"]
  },
  {
    title: "Blended Finance in Sub-Saharan Africa: Structures, Gaps and Opportunities",
    type: "Research Paper",
    date: "September 2024",
    description: "Examination of blended finance deal structures that have mobilised commercial capital in SSA since 2018. Analysis of DFI first-loss instruments, guarantee structures, and co-investment models.",
    tags: ["Blended Finance", "DFIs", "Capital Markets"]
  },
  {
    title: "SDG Alignment in Practice: How African NGOs Measure and Report Impact",
    type: "Industry Brief",
    date: "July 2024",
    description: "Survey of 120 African NGOs on their current impact measurement practices, reporting burdens, and readiness for institutional donor requirements. Includes a maturity framework for organisational reporting.",
    tags: ["Impact Measurement", "NGOs", "SDGs"]
  },
  {
    title: "Climate Finance Readiness for African Community Organisations",
    type: "Policy Brief",
    date: "April 2024",
    description: "Assessment of barriers facing community-level organisations in accessing climate finance instruments. Policy recommendations for DFIs and governments seeking to channel funding to the last mile.",
    tags: ["Climate Finance", "Policy", "Community"]
  },
  {
    title: "Corporate ESG Implementation in Africa: From Commitment to Evidence",
    type: "Research Paper",
    date: "February 2024",
    description: "Analysis of how 45 multinationals with African ESG commitments select, manage, and report on implementation partnerships. Highlights transparency gaps and best practice models.",
    tags: ["Corporate ESG", "Transparency", "Partnerships"]
  }
];

const SOLUTIONS = [
  {
    icon: Layers,
    title: "Multi-Stakeholder Partnership Framework",
    sector: "Cross-sector",
    description: "A structured playbook for convening and managing partnerships across NGOs, corporates, governments, and funders. Covers governance structures, milestone agreements, and reporting protocols.",
    status: "Available"
  },
  {
    icon: Target,
    title: "SDG-Aligned Impact Measurement System",
    sector: "Impact Verification",
    description: "End-to-end methodology for mapping programme activities to SDG targets, selecting indicators, collecting data, and producing donor-ready reports. Includes indicator dictionary and template library.",
    status: "Available"
  },
  {
    icon: Globe,
    title: "Last-Mile Capital Deployment Model",
    sector: "Blended Finance",
    description: "A replicable model for channelling institutional capital through community-level intermediaries, with first-loss structures, milestone-based disbursement, and verification checkpoints.",
    status: "Available"
  },
  {
    icon: Lightbulb,
    title: "Community Health Worker Scale-Up Playbook",
    sector: "Health Systems",
    description: "Operational framework for scaling CHW programmes from pilot to system-level adoption. Covers recruitment, training, supervision, data systems, and government integration pathways.",
    status: "Available"
  },
  {
    icon: TrendingUp,
    title: "Smallholder Finance De-Risking Structures",
    sector: "Agritech",
    description: "Blended finance structures proven to unlock commercial agricultural credit for smallholder farmers. Includes templates for risk-sharing agreements, cooperative guarantees, and offtake-linked financing.",
    status: "Available"
  },
  {
    icon: BookOpen,
    title: "Nature-Based Solutions Carbon Finance Pathway",
    sector: "Climate",
    description: "Step-by-step implementation guide for community land organisations seeking to develop nature-based carbon projects, access advance climate finance, and submit to credible carbon registries.",
    status: "Coming Soon"
  }
];

const RESOURCES = {
  partnership: [
    { name: "Multi-Party MoU Template", type: "DOCX" },
    { name: "Consortium Governance Agreement", type: "DOCX" },
    { name: "Data Sharing Agreement", type: "DOCX" },
    { name: "Co-Funding Term Sheet", type: "XLSX" },
    { name: "Milestone Tracking Template", type: "XLSX" }
  ],
  reporting: [
    { name: "SDG Alignment Mapping Guide", type: "PDF" },
    { name: "Indicator Definition Dictionary", type: "PDF" },
    { name: "Donor-Ready Report Template", type: "DOCX" },
    { name: "Verification Readiness Checklist", type: "PDF" },
    { name: "Quarterly Impact Data Submission Form", type: "XLSX" }
  ],
  finance: [
    { name: "Blended Finance Deal Structuring Guide", type: "PDF" },
    { name: "Grant Alignment Assessment Tool", type: "XLSX" },
    { name: "First-Loss Capital Term Sheet Template", type: "DOCX" },
    { name: "Funder Due Diligence Preparation Pack", type: "PDF" }
  ],
  verification: [
    { name: "Organisational Verification Checklist", type: "PDF" },
    { name: "Governance Standards Self-Assessment", type: "XLSX" },
    { name: "Financial Controls Framework Guide", type: "PDF" },
    { name: "Impact Evidence Submission Guidelines", type: "PDF" }
  ]
};

export default function InsightsPage() {
  const params = useParams();
  const tab = params.tab || "dashboard";

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-24">
      <div className="mb-12 border-b pb-8">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          {tab === "dashboard" && "Impact Dashboard"}
          {tab === "case-studies" && "Case Studies"}
          {tab === "research" && "Research & Reports"}
          {tab === "solution-library" && "Solution Library"}
          {tab === "resources" && "Resource Hub"}
          {!["dashboard","case-studies","research","solution-library","resources"].includes(tab) && "Insights & Impact"}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          {tab === "dashboard" && "Ecosystem-level metrics, capital flows, and partnership data updated in real time."}
          {tab === "case-studies" && "Evidence from the ground. How organisations on Natives are solving Africa's most complex coordination problems."}
          {tab === "research" && "Ecosystem intelligence, funding analyses, and policy research from the Natives team and network."}
          {tab === "solution-library" && "Proven, replicable models and intervention playbooks ready for adaptation and deployment."}
          {tab === "resources" && "Templates, guides, and frameworks to support your work across partnerships, reporting, and verification."}
        </p>
      </div>

      {/* ── DASHBOARD ─────────────────────────────────────────── */}
      {tab === "dashboard" && (
        <div className="space-y-10 animate-in fade-in duration-500">
          {/* Top stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Capital Mobilized", value: "$0M+", sub: "Across all active programmes" },
              { label: "Partnerships Formed", value: "0", sub: "Cross-sector agreements" },
              { label: "Active Projects", value: "0", sub: "Across 3 launch sectors" },
              { label: "Geographic Reach", value: "0", sub: "African countries" }
            ].map((stat, i) => (
              <Card key={i} className="bg-card">
                <CardContent className="p-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{stat.label}</p>
                  <p className="text-4xl font-bold tracking-tight mb-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Capital Flow Over Time</CardTitle>
                  <Button variant="outline" size="sm"><Download className="w-3 h-3 mr-1.5" />Export</Button>
                </div>
                <CardDescription>Cumulative capital mobilized through the platform, by quarter</CardDescription>
              </CardHeader>
              <CardContent className="h-[260px] flex flex-col items-center justify-center bg-muted/20 rounded-b-lg border-t">
                <BarChart3 className="w-10 h-10 mb-3 text-muted-foreground/40" />
                <p className="font-mono text-xs text-muted-foreground">[Recharts Area Chart — live data on launch]</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">SDG Breakdown</CardTitle>
                <CardDescription>Programmes by primary SDG target</CardDescription>
              </CardHeader>
              <CardContent className="h-[260px] flex flex-col items-center justify-center bg-muted/20 rounded-b-lg border-t">
                <p className="font-mono text-xs text-muted-foreground">[Recharts Donut Chart]</p>
              </CardContent>
            </Card>
          </div>

          {/* Secondary metrics */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Partnerships by Sector</CardTitle>
                <CardDescription>Agritech · Climate · Health</CardDescription>
              </CardHeader>
              <CardContent className="h-[200px] flex flex-col items-center justify-center bg-muted/20 rounded-b-lg border-t">
                <p className="font-mono text-xs text-muted-foreground">[Recharts Bar Chart]</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Organisation Verification Rate</CardTitle>
                <CardDescription>% of registered orgs verified</CardDescription>
              </CardHeader>
              <CardContent className="h-[200px] flex flex-col items-center justify-center bg-muted/20 rounded-b-lg border-t">
                <p className="font-mono text-xs text-muted-foreground">[Recharts Radial Chart]</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Geographic Distribution</CardTitle>
                <CardDescription>Active programmes by country</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {["Kenya","Nigeria","South Africa","Senegal","Ghana"].map((country, i) => (
                  <div key={country} className="flex items-center gap-3">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1">{country}</span>
                    <div className="h-1.5 bg-muted rounded-full flex-1 max-w-[80px]">
                      <div
                        className="h-1.5 bg-primary rounded-full"
                        style={{ width: `${Math.max(15, 80 - i * 15)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono w-4">—</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* SDG indicator strip */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">SDG Indicator Tracking</CardTitle>
              <CardDescription>Outcome indicators aligned to UN Sustainable Development Goals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { sdg: "SDG 2", label: "Zero Hunger", metric: "0 farmers reached", color: "#DDA63A" },
                  { sdg: "SDG 3", label: "Good Health", metric: "0 patients served", color: "#4C9F38" },
                  { sdg: "SDG 8", label: "Decent Work", metric: "0 jobs supported", color: "#A21942" },
                  { sdg: "SDG 13", label: "Climate Action", metric: "0 tonnes CO₂ avoided", color: "#3F7E44" },
                  { sdg: "SDG 17", label: "Partnerships", metric: "0 active agreements", color: "#19486A" },
                  { sdg: "SDG 1", label: "No Poverty", metric: "0 households supported", color: "#E5243B" },
                  { sdg: "SDG 10", label: "Reduced Inequalities", metric: "0 beneficiaries", color: "#DD1367" },
                  { sdg: "SDG 11", label: "Sustainable Cities", metric: "0 communities", color: "#FD9D24" }
                ].map((item) => (
                  <div key={item.sdg} className="p-4 border rounded-lg bg-card">
                    <div className="text-xs font-bold mb-1" style={{ color: item.color }}>{item.sdg}</div>
                    <div className="text-sm font-medium mb-1">{item.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">{item.metric}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── CASE STUDIES ──────────────────────────────────────── */}
      {tab === "case-studies" && (
        <div className="space-y-10 animate-in fade-in duration-500">
          <div className="grid gap-8">
            {CASE_STUDIES.map((cs, i) => (
              <Card key={i} className="border-border hover:border-primary/40 transition-colors overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge className="bg-primary/10 text-primary border-transparent hover:bg-primary/20">{cs.sector}</Badge>
                    <Badge variant="outline" className="gap-1"><MapPin className="w-3 h-3" />{cs.country}</Badge>
                    <Badge variant="outline" className="text-[#2D6A4F] border-[#2D6A4F]/30 bg-[#2D6A4F]/5">{cs.sdg}</Badge>
                  </div>
                  <CardTitle className="text-xl md:text-2xl leading-snug">{cs.title}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-0">
                  <div className="grid md:grid-cols-2 gap-0 border rounded-lg overflow-hidden">
                    {[
                      { label: "Problem", icon: Target, content: cs.problem },
                      { label: "Stakeholders", icon: Users, content: cs.stakeholders },
                      { label: "Implementation", icon: ClipboardList, content: cs.implementation },
                      { label: "Outcomes", icon: FileCheck, content: cs.outcomes }
                    ].map((block, j) => (
                      <div key={j} className={`p-5 ${j < 2 ? "md:border-b" : ""} ${j % 2 === 0 ? "md:border-r" : ""} border-border bg-card`}>
                        <div className="flex items-center gap-2 mb-2">
                          <block.icon className={`w-4 h-4 shrink-0 ${block.label === "Outcomes" ? "text-[#2D6A4F]" : "text-muted-foreground"}`} />
                          <span className={`text-xs font-bold uppercase tracking-widest ${block.label === "Outcomes" ? "text-[#2D6A4F]" : "text-muted-foreground"}`}>
                            {block.label}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{block.content}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-5">
                    <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/5 px-0 font-medium" data-testid={`link-case-study-${i}`}>
                      Read full case study <ArrowUpRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── RESEARCH & REPORTS ────────────────────────────────── */}
      {tab === "research" && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {REPORTS.map((report, i) => (
            <div key={i} className="flex flex-col md:flex-row md:items-start gap-6 p-6 border rounded-xl bg-card hover:border-primary/40 transition-colors">
              <div className="w-12 h-12 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">{report.type}</Badge>
                  {report.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs bg-muted">{tag}</Badge>
                  ))}
                </div>
                <h3 className="font-bold text-lg leading-snug mb-2">{report.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{report.description}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{report.date}</span>
                </div>
              </div>

              <Button variant="outline" size="sm" className="shrink-0 self-start" data-testid={`button-download-report-${i}`}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download PDF
              </Button>
            </div>
          ))}

          <Separator className="my-4" />

          <div className="p-6 border border-dashed rounded-xl text-center">
            <p className="text-muted-foreground text-sm mb-4">More research published quarterly. Join Natives to receive new reports in your inbox.</p>
            <Button variant="outline" data-testid="button-subscribe-research">Subscribe to Research Updates</Button>
          </div>
        </div>
      )}

      {/* ── SOLUTION LIBRARY ──────────────────────────────────── */}
      {tab === "solution-library" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid md:grid-cols-2 gap-6">
            {SOLUTIONS.map((sol, i) => (
              <Card key={i} className={`border-border hover:border-primary/40 transition-colors group cursor-pointer ${sol.status === "Coming Soon" ? "opacity-70" : ""}`} data-testid={`card-solution-${i}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <sol.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <Badge
                      variant="outline"
                      className={sol.status === "Available"
                        ? "text-[#2D6A4F] border-[#2D6A4F]/40 bg-[#2D6A4F]/5 text-xs"
                        : "text-muted-foreground text-xs"}
                    >
                      {sol.status}
                    </Badge>
                  </div>
                  <Badge variant="secondary" className="w-fit text-xs mb-2 bg-primary/10 text-primary border-none">{sol.sector}</Badge>
                  <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors">{sol.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{sol.description}</p>
                  {sol.status === "Available" && (
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="outline" className="text-xs" data-testid={`button-view-playbook-${i}`}>
                        <BookOpen className="w-3.5 h-3.5 mr-1.5" />View Playbook
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" data-testid={`button-download-playbook-${i}`}>
                        <Download className="w-3.5 h-3.5 mr-1.5" />Download PDF
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="p-6 bg-card border rounded-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold mb-1">Have a model worth sharing?</h3>
                <p className="text-sm text-muted-foreground">Submit a proven intervention for review by the Natives team for inclusion in the library.</p>
              </div>
              <Button className="bg-primary text-white hover:bg-primary/90 shrink-0" data-testid="button-submit-model">
                Submit a Model
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESOURCE HUB ──────────────────────────────────────── */}
      {tab === "resources" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid md:grid-cols-2 gap-6">

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">Partnership Frameworks</CardTitle>
                </div>
                <CardDescription>Templates for structuring multi-stakeholder agreements and governance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {RESOURCES.partnership.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/40 cursor-pointer transition-colors" data-testid={`resource-partnership-${i}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{doc.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{doc.type}</span>
                      <Download className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded bg-[#2D6A4F]/10 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4 text-[#2D6A4F]" />
                  </div>
                  <CardTitle className="text-base">Reporting Guides</CardTitle>
                </div>
                <CardDescription>Standardised methodologies for impact measurement and donor reporting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {RESOURCES.reporting.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/40 cursor-pointer transition-colors" data-testid={`resource-reporting-${i}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{doc.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{doc.type}</span>
                      <Download className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">Finance & Funding Tools</CardTitle>
                </div>
                <CardDescription>Instruments for structuring blended finance and preparing for funder due diligence.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {RESOURCES.finance.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/40 cursor-pointer transition-colors" data-testid={`resource-finance-${i}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{doc.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{doc.type}</span>
                      <Download className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded bg-[#2D6A4F]/10 flex items-center justify-center">
                    <FileCheck className="w-4 h-4 text-[#2D6A4F]" />
                  </div>
                  <CardTitle className="text-base">Verification Resources</CardTitle>
                </div>
                <CardDescription>Guides and checklists for achieving institutional-grade organisational verification.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {RESOURCES.verification.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/40 cursor-pointer transition-colors" data-testid={`resource-verification-${i}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{doc.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{doc.type}</span>
                      <Download className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="p-6 bg-card border border-dashed rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold mb-1">Request a resource</h3>
              <p className="text-sm text-muted-foreground">Don't see what you need? Submit a request and the Natives team will prioritise it for the next update cycle.</p>
            </div>
            <Button variant="outline" className="shrink-0" data-testid="button-request-resource">Request a Resource</Button>
          </div>
        </div>
      )}
    </div>
  );
}
