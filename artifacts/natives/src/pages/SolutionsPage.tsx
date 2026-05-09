import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Eye, Funnel, FileText, ShieldCheck,
  Users, BarChart3, Layers, Lock, Globe, GitMerge,
  Network, TrendingUp, MoveUpRight
} from "lucide-react";

const TABS = [
  { id: "ngos", label: "For NGOs" },
  { id: "corporates", label: "For Corporates" },
  { id: "donors-governments", label: "For Donors & Governments" },
  { id: "founders", label: "For Founders" },
];

const AUDIENCE = {
  ngos: {
    headline: "Elevate your visibility and operational capacity",
    sub: "Infrastructure for implementation organisations that want to move faster and be taken more seriously.",
    cta: "Join as NGO",
    cards: [
      {
        icon: Eye,
        title: "Institutional Visibility",
        body: "Most NGOs are invisible to the funders and partners that could accelerate their work. Natives gives your organisation a verified institutional profile that signals operational maturity — not just mission alignment — to donors, corporate ESG teams, and government procurement offices actively looking for implementation partners."
      },
      {
        icon: FileText,
        title: "Aligned Funding Access",
        body: "Funding is rarely the bottleneck; access is. Natives surfaces co-funding opportunities, grant cycles, and partnership mandates that match your programme areas and geographic footprint, so you spend less time prospecting and more time delivering."
      },
      {
        icon: BarChart3,
        title: "Automated Impact Reporting",
        body: "Reporting demands from multiple funders create real operational drag. Natives standardises your SDG-aligned data collection and generates donor-ready impact reports automatically — one system, every funder format, without rebuilding the wheel each reporting cycle."
      },
      {
        icon: ShieldCheck,
        title: "Institutional Verification",
        trust: true,
        body: "Institutional verification through Natives signals to every potential partner that your organisation meets a baseline of governance, operational, and impact standards. That credibility travels with your profile across the entire ecosystem."
      }
    ]
  },
  corporates: {
    headline: "Execute local ESG strategies with verified partners",
    sub: "Purpose-built for sustainability teams that need to act with confidence on the ground.",
    cta: "Join as Corporate",
    cards: [
      {
        icon: Users,
        title: "Verified Local Partners",
        body: "Corporate ESG commitments on the continent too often stall at the point of local execution — not because the intent isn't there, but because finding credible, verified implementation partners takes months of due diligence that most teams can't afford. Natives compresses that process into days, giving sustainability teams a pre-verified network of NGOs, social enterprises, and community organisations mapped to your sector focus and geographies."
      },
      {
        icon: Globe,
        title: "Localized ESG Evidence",
        body: "Global SDG frameworks mean nothing without localized evidence. Natives connects your ESG strategy to ground-level implementation data, tracking outcomes against the metrics your board, investors, and regulators actually care about — in formats that integrate with your existing reporting infrastructure."
      },
      {
        icon: Layers,
        title: "Single Programme Workspace",
        body: "Managing multiple local partners across multiple markets creates coordination overhead that erodes impact. Natives gives your team a single workspace to align milestones, review deliverables, and maintain governance standards across every active programme — without relying on email threads and spreadsheets."
      },
      {
        icon: Lock,
        title: "Verifiable Capital Transparency",
        body: "When capital moves through third parties, transparency matters. Natives maintains a verifiable audit trail of how your ESG investment flows, what outcomes it drives, and how those results compare across initiatives — giving you the evidence base to scale what works and retire what doesn't."
      }
    ]
  },
  "donors-governments": {
    headline: "Deploy capital with systemic visibility",
    sub: "Tools for institutional allocators who need ecosystem intelligence before and after every commitment.",
    cta: "Join as Funder",
    cards: [
      {
        icon: Globe,
        title: "Ecosystem Intelligence",
        body: "Institutional funders and government agencies face a persistent problem: capital is available, but the ecosystem intelligence needed to allocate it well is fragmented, delayed, or simply absent. Natives gives donors and DFIs a real-time view of verified organisations, active programmes, and funding gaps across the sectors and geographies that matter to their mandates."
      },
      {
        icon: GitMerge,
        title: "Coordination Without Duplication",
        body: "Duplicated effort is one of the impact ecosystem's most avoidable costs. Natives surfaces what is already funded, what is being implemented, and where unmet need is concentrated — so your next grant round complements existing capital rather than competing with it or leaving critical gaps unfilled."
      },
      {
        icon: ShieldCheck,
        title: "Standardised Due Diligence",
        trust: true,
        body: "Grantee due diligence is expensive and inconsistent. Natives maintains institutional-grade verification records for every organisation on the platform, giving your team a standardised baseline of governance, operational capacity, and impact evidence before the first conversation."
      },
      {
        icon: BarChart3,
        title: "Portfolio-Level Measurement",
        body: "Systemic change requires systemic measurement. Natives aggregates outcome data across your entire portfolio into a single dashboard — comparable across grantees, mapped against SDG indicators, and formatted for the reporting obligations your institution carries to boards and governments."
      }
    ]
  },
  founders: {
    headline: "Accelerate from model to institution",
    sub: "From first validation to registered organisation — the infrastructure that grows with you.",
    cta: "Join as Founder",
    cards: [
      {
        icon: Network,
        title: "Proof-of-Concept Partners",
        body: "Impact founders building new models in Africa rarely lack vision — they lack the institutional connective tissue to validate and scale it. Natives gives founders access to a structured network of established NGOs and corporates willing to act as proof-of-concept partners, providing the on-the-ground evidence that early-stage funders and accelerators require before committing capital."
      },
      {
        icon: TrendingUp,
        title: "Blended Finance Pathways",
        body: "Blended finance is the right instrument for early-stage impact ventures, but navigating it alone is a full-time job. Natives maps your model against available pathways — grants, patient capital, impact investment, prizes, accelerator programmes, and co-funding arrangements — and surfaces the opportunities best suited to your stage, sector, and geography without requiring you to already know the right rooms to be in."
      },
      {
        icon: Users,
        title: "Team & Co-Founder Discovery",
        body: "Building the right team is as hard as finding the right funding. Natives connects founders with technical co-founders, sector specialists, and early collaborators who share your model's purpose and bring the complementary skills needed to move from pilot to programme at scale."
      },
      {
        icon: MoveUpRight,
        title: "A Clear Progression Pathway",
        body: "Your journey on Natives has a clear progression: from a founder profile with a validated concept, to a registered organisation with institutional standing, verified impact data, and a full partner network. The infrastructure you build here follows you as your organisation grows."
      }
    ]
  }
};

