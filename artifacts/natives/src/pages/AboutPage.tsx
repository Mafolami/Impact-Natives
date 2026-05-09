import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <div className="container max-w-4xl py-12 md:py-24">
      <div className="mb-20">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 leading-tight">
          We are building the coordination layer for Africa's future.
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl">
          Natives is the institutional-grade digital infrastructure required to align capital, verify outcomes, and scale partnerships across the continent.
        </p>
      </div>

      <div className="space-y-24">
        <section className="prose prose-lg dark:prose-invert max-w-none">
          <h2 className="text-3xl font-bold tracking-tight text-foreground border-b pb-4">The Mission</h2>
          <p className="text-lg leading-relaxed mt-6">
            Africa's impact economy does not lack capital or capability; it suffers from a severe coordination failure. Organizations doing incredible work remain invisible to global funders. Due diligence is duplicative, expensive, and opaque. Funders deploy capital in silos, missing opportunities for systemic leverage.
          </p>
          <p className="text-lg leading-relaxed">
            Natives exists to provide the digital plumbing that allows this ecosystem to operate as a coherent, high-velocity network rather than fragmented islands of intervention.
          </p>
        </section>

        <section>
          <h2 className="text-3xl font-bold tracking-tight mb-8 border-b pb-4">Our Principles</h2>
          <div className="grid md:grid-cols-2 gap-8 mt-8">
            <div>
              <h3 className="text-xl font-bold mb-2">Institutional Trust</h3>
              <p className="text-muted-foreground">Verification mechanisms must satisfy the highest global compliance standards to unlock capital at scale.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Data-First</h3>
              <p className="text-muted-foreground">We prioritize objective metrics and standardized reporting over narrative-driven claims.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Workflow-Centric</h3>
              <p className="text-muted-foreground">We build tools that integrate into daily operations, not just another dashboard to update quarterly.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Mobile-First for Africa</h3>
              <p className="text-muted-foreground">Designed for the realities of digital access across the continent without compromising institutional features.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold tracking-tight mb-8 border-b pb-4">Launch Sectors</h2>
          <p className="text-lg text-muted-foreground mb-8">We are focusing our initial infrastructure deployment on the sectors critical to the continent's resilience and growth.</p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 border rounded-xl bg-card">
              <h3 className="text-xl font-bold mb-3 text-primary">Agritech</h3>
              <p className="text-sm text-muted-foreground">Food security, supply chain efficiency, and smallholder resilience models.</p>
            </div>
            <div className="p-6 border rounded-xl bg-card">
              <h3 className="text-xl font-bold mb-3 text-primary">Climate</h3>
              <p className="text-sm text-muted-foreground">Adaptation financing, renewable energy transition, and carbon project verification.</p>
            </div>
            <div className="p-6 border rounded-xl bg-card">
              <h3 className="text-xl font-bold mb-3 text-primary">Health</h3>
              <p className="text-sm text-muted-foreground">Last-mile delivery, data interoperability, and preventative care systems.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold tracking-tight mb-8 border-b pb-4">Team & Network</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="group">
                <div className="aspect-square bg-muted rounded-lg mb-4 flex items-center justify-center text-muted-foreground font-mono text-sm border group-hover:border-primary/50 transition-colors">
                  [Photo]
                </div>
                <h4 className="font-bold">Team Member {i}</h4>
                <p className="text-sm text-muted-foreground">Role / Title Placeholder</p>
              </div>
            ))}
          </div>

          <h3 className="text-2xl font-bold tracking-tight mb-6">Partners & Advisors</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[3/2] border rounded-md flex items-center justify-center text-xs text-muted-foreground bg-muted/20 grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100">
                [Logo {i}]
              </div>
            ))}
          </div>
        </section>

        <section className="bg-muted p-12 rounded-2xl text-center">
          <h2 className="text-2xl font-bold mb-4">Build with us</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">We are actively onboarding founding partners to help shape the infrastructure.</p>
          <div className="flex justify-center gap-4">
             <Link href="/partner">
               <Button size="lg" className="bg-primary text-white hover:bg-primary/90">Contact Team</Button>
             </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
