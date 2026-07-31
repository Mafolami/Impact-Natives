import { Link, useParams } from "wouter";
import { ArrowRight, ShieldCheck, Users, Handshake, FlaskConical, Lightbulb, Globe, Network, Search } from "lucide-react";

const TABS = [
  { id: "ngos", label: "NGOs & Non-Profits" },
  { id: "corporates", label: "Corporations" },
  { id: "donors", label: "Funders & Donors" },
  { id: "startups", label: "Startups & Social Enterprises" },
  { id: "individuals", label: "Individuals & Creatives" },
  { id: "research", label: "Research Institutions" },
];

type AudienceKey = "ngos" | "corporates" | "donors" | "startups" | "individuals" | "research";

const AUDIENCE: Record<AudienceKey, {
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  ctaHref: string;
  secondaryCta?: string;
  secondaryCtaHref?: string;
  accent: string;
  problem: string;
  features: { icon: React.ComponentType<any>; title: string; body: string; }[];
  paths: { label: string; href: string; desc: string; }[];
}> = {
  ngos: {
    eyebrow: "For NGOs & Non-Profits",
    headline: "Get found by the funders and partners already looking for you.",
    sub: "Your delivery capacity exists. Your credibility exists. The gap is visibility and structured access to the right relationships.",
    cta: "Create your profile",
    ctaHref: "/signup",
    accent: "#2db87a",
    problem: "Most NGOs doing serious work in Africa are invisible to the funders and corporates actively looking for implementation partners. Discovery is still broken — it runs on networks, warm intros, and conference corridors. Natives gives you a structured presence in a verified ecosystem so the right organisations can find you.",
    features: [
      {
        icon: ShieldCheck,
        title: "Build a verified institutional profile",
        body: "Create a structured profile covering your sector focus, geographic reach, and programme history. Apply for verification — once approved, your organisation carries a verification badge that signals credibility to every funder, corporate, and partner browsing the platform.",
      },
      {
        icon: Search,
        title: "Get discovered through the marketplace",
        body: "Post initiatives to the Impact Marketplace and let funders, corporates, and implementers find you. Your work is searchable by sector, country, and partnership type — so the right organisations can find and express interest in what you're building.",
      },
      {
        icon: Handshake,
        title: "Receive and manage expressions of interest",
        body: "When an organisation expresses interest in your initiative, you get notified and can review, accept, or decline. Confirmed partnerships are tracked on the platform — giving you a clear record of who you're working with and why.",
      },
      {
        icon: FlaskConical,
        title: "Commission an Innovation Lab",
        body: "If your challenge is complex and requires multiple stakeholders to align, submit a Lab proposal. Natives structures the coordination process, identifies the right actors, and manages delivery — so you can focus on the problem, not the process.",
      },
    ],
    paths: [
      { label: "Create your profile", href: "/signup", desc: "Set up your organisation profile and apply for verification." },
      { label: "Post an initiative", href: "/signup", desc: "List a challenge or programme on the Impact Marketplace." },
      { label: "Find partners", href: "/platform/partnership-os", desc: "Browse verified funders, corporates, and implementers." },
    ],
  },
  corporates: {
    eyebrow: "For Corporations",
    headline: "Turn ESG and CSR commitments into verified delivery.",
    sub: "Your sustainability mandates are real. Finding credible, verified implementation partners to deliver on them shouldn't take months.",
     cta: "Request Demo",
    ctaHref: "/contact?reason=demo",
    secondaryCta: "Create your profile",
    secondaryCtaHref: "/signup",
    accent: "#7b6dd4",
    problem: "Corporate sustainability and social investment teams are expected to demonstrate measurable, on-the-ground impact — but finding the right NGOs, social enterprises, and implementers to work with is still manual and fragmented. Due diligence is expensive. Discovery is relationship-dependent. Natives fixes both.",
    features: [
      {
        icon: ShieldCheck,
        title: "Access a directory of verified implementers",
        body: "Browse verified organisations filtered by sector, country, and SDG alignment. Every verified organisation on Natives has passed a structured review — so you're not starting from zero on due diligence before the first conversation.",
      },
      {
        icon: Lightbulb,
        title: "Adopt initiatives as CSR anchors",
        body: "Browse the Impact Marketplace and express interest in initiatives that align with your ESG priorities. For any initiative, generate an AI-powered CSR adoption brief in seconds - covering SDG alignment, local content fit, brand considerations, ESG framework match, implementer readiness, risk flags, and a recommended action. Third-party verified impact, without building a programme from scratch.",
      },
      {
        icon: Handshake,
        title: "Form structured partnerships",
        body: "Send expressions of interest directly to organisations and initiatives that fit your mandate. Confirmed partnerships are tracked on the platform — with clear records of what was agreed, who is delivering, and what the expected outcome is.",
      },
      {
        icon: FlaskConical,
        title: "Commission a Lab for complex challenges",
        body: "For challenges that require multi-stakeholder coordination — CSR programmes that need NGO, government, and community alignment — commission an Innovation Lab. Natives designs the coordination architecture and manages delivery.",
      },
    ],
    paths: [
      { label: "Browse verified partners", href: "/platform/partnership-os", desc: "Search the directory by sector, country, and SDG." },
      { label: "Explore initiatives", href: "/platform/impact-marketplace", desc: "Find programmes to adopt or co-fund on the marketplace." },
      { label: "Commission a Lab", href: "/labs/commission", desc: "Structure a multi-stakeholder programme with Natives." },
    ],
  },
  donors: {
    eyebrow: "For Funders & Donors",
    headline: "Find credible pipeline. Deploy capital with confidence.",
    sub: "Verified organisations, active initiatives, and a structured way to move from discovery to confirmed partnership — without months of manual due diligence.",
    cta: "Request Demo",
    ctaHref: "/contact?reason=demo",
    secondaryCta: "Join as a funder",
    secondaryCtaHref: "/signup",
    accent: "#2d9dd4",
    problem: "Philanthropies, impact investors, and bilateral funders face the same problem: capital is available, but identifying credible, verified organisations to deploy it through takes disproportionate time and effort. Natives gives you structured access to a verified ecosystem — so you spend less time on discovery and more time on decisions.",
    features: [
      {
        icon: Search,
        title: "Browse a verified organisation directory with DD readiness signals",
        body: "Every organisation on Natives carries a structured profile — sector focus, geography, programme history, and verification status. Verified organisations also include a due diligence readiness profile: track record data, previous funders, grant delivery history, and third-party evaluation links. Filter by what your mandate requires and know what documentation exists before the first conversation.",
      },
      {
        icon: Globe,
        title: "Discover active initiatives and generate deal memos instantly",
        body: "The Impact Marketplace surfaces initiatives actively seeking funding partners. Browse by sector, location, and partnership type. When you find a match, generate a structured AI deal memo in seconds — covering the problem, organisation credibility, financial context, and recommended next steps — ready to share with your team before the first conversation.",
      },
      {
        icon: Handshake,
        title: "Track confirmed partnerships",
        body: "When you confirm a partnership, it's tracked on the platform. You have a clear record of who you're working with, what the initiative is, and what was agreed — without relying on offline documentation.",
      },
      {
        icon: FlaskConical,
        title: "Fund a Lab for systemic challenges",
        body: "When a challenge requires coordinating multiple organisations across a system — not just one implementer — fund an Innovation Lab. Natives structures the process, brings in the right actors, and manages delivery against a defined outcome.",
      },
    ],
    paths: [
      { label: "Browse the directory", href: "/platform/partnership-os", desc: "Find verified organisations by sector and country." },
      { label: "Explore the marketplace", href: "/platform/impact-marketplace", desc: "Discover initiatives actively seeking funding." },
      { label: "Commission a Lab", href: "/labs/commission", desc: "Fund a structured multi-stakeholder coordination process." },
    ],
  },
  startups: {
    eyebrow: "For Startups & Social Enterprises",
    headline: "From validated model to institutional partner.",
    sub: "You have a thesis and early evidence. What you need is the connective tissue — credible partners, co-development opportunities, and a pathway to capital.",
    cta: "Create your profile",
    ctaHref: "/signup",
    accent: "#d4a82d",
    problem: "Early-stage impact ventures in Africa rarely lack ambition or insight — they lack the institutional relationships needed to validate and scale. Funders want proof-of-concept evidence. NGOs want co-development partners with complementary capacity. Corporates want delivery partners with a track record. Natives gives you structured access to all three before you've built the relationships manually.",
    features: [
      {
        icon: ShieldCheck,
        title: "Build a credible organisation profile",
        body: "Create a structured profile for your venture — sector focus, model, geography, and what you're seeking. Get verified once you meet the threshold. A verified badge signals institutional credibility to the NGOs, corporates, and funders you need to work with.",
      },
      {
        icon: Handshake,
        title: "Find NGO proof-of-concept partners",
        body: "Browse verified NGOs with the field presence and community relationships your model needs to validate at scale. Send expressions of interest directly and propose co-development arrangements that give both sides what they need.",
      },
      {
        icon: Lightbulb,
        title: "Post your initiative to attract capital",
        body: "List your venture or programme on the Impact Marketplace with a clear problem statement and outcome target. Funders and corporates browsing for credible pipeline can find you, review your profile, and express interest — without you needing the right room to walk into.",
      },
      {
        icon: FlaskConical,
        title: "Commission a Lab for complex coordination",
        body: "When your model requires multiple stakeholders to align — government, NGO, corporate, and community — commission an Innovation Lab. Natives structures the coordination and manages delivery so you can focus on building.",
      },
    ],
    paths: [
      { label: "Create your profile", href: "/signup", desc: "Set up your venture profile and apply for verification." },
      { label: "Find co-development partners", href: "/platform/partnership-os", desc: "Browse NGOs and implementers open to collaboration." },
      { label: "Post an initiative", href: "/signup", desc: "List your programme to attract funders and partners." },
    ],
  },
  individuals: {
    eyebrow: "For Individuals & Creatives",
    headline: "Your expertise belongs in the ecosystem.",
    sub: "Consultants, researchers, advocates, and creatives — you don't need an organisation to participate. Natives gives you the same access as any institution.",
    cta: "Join as an individual",
    ctaHref: "/signup",
    accent: "#c45c26",
    problem: "Individual practitioners working in Africa's impact space — consultants, researchers, creatives, policy advocates — are often invisible to the organisations and initiatives that could use their expertise. Access still runs through institutional affiliations and conference networks. Natives removes that barrier.",
    features: [
      {
        icon: Users,
        title: "Build an individual practitioner profile",
        body: "Create a profile as an individual — covering your sector expertise, skills, geography, and what you're looking to contribute to or build. You're discoverable in the same verified ecosystem as registered organisations.",
      },
      {
        icon: Lightbulb,
        title: "Post and manage your own initiatives",
        body: "Have an idea worth building? Post it on the Impact Marketplace. Define the challenge, the outcome you're targeting, and the kind of support you need — then let the right partners find you.",
      },
      {
        icon: Network,
        title: "Connect with organisations directly",
        body: "Browse verified organisations in the Natives ecosystem. Filter by sector, country, and what they're working on. Send expressions of interest directly — no warm intro, no intermediary.",
      },
      {
        icon: FlaskConical,
        title: "Submit a Lab proposal",
        body: "Identified a systemic challenge that needs more than one organisation to solve? Submit a Lab proposal. Natives handles the convening and coordination — you define the problem and the outcome.",
      },
    ],
    paths: [
      { label: "Create your profile", href: "/signup", desc: "Join the ecosystem as an individual practitioner." },
      { label: "Post an initiative", href: "/signup", desc: "List a challenge or idea on the Impact Marketplace." },
      { label: "Browse the ecosystem", href: "/platform/partnership-os", desc: "Find organisations and initiatives to contribute to." },
    ],
  },
  research: {
    eyebrow: "For Research Institutions",
    headline: "Bridge your evidence to practice, policy, and action.",
    sub: "Findings without implementation pathways don't move systems. Natives connects research institutions to the organisations that can translate evidence into delivery.",
    cta: "Create your profile",
    ctaHref: "/signup",
    accent: "#4d8dd4",
    problem: "Research institutions and universities in Africa produce rigorous evidence on what works — but the gap between a published finding and a funded programme is still enormous. Implementation organisations don't know the research exists. Funders don't see it as pipeline. Natives connects your work to the ecosystem that can act on it.",
    features: [
      {
        icon: ShieldCheck,
        title: "Build a verified institutional profile",
        body: "Create a structured profile for your institution — research focus areas, geographic scope, and the sectors you work in. Apply for verification to signal institutional credibility to the NGOs, funders, and government bodies that could partner with you.",
      },
      {
        icon: Globe,
        title: "Surface your research as ecosystem pipeline",
        body: "Post your findings and programmes on the Impact Marketplace. Frame your work as an initiative — defining the problem, the evidence base, and the kind of implementation partners you need. Let the organisations ready to act find you.",
      },
      {
        icon: Handshake,
        title: "Partner with implementers directly",
        body: "Browse NGOs, social enterprises, and government bodies with the delivery capacity to translate your evidence into programmes. Send expressions of interest and propose research-to-practice partnerships that give both sides what they need.",
      },
      {
        icon: FlaskConical,
        title: "Commission a Lab to activate findings",
        body: "When your evidence points to a challenge that requires coordinated action across multiple organisations, commission a Lab. Natives convenes the right stakeholders, structures the process, and manages delivery against your defined outcome.",
      },
    ],
    paths: [
      { label: "Create your profile", href: "/signup", desc: "Set up your institution's profile and apply for verification." },
      { label: "Post a research initiative", href: "/signup", desc: "Frame your findings as actionable ecosystem pipeline." },
      { label: "Find implementation partners", href: "/platform/partnership-os", desc: "Connect with NGOs and bodies that can act on your evidence." },
    ],
  },
};

