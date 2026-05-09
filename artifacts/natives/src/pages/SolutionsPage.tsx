import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function SolutionsPage() {
  const params = useParams();
  const tab = params.tab || "overview";

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-24">
      <div className="mb-16 border-b pb-8">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          {tab === "overview" && "Solutions for the Ecosystem"}
          {tab === "ngos" && "For NGOs"}
          {tab === "corporates" && "For Corporates"}
          {tab === "donors-governments" && "For Donors & Governments"}
          {tab === "founders" && "For Founders"}
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl">
          Tailored infrastructure to accelerate your specific impact objectives across the continent.
        </p>
      </div>

      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-6">Built for scale</h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Whether you are deploying capital, implementing programs on the ground, or building the next generation of impact technology, Natives provides the coordination layer you need to move faster and with greater trust.
            </p>
            <ul className="space-y-6 mb-10">
              <li className="flex items-start">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary font-bold mr-4 text-sm mt-0.5">1</span>
                <span className="text-lg">Discover verified partners quickly.</span>
              </li>
              <li className="flex items-start">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary font-bold mr-4 text-sm mt-0.5">2</span>
                <span className="text-lg">Manage complex multi-stakeholder workflows.</span>
              </li>
              <li className="flex items-start">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary font-bold mr-4 text-sm mt-0.5">3</span>
                <span className="text-lg">Report on outcomes with standardized metrics.</span>
              </li>
            </ul>
          </div>
          <div className="border border-border bg-card rounded-xl aspect-square flex items-center justify-center overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(196,92,38,0.05)_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            <div className="text-center z-10 p-8 border bg-background shadow-lg rounded-lg max-w-xs">
              <h3 className="font-bold text-xl mb-2">Ecosystem Matrix</h3>
              <p className="text-sm text-muted-foreground font-mono">[Visual system representation]</p>
            </div>
          </div>
        </div>
      )}

      {tab === "ngos" && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold mb-6">Elevate your visibility and operational capacity</h2>

              <div className="space-y-6 text-lg leading-relaxed text-muted-foreground">
                <p>Most NGOs are invisible to the funders and partners that could accelerate their work. Natives gives your organisation a verified institutional profile that signals operational maturity — not just mission alignment — to donors, corporate ESG teams, and government procurement offices actively looking for implementation partners.</p>
                <p>Funding is rarely the bottleneck; access is. Natives surfaces co-funding opportunities, grant cycles, and partnership mandates that match your programme areas and geographic footprint, so you spend less time prospecting and more time delivering.</p>
                <p>Reporting demands from multiple funders create real operational drag. Natives standardises your SDG-aligned data collection and generates donor-ready impact reports automatically — one system, every funder format, without rebuilding the wheel each reporting cycle.</p>
                <p>Institutional verification through Natives signals to every potential partner that your organisation meets a baseline of governance, operational, and impact standards. That credibility travels with your profile across the entire ecosystem.</p>
              </div>

              <Button size="lg" className="mt-10 bg-primary text-white hover:bg-primary/90">Join as NGO <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
            <div className="bg-muted rounded-xl border p-8 flex items-center justify-center text-muted-foreground font-mono text-sm">
              [NGO Dashboard UI Placeholder]
            </div>
          </div>
        </div>
      )}

      {tab === "corporates" && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold mb-6">Execute local ESG strategies with verified partners</h2>

              <div className="space-y-6 text-lg leading-relaxed text-muted-foreground">
                <p>Corporate ESG commitments on the continent too often stall at the point of local execution — not because the intent isn't there, but because finding credible, verified implementation partners takes months of due diligence that most teams can't afford. Natives compresses that process into days, giving sustainability teams a pre-verified network of NGOs, social enterprises, and community organisations mapped to your sector focus and geographies.</p>
                <p>Global SDG frameworks mean nothing without localized evidence. Natives connects your ESG strategy to ground-level implementation data, tracking outcomes against the metrics your board, investors, and regulators actually care about — in formats that integrate with your existing reporting infrastructure.</p>
                <p>Managing multiple local partners across multiple markets creates coordination overhead that erodes impact. Natives gives your team a single workspace to align milestones, review deliverables, and maintain governance standards across every active programme — without relying on email threads and spreadsheets.</p>
                <p>When capital moves through third parties, transparency matters. Natives maintains a verifiable audit trail of how your ESG investment flows, what outcomes it drives, and how those results compare across initiatives — giving you the evidence base to scale what works and retire what doesn't.</p>
              </div>

              <Button size="lg" className="mt-10 bg-primary text-white hover:bg-primary/90">Join as Corporate <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
            <div className="bg-muted rounded-xl border p-8 flex items-center justify-center text-muted-foreground font-mono text-sm">
              [Corporate ESG Tracking UI Placeholder]
            </div>
          </div>
        </div>
      )}

      {tab === "donors-governments" && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold mb-6">Deploy capital with systemic visibility</h2>

              <div className="space-y-6 text-lg leading-relaxed text-muted-foreground">
                <p>Institutional funders and government agencies face a persistent problem: capital is available, but the ecosystem intelligence needed to allocate it well is fragmented, delayed, or simply absent. Natives gives donors and DFIs a real-time view of verified organisations, active programmes, and funding gaps across the sectors and geographies that matter to their mandates.</p>
                <p>Duplicated effort is one of the impact ecosystem's most avoidable costs. Natives surfaces what is already funded, what is being implemented, and where unmet need is concentrated — so your next grant round complements existing capital rather than competing with it or leaving critical gaps unfilled.</p>
                <p>Grantee due diligence is expensive and inconsistent. Natives maintains institutional-grade verification records for every organisation on the platform, giving your team a standardised baseline of governance, operational capacity, and impact evidence before the first conversation.</p>
                <p>Systemic change requires systemic measurement. Natives aggregates outcome data across your entire portfolio into a single dashboard — comparable across grantees, mapped against SDG indicators, and formatted for the reporting obligations your institution carries to boards and governments.</p>
              </div>

              <Button size="lg" className="mt-10 bg-primary text-white hover:bg-primary/90">Join as Funder <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
            <div className="bg-muted rounded-xl border p-8 flex items-center justify-center text-muted-foreground font-mono text-sm">
              [Capital Allocation & Tracking UI Placeholder]
            </div>
          </div>
        </div>
      )}

      {tab === "founders" && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold mb-6">Accelerate from model to institution</h2>

              <div className="space-y-6 text-lg leading-relaxed text-muted-foreground">
                <p>Impact founders building new models in Africa rarely lack vision — they lack the institutional connective tissue to validate and scale it. Natives gives founders access to a structured network of established NGOs and corporates willing to act as proof-of-concept partners, providing the on-the-ground evidence that early-stage funders and accelerators require before committing capital.</p>
                <p>Blended finance is the right instrument for early-stage impact ventures, but navigating it alone is a full-time job. Natives maps your model against available pathways — grants, patient capital, impact investment, prizes, accelerator programmes, and co-funding arrangements — and surfaces the opportunities best suited to your stage, sector, and geography without requiring you to already know the right rooms to be in.</p>
                <p>Building the right team is as hard as finding the right funding. Natives connects founders with technical co-founders, sector specialists, and early collaborators who share your model's purpose and bring the complementary skills needed to move from pilot to programme at scale.</p>
                <p>Your journey on Natives has a clear progression: from a founder profile with a validated concept, to a registered organisation with institutional standing, verified impact data, and a full partner network. The infrastructure you build here follows you as your organisation grows.</p>
              </div>

              <Button size="lg" className="mt-10 bg-primary text-white hover:bg-primary/90">Join as Founder <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </div>
            <div className="bg-muted rounded-xl border p-8 flex items-center justify-center text-muted-foreground font-mono text-sm">
              [Founder Pathway UI Placeholder]
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
