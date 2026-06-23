import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShieldCheck, AlignJustify, Lock } from "lucide-react";

const ALIGN = [
  { letter: 'A', word: 'Accountability', desc: 'Every profile on Natives is verifiable. Claims about what an org does, where they have worked, what they have delivered. None of it is unchecked. When someone finds a partner on Natives, they are not taking a leap of faith.' },
  { letter: 'L', word: 'Linkage',        desc: 'The platform does not just surface information. It creates actual connections: EOI submissions, conversation threads, partnership confirmations. Linkage means the infrastructure closes the gap between finding someone relevant and working with them.' },
  { letter: 'I', word: 'Intentionality', desc: 'Every feature pushes users toward purposeful decisions. Sector tags, partner filters, initiative categories exist so people connect with whoever is actually right, not just whoever is visible.' },
  { letter: 'G', word: 'Governance',     desc: 'Partnerships on Natives have structure and oversight. That is what separates Natives from a directory or contact list, and what makes the ecosystem credible to funders and institutions.' },
  { letter: 'N', word: 'Networks',       desc: 'We measure network value by what gets built through it, not by how many people are in it. A connection on Natives only counts if both sides gain from it.' },
]

export default function AboutPage() {
  return (
    <div className="w-full">

      {/* ── HERO ── */}
      <section
        className="relative w-full min-h-[75vh] flex items-start overflow-hidden"
                style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)', marginTop: '-64px', paddingTop: '64px', backgroundImage: 'linear-gradient(135deg, #060f09, #0d2b1a, #0a1f13, #3d1a08, #1a0a04, #060f09)', backgroundSize: '300% 300%', animation: 'fp-chameleon 18s ease infinite' }}
      >
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
        <div className="relative z-10 max-w-screen-2xl mx-auto content-padding hp-hero py-24 md:py-32 w-full">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-semibold text-white tracking-wide">About Natives</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 max-w-3xl leading-[1.1]">
            The coordination layer for Africa's{" "}
            <span style={{ color: '#f0e6d3' }}>social impact economy.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl">
            We run the institutional-grade digital infrastructure required to align capital, verify outcomes, and scale partnerships across the continent.
          </p>
        </div>
      </section>

      {/* ── CONTENT ── */}
<div className="w-full">

{/* 1. Problem We Saw — default bg */}
<div className="max-w-screen-2xl mx-auto content-padding hp-hero py-16 md:py-24">
  <section className="grid lg:grid-cols-2 gap-12 items-start">
  <div>
  <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Why We Built This</p>
  <h2 className="text-3xl font-bold tracking-tight text-foreground mb-6">
    The Problem We Saw
  </h2>
  <p className="text-muted-foreground text-lg leading-relaxed mb-4">
    Africa is full of people with the right ideas and the wrong circumstances. Good ideas die every day, not because they are not credible, but because the person holding them cannot get into the right rooms and has no infrastructure to turn intent into action.
  </p>
  <p className="text-muted-foreground text-lg leading-relaxed mb-4">
    But that is only half the problem.
  </p>
  <p className="text-muted-foreground text-lg leading-relaxed">
    On the other side, there are organisations doing serious, proven work. And they are still finding partners through personal networks and luck. Still starting every collaboration from scratch. Still spending months vetting someone they should have been able to find and trust in a week.
  </p>
</div>
    <div style={{ borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid hsl(var(--border))' }}>
      {[
        {
          num: "01",
          title: "Ideas with nowhere to go",
          body: "Individuals and organisations with credible, fundable ideas have no single place to put them in front of the right partners, funders, or co-implementers. The idea stays in a deck, or a conversation, or a head.",
        },
        {
          num: "02",
          title: "Access is gatekept by proximity",
          body: "Making impact has historically required knowing someone — attending the right conference, being in the right city, having the right institutional affiliation. That shuts out most of the people closest to the problems.",
        },
        {
          num: "03",
          title: "Coordination is expensive and fragmented",
          body: "The same due diligence gets done four times by four different funders. The same NGO pitches the same grant to three different corporates in the same quarter. Nobody wins.",
        },
        {
          num: "04",
          title: "Credibility is hard to signal",
          body: "A small NGO in the East with a strong track record looks identical to one with none. Without infrastructure to verify and surface credibility, trust takes years to build — and partnerships that should happen, don't.",
        },
      ].map((item, i, arr) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: '1.25rem',
          padding: '1.375rem 1.75rem',
          borderBottom: i < arr.length - 1 ? '1px solid hsl(var(--border))' : 'none',
        }} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
          <div style={{
            width: '2.375rem', height: '2.375rem', borderRadius: '0.625rem',
            background: 'rgba(196,92,38,0.1)', border: '1px solid rgba(196,92,38,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontWeight: 800, fontSize: '0.8125rem', color: '#C45C26',
          }}>
            {item.num}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem', letterSpacing: '-0.015em' }} className="text-foreground">
              {item.title}
            </div>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.65 }} className="text-muted-foreground">{item.body}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
</div>

{/* 2. Mission — muted full bleed */}
<div className="w-full bg-muted/40 border-y border-border">
  <div className="max-w-screen-2xl mx-auto content-padding hp-hero py-16 md:py-24">
    <section className="grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <div className="w-10 h-[3px] rounded-full mb-6" style={{ background: '#2D6A4F' }} />
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-6">
          The Mission
        </h2>
        <p className="text-lg leading-relaxed text-muted-foreground mb-8">
        Impact should not require permission and opportunity should not depend on who you know. Natives is the infrastructure that 
        connects capital, talent, and ideas — so anyone, anywhere on the continent, with a credible idea and the drive to see it through, 
        can find the right partners and get to work.
        </p>
        <Link href="/signup">
          <Button size="lg" className="bg-primary text-white hover:bg-primary/90 rounded-full px-8">
            Join the Mission →
          </Button>
        </Link>
      </div>
      <div className="rounded-3xl p-12 flex flex-col items-center justify-center text-center min-h-[360px]"
        style={{ background: 'rgba(45,106,79,0.08)', border: '1px solid rgba(45,106,79,0.15)' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(45,106,79,0.12)', border: '1px solid rgba(45,106,79,0.2)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>
        
        <p className="text-muted-foreground leading-relaxed max-w-xs">
        The best ideas don't care where you're from. Now neither does the infrastructure.
        </p>
      </div>
    </section>
  </div>
</div>

{/* 3. ALIGN — default bg */}
<div className="max-w-screen-2xl mx-auto content-padding hp-hero py-16 md:py-24">
  <section>
    <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Our Framework</p>
    <h2 className="text-3xl font-bold tracking-tight mb-4">Our Principles</h2>
    <p className="text-muted-foreground text-lg max-w-2xl mb-10">
      ALIGN guides how Natives approaches coordination, verification, and ecosystem infrastructure — what it takes to build trust and move capital effectively across Africa's impact sector.
    </p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {ALIGN.map((item, i) => (
        <div key={i}
        className="rounded-xl p-5 flex flex-col gap-3 border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
          style={undefined }>
          <div style={{
            width: '2.375rem', height: '2.375rem', borderRadius: '0.625rem',
            background: 'rgba(196,92,38,0.1)', border: '1px solid rgba(196,92,38,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontWeight: 800, fontSize: '0.9375rem', color: '#C45C26',
          }}>
            {item.letter}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem', letterSpacing: '-0.015em' }} className="text-foreground">
              {item.word}
            </div>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.65 }} className="text-muted-foreground">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
</div>

{/* 4. What You Get — chameleon full bleed */}
<div className="w-full border-y border-white/10" style={{ backgroundImage: 'linear-gradient(135deg, #3d1a08, #0d3040, #3d2a1a, #2d2000, #0a2030, #3d1a08)', backgroundSize: '300% 300%', animation: 'fp-chameleon 18s ease infinite' }}>
  <div className="max-w-screen-2xl mx-auto content-padding hp-hero py-16 md:py-24">
    <p className="text-xs font-semibold uppercase tracking-widest text-center mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Membership</p>
    <h2 className="text-2xl md:text-3xl font-bold mb-3 text-center text-white">What You Get</h2>
    <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
      <div className="rounded-2xl p-6 md:p-8 flex flex-col" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.12)" }}>
            <Lock className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Exploring</h3>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>No account required</p>
          </div>
        </div>
        <ul className="space-y-3 flex-1">
          {[
            "Browse up to 4 live initiatives",
            "Discover organisations working on problems you care about",
            "Explore the verified partner network — join to connect",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
              <span className="mt-0.5 shrink-0">○</span> {item}
            </li>
          ))}
        </ul>
        <Link href="/signup" className="mt-8">
          <Button variant="outline" className="w-full text-white border-white/30 bg-transparent hover:bg-white/10">
            Create Free Account
          </Button>
        </Link>
      </div>
      <div className="rounded-2xl p-6 md:p-8 flex flex-col relative overflow-hidden" style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.45)", backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)' }}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-1/2 translate-x-1/2" style={{ background: "rgba(255,255,255,0.03)" }} />
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.12)" }}>
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Active Member</h3>
            <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>Free now</p>
          </div>
        </div>
        <ul className="space-y-3 flex-1">
          {[
            "Build a verified profile that puts you in front of funders and partners actively looking",
            "Post initiatives to the marketplace and receive expressions of interest directly",
            "Express interest in initiatives and connect with the organisations behind them",
            "Message matched partners and manage conversations in one place",
            "Access the full verified partner directory.",
            "Commission a lab and track your progress.",
            "Get AI-matched to partners that fit your profile, sector, and stated goals",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-white">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "rgba(196,92,38,0.8)" }} /> {item}
            </li>
          ))}
        </ul>
        <Link href="/signup" className="mt-8">
          <Button className="w-full text-white font-semibold" style={{ background: "rgba(196,92,38,0.85)", border: "none" }}>
            Join as a Founding Member
          </Button>
        </Link>
      </div>
    </div>
  </div>