export default function SolutionsPage() {
  const params = useParams();
  const tab = (params.tab as keyof typeof AUDIENCE) || "ngos";
  const audience = AUDIENCE[tab] ?? AUDIENCE["ngos"];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20">

      {/* Page header */}
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">Solutions</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Tailored infrastructure to accelerate your specific impact objectives across the continent.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 mb-12 border-b border-border pb-0">
        {TABS.map(({ id, label }) => {
          const isActive = tab === id;
          return (
            <Link key={id} href={`/solutions/${id}`}>
              <button
                data-testid={`tab-solutions-${id}`}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {label}
              </button>
            </Link>
          );
        })}
      </div>

      {/* Section header */}
      <div className="mb-10">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{audience.headline}</h2>
        <p className="text-muted-foreground text-lg">{audience.sub}</p>
      </div>

      {/* Feature card grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-12 animate-in fade-in slide-in-from-bottom-2 duration-400">
        {audience.cards.map((card, i) => (
          <div
            key={i}
            className={`bg-card border rounded-xl p-8 flex flex-col gap-4 transition-colors ${"trust" in card && card.trust ? "border-[#2D6A4F]/25 hover:border-[#2D6A4F]/50" : "border-border hover:border-primary/30"}`}
            data-testid={`card-solution-benefit-${i}`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${"trust" in card && card.trust ? "bg-[#2D6A4F]/10" : "bg-primary/10"}`}>
              <card.icon className={`w-5 h-5 ${"trust" in card && card.trust ? "text-[#2D6A4F]" : "text-primary"}`} />
            </div>
            <h3 className="text-lg font-bold leading-snug">{card.title}</h3>
            <p className="text-muted-foreground leading-relaxed text-[15px]">{card.body}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex items-center gap-4">
        <Link href="/signup/role">
          <Button size="lg" className="bg-primary text-white hover:bg-primary/90" data-testid={`button-cta-${tab}`}>
            {audience.cta} <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
        <Link href="/partner">
          <Button size="lg" variant="outline" data-testid="button-book-demo">Book a Demo</Button>
        </Link>
      </div>

    </div>
  );
}
