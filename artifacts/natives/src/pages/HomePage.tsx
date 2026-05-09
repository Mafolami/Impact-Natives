import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Network, Database, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen w-full font-sans">
      {/* Hero Section */}
      <section className="px-6 pt-24 md:pt-32 pb-24 md:pb-40 max-w-6xl mx-auto w-full text-center relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(196,92,38,0.05),transparent_50%)]"></div>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-foreground mb-8 leading-[1.1]">
          The coordination <br className="hidden md:block"/>infrastructure for <br className="hidden md:block"/><span className="text-primary">Africa's impact economy</span>
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed">
          Natives provides institutional-grade digital tooling to align funding, verify impact, and scale partnerships across the continent.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-10 bg-primary hover:bg-primary/90 text-white font-semibold">Join Natives</Button>
          </Link>
          <Link href="/partner">
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-10 border-border font-semibold hover:bg-muted">Request Partnership</Button>
          </Link>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="border-y border-border bg-card w-full py-8 overflow-hidden">
        <div className="container grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 text-center divide-x divide-border">
          <div className="flex flex-col space-y-1">
            <span className="text-3xl md:text-4xl font-bold tracking-tighter text-foreground">$0M+</span>
            <span className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-widest">Capital Mobilized</span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-3xl md:text-4xl font-bold tracking-tighter text-foreground">0</span>
            <span className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-widest">Partnerships Formed</span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-3xl md:text-4xl font-bold tracking-tighter text-foreground">0</span>
            <span className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-widest">Active Projects</span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-3xl md:text-4xl font-bold tracking-tighter text-foreground">0</span>
            <span className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-widest">Geographic Reach</span>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-24 md:py-32 container max-w-5xl">
         <div className="max-w-3xl">
           <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">The Coordination Gap</h2>
           <p className="text-xl text-muted-foreground leading-relaxed mb-12">
             Capital is abundant but fragmented. Incredible work remains invisible. Due diligence is duplicative and opaque. We are fixing the digital plumbing of the ecosystem so the real work can scale.
           </p>
         </div>
      </section>

      {/* How Natives Works - Visual System */}
      <section className="py-24 bg-muted/30 border-y">
        <div className="container max-w-6xl">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">The Operating System for Impact</h2>
            <p className="text-xl text-muted-foreground max-w-2xl">Four interconnected infrastructure layers designed to eliminate friction and build institutional trust.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            <Card className="bg-card hover:border-primary/30 transition-colors">
              <CardContent className="p-8 md:p-10">
                <Network className="w-10 h-10 text-primary mb-6" />
                <h3 className="text-2xl font-bold mb-3">Discovery</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">Find verified organizations, active projects, and aligned funding opportunities across sectors with deep data visibility.</p>
              </CardContent>
            </Card>

            <Card className="bg-card hover:border-primary/30 transition-colors">
              <CardContent className="p-8 md:p-10">
                <Database className="w-10 h-10 text-primary mb-6" />
                <h3 className="text-2xl font-bold mb-3">Partnership</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">Structured collaboration with integrated workflow tools, shared milestone tracking, and dedicated workspaces.</p>
              </CardContent>
            </Card>

            <Card className="bg-card hover:border-primary/30 transition-colors">
              <CardContent className="p-8 md:p-10">
                <Zap className="w-10 h-10 text-primary mb-6" />
                <h3 className="text-2xl font-bold mb-3">Funding</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">Grant alignment, multi-party co-funding coordination, and structured pathways for blended finance deployment.</p>
              </CardContent>
            </Card>

            <Card className="bg-card hover:border-[#2D6A4F]/30 transition-colors">
              <CardContent className="p-8 md:p-10">
                <ShieldCheck className="w-10 h-10 text-[#2D6A4F] mb-6" />
                <h3 className="text-2xl font-bold mb-3">Trust</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">Verification badges, standardized SDG mapping, and institutional-grade transparency signals that satisfy compliance requirements.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stakeholders */}
      <section className="py-24 md:py-32 container max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Built for the entire ecosystem</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { role: "NGO", desc: "Gain visibility, access funding, and automate donor reporting." },
            { role: "Corporate", desc: "Execute ESG strategies with verified local implementation partners." },
            { role: "Government", desc: "Coordinate regional initiatives and track systemic outcomes." },
            { role: "Donor / DFI", desc: "Identify co-funding opportunities and aggregate impact data." },
            { role: "Founder", desc: "Validate models and access blended finance pathways to scale." },
            { role: "Ecosystem Expert", desc: "Provide specialized verification and consulting services." }
          ].map((item) => (
            <div key={item.role} className="border rounded-xl p-8 bg-card hover:shadow-sm transition-shadow">
              <h3 className="font-bold text-xl mb-2">{item.role}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-24 bg-card border-t border-border text-center">
        <div className="container max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-8">Ready to build the infrastructure?</h2>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
             <Link href="/signup">
               <Button size="lg" className="w-full sm:w-auto h-12 px-8 bg-primary hover:bg-primary/90 text-white font-semibold">Join Natives</Button>
             </Link>
             <Link href="/platform">
               <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 font-semibold">Explore Ecosystem</Button>
             </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