</div>

{/* 5. Trust & Verification — muted full bleed */}
<div className="w-full bg-muted/40 border-b border-border">
  <div className="max-w-screen-2xl mx-auto content-padding hp-hero py-16 md:py-24">
    <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">How Trust Works</p>
    <h2 className="text-3xl font-bold mb-2">Trust & Verification</h2>
    <p className="text-muted-foreground text-lg max-w-2xl mb-10">
      Every organisation on Natives goes through a verification process — legal registration, track record review, and profile completeness checks. This gives partners and funders confidence before they engage.
    </p>
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-full bg-[#2D6A4F]/08 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-[#2D6A4F]/70" />
          </div>
          <CardTitle className="text-base">Verified Entity</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Legal registration, beneficial ownership, and compliance checks completed.</p>
        </CardContent>
      </Card>
      <Card className="border-border shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-full bg-primary/08 flex items-center justify-center mx-auto mb-4">
            <AlignJustify className="w-7 h-7 text-primary/70" />
          </div>
          <CardTitle className="text-base">Track Record</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Demonstrated history of successful project execution and fund management.</p>
        </CardContent>
      </Card>
      <Card className="border-border shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-full bg-blue-500/08 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-blue-500/70" />
          </div>
          <CardTitle className="text-base">Data Integrity</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Impact data is structured, self-reported, and supported by third-party evaluation links where available.</p>
        </CardContent>
      </Card>
    </div>
  </div>
</div>

{/* 6. Build with us — dark closing CTA */}
<div className="w-full" style={{ background: '#0d1f13' }}>
  <div className="max-w-7xl mx-auto content-padding py-16 md:py-24 text-center">
    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Get Involved</p>
    <h2 className="text-3xl font-bold mb-4 text-white">Build with us</h2>
    <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>
      We are actively onboarding founding partners to help shape the infrastructure. If you work in impact, this platform is being built for you.
    </p>
    <div className="flex justify-center gap-4 flex-wrap">
      <Link href="/partner">
        <Button size="lg" className="bg-primary text-white hover:bg-primary/90">Partner With Us</Button>
      </Link>
      <Link href="/signup">
        <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 bg-transparent">
          Join as a Founding Member
        </Button>
      </Link>
    </div>
  </div>
</div>

</div>
</div>
  );
}