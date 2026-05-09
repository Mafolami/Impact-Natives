import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function SolutionsPage() {
  const params = useParams();
  const tab = params.tab || "overview";

  return (
    <div className="container max-w-6xl py-12 md:py-24">
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
              <p className="text-lg text-muted-foreground mb-8">Natives helps implementation organizations signal institutional readiness, discover aligned funding, and streamline reporting burdens.</p>
              
              <ul className="space-y-4">
                {[
                  "Gain visibility among institutional donors and corporate ESG teams",
                  "Access structured partnership and co-funding opportunities",
                  "Automate SDG-aligned reporting with standardized templates",
                  "Demonstrate operational maturity through institutional-grade verification"
                ].map((item, i) => (
                  <li key={i} className="flex items-start bg-card p-4 rounded-lg border border-border">
                    <CheckCircle2 className="w-5 h-5 text-[#2D6A4F] mr-3 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              
              <Button size="lg" className="mt-8 bg-primary text-white hover:bg-primary/90">Join as NGO <ArrowRight className="w-4 h-4 ml-2" /></Button>
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
              <p className="text-lg text-muted-foreground mb-8">Natives provides corporate sustainability teams with a verified network of local implementers and transparent outcome tracking.</p>
              
              <ul className="space-y-4">
                {[
                  "Discover pre-vetted local implementation partners",
                  "Track localized ESG outcomes against global SDG frameworks",
                  "Manage multi-partner initiatives from a single dashboard",
                  "Ensure compliance and transparency in localized capital deployment"
                ].map((item, i) => (
                  <li key={i} className="flex items-start bg-card p-4 rounded-lg border border-border">
                    <CheckCircle2 className="w-5 h-5 text-[#2D6A4F] mr-3 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              
              <Button size="lg" className="mt-8 bg-primary text-white hover:bg-primary/90">Join as Corporate <ArrowRight className="w-4 h-4 ml-2" /></Button>
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
              <p className="text-lg text-muted-foreground mb-8">Natives offers institutional capital allocators the infrastructure to coordinate funding, verify outcomes, and avoid duplicative efforts.</p>
              
              <ul className="space-y-4">
                {[
                  "Identify co-funding opportunities to scale successful models",
                  "Rely on institutional-grade verification for grantee discovery",
                  "Aggregate ecosystem data to inform strategic policy and funding allocation",
                  "Measure systemic outcomes across localized interventions"
                ].map((item, i) => (
                  <li key={i} className="flex items-start bg-card p-4 rounded-lg border border-border">
                    <CheckCircle2 className="w-5 h-5 text-[#2D6A4F] mr-3 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              
              <Button size="lg" className="mt-8 bg-primary text-white hover:bg-primary/90">Join as Funder <ArrowRight className="w-4 h-4 ml-2" /></Button>
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
              <p className="text-lg text-muted-foreground mb-8">Natives connects impact founders with the capital, institutional partners, and talent needed to scale breakthrough models.</p>
              
              <ul className="space-y-4">
                {[
                  "Access blended finance pathways: grants, patient capital, accelerators",
                  "Discover proof-of-concept partners among established NGOs and corporates",
                  "Find technical co-founders and early team members",
                  "Establish a clear progression pathway from founder to registered organisation"
                ].map((item, i) => (
                  <li key={i} className="flex items-start bg-card p-4 rounded-lg border border-border">
                    <CheckCircle2 className="w-5 h-5 text-[#2D6A4F] mr-3 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              
              <Button size="lg" className="mt-8 bg-primary text-white hover:bg-primary/90">Join as Founder <ArrowRight className="w-4 h-4 ml-2" /></Button>
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