export default function SolutionsPage() {
  const params = useParams();
  const tab = (params.tab as AudienceKey) || "ngos";
  const audience = AUDIENCE[tab] ?? AUDIENCE["ngos"];

  return (
    <div className="w-full">

      {/* ── HERO ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0a0e14 0%, #0d1f0f 25%, #1a0e0a 50%, #0e1a2e 75%, #0a1410 100%)',
        padding: 'clamp(4rem, 8vw, 7rem) 0 clamp(3rem, 5vw, 5rem)',
        paddingTop: 'calc(64px + clamp(4rem, 8vw, 7rem))',
        marginTop: '-64px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        width: '100vw',
        marginLeft: 'calc(-50vw + 50%)',
      }}>
        <div className="w-full max-w-screen-2xl mx-auto content-padding hp-hero">          
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            marginBottom: '1.5rem', padding: '0.375rem 1rem', borderRadius: '9999px',
            background: `${audience.accent}18`, border: `1px solid ${audience.accent}35`,
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: audience.accent, display: 'block' }} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: audience.accent }}>
              {audience.eyebrow}
            </span>
          </div>
          <h1 style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1,
            color: '#f7f3ed', maxWidth: '720px', marginBottom: '1.25rem',
          }}>
            {audience.headline}
          </h1>
          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.125rem)', color: 'rgba(247,243,237,0.6)',
            lineHeight: 1.7, maxWidth: '560px', marginBottom: '2.5rem',
          }}>
            {audience.sub}
          </p>

          {/* Tab bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {TABS.map(({ id, label }) => {
              const isActive = tab === id;
              return (
                <Link key={id} href={`/solutions/${id}`}>
                  <button style={{
                    padding: '0.5rem 1.25rem', borderRadius: '9999px', fontSize: '0.875rem',
                    fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease',
                    background: isActive ? '#f7f3ed' : 'rgba(255,255,255,0.07)',
                    color: isActive ? '#0a0a0a' : 'rgba(247,243,237,0.6)',
                    border: isActive ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  }}>
                    {label}
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PROBLEM STATEMENT ── */}
      <section style={{
        padding: 'clamp(3rem, 5vw, 5rem) 0',
        borderBottom: '1px solid hsl(var(--border))',
        background: 'hsl(var(--background))',
      }}>
        <div className="w-full max-w-screen-2xl mx-auto content-padding hp-hero">          
          <div style={{ maxWidth: '680px' }}>
            <p style={{
              fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: audience.accent, marginBottom: '1rem',
            }}>
              The problem
            </p>
<p style={{
              fontSize: 'clamp(1rem, 2vw, 1.125rem)', color: 'hsl(var(--muted-foreground))',
              lineHeight: 1.8,
            }}>
              {audience.problem}
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: 'clamp(3rem, 5vw, 5rem) 0', borderBottom: '1px solid hsl(var(--border))' }}>
        <div className="w-full max-w-screen-2xl mx-auto content-padding hp-hero">          
          <p style={{
            fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: audience.accent, marginBottom: '2.5rem',
          }}>
            How Natives helps
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1px',
            background: 'hsl(var(--border))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '1.25rem',
            overflow: 'hidden',
          }}>
            {audience.features.map((feat, i) => {
              const FeatIcon = feat.icon;
              return (
                <div key={i} style={{
                  background: 'hsl(var(--card))',
                  padding: '2rem',
                  transition: 'background 0.2s ease',
                }}>
                  <div style={{
                    width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem',
                    background: `${audience.accent}15`, border: `1px solid ${audience.accent}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '1.25rem',
                  }}>
                    <FeatIcon style={{ width: '1rem', height: '1rem', color: audience.accent }} />
                  </div>
                  <h3 style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em',
                    color: 'hsl(var(--foreground))', marginBottom: '0.75rem',
                  }}>
                    {feat.title}
                  </h3>
                  <p style={{ fontSize: '0.9375rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.7 }}>
                    {feat.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PATHS ── */}
      <section style={{ padding: 'clamp(3rem, 5vw, 5rem) 0', background: 'hsl(var(--background))' }}>
        <div className="w-full max-w-screen-2xl mx-auto content-padding hp-hero">          <p style={{
            fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: audience.accent, marginBottom: '1rem',
          }}>
            Where to start
          </p>
                    <h2 style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700,
            letterSpacing: '-0.025em', color: 'hsl(var(--foreground))', marginBottom: '2rem',
          }}>
            Pick the path that fits your intent.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '560px', marginBottom: '3rem' }}>
            {audience.paths.map((path, i) => (
              <Link key={i} href={path.href}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '1rem', padding: '1.25rem 1.5rem',
                    borderRadius: '0.875rem',
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    cursor: 'pointer', transition: 'border-color 0.2s ease, background 0.2s ease',
                  }}
                                    onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${audience.accent}50`;
                    (e.currentTarget as HTMLElement).style.background = `${audience.accent}08`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))';
                    (e.currentTarget as HTMLElement).style.background = 'hsl(var(--card))';
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'hsl(var(--foreground))', marginBottom: '0.25rem' }}>
                      {path.label}
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                      {path.desc}
                    </p>
                  </div>
                  <ArrowRight style={{ width: '1rem', height: '1rem', color: audience.accent, flexShrink: 0 }} />
                </div>
              </Link>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.875rem' }}>
            <Link href={audience.ctaHref}>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                height: '2.75rem', padding: '0 1.5rem', borderRadius: '9999px',
                background: audience.accent, color: '#fff',
                fontSize: '0.9375rem', fontWeight: 600, border: 'none', cursor: 'pointer',
              }}>
                {audience.cta}
                <ArrowRight style={{ width: '0.875rem', height: '0.875rem' }} />
              </button>
            </Link>
            <Link href={audience.secondaryCtaHref ?? "/contact"}>
  <button style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                height: '2.75rem', padding: '0 1.5rem', borderRadius: '9999px',
                background: 'transparent', color: 'hsl(var(--foreground))',
                fontSize: '0.9375rem', fontWeight: 500,
                border: '1px solid hsl(var(--border))', cursor: 'pointer',
              }}>
                {audience.secondaryCta ?? "Talk to us"}
              </button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}