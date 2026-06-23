"use client";

import { useState } from "react";

const faqs = [
  {
    section: "General Platform",
    items: [
      {
        q: "What is Natives?",
        a: "Natives is a coordination platform for Africa's social impact ecosystem. It connects NGOs, social enterprises, funders, corporates, and ecosystem experts — helping them find each other, verify credibility, form partnerships, and move resources more effectively.",
      },
      {
        q: "Who is Natives for?",
        a: "Natives serves NGOs, social enterprises, funders and DFIs, corporates with ESG or CSR mandates, social enterprise founders, individual creatives and consultants, and research institutions. Each actor type has a tailored profile and platform experience.",
      },
      {
        q: "Is Natives a directory or grant listing site?",
        a: "No. Discovery is one part of what the platform enables. The core function is helping the right actors find each other, verify credibility, and form partnerships that lead to real work. Natives uses AI to match initiatives to mandates, generate partnership briefs, and surface the most relevant opportunities for each user.",
      },
      {
        q: "How does AI work on the platform?",
        a: "AI is built into the core workflows — matching, brief generation, and partnership assessment. It surfaces the right opportunities faster and reduces the manual work on both sides of a partnership. Outputs are editable and designed to support decisions, not replace judgement.",
      },
      {
        q: "What geographies does Natives cover?",
        a: "Natives is open to organisations and individuals worldwide. The platform focuses on impact work delivered across Africa — funders, corporates, and partners based anywhere can participate.",
      },
      {
        q: "Is the platform free?",
        a: "Free accounts can browse, post, and save initiatives, and access the full directory. Paid plans unlock expressions of interest, messaging, AI briefs, Get Matched, and partnership confirmation. Join now to lock in founding member rates.",
      },
      {
        q: "How is Natives different from LinkedIn or a directory?",
        a: "LinkedIn and directories surface contacts. Natives is built for structured coordination. Profiles are verified, initiatives are posted with intent, and connections move toward confirmed partnerships with records on both sides. The platform also generates AI-powered outputs — deal memos, CSR briefs, partnership summaries — that accelerate decision-making on both sides.",
      },
      {
        q: "I need more information. How do I get in touch?",
        a: "Visit our Contact page and send us a message. We respond to all enquiries.",
      },
    ],
  },
  {
    section: "Getting Started",
    items: [
      {
        q: "What should I do first after creating an account?",
        a: "Complete your profile — organisation name, sector, country, description, and what you need or offer. Then get verified if you're an NGO or social enterprise. Once verified, post your first initiative on the marketplace or use Get Matched to find a partner. The more complete your profile, the better your AI matches.",
      },
      {
        q: "What is verification and do I need it?",
        a: "Verification is a review by the Natives team that confirms your organisation's legal registration, delivery capacity, and operational credibility. Verified organisations receive a trust badge on all activity — profiles, initiative listings, expressions of interest, and partnership cards. It is not required to join, but it significantly increases your chances of being taken seriously by funders and corporates.",
      },
      {
        q: "How long does verification take?",
        a: "Verification is typically completed within a few business days of submitting your documents.",
      },
      {
        q: "Can I join as an individual without an organisation?",
        a: "Yes. Individuals — consultants, researchers, creatives, advocates — can join with a personal profile. You can post initiatives, express interest in others' work, and be discovered by organisations looking for specific expertise.",
      },
    ],
  },
  {
    section: "For NGOs & Social Enterprises",
    items: [
      {
        q: "How does Natives help my organisation get found by funders and partners?",
        a: "A verified profile gives your organisation visibility to funders and corporates actively looking for implementation partners. You can also post initiatives on the marketplace, which are then surfaced to matched funders and corporates via AI. Verified organisations appear with a trust badge that signals credibility before the first conversation.",
      },
      {
        q: "How do I post an initiative?",
        a: "From your Portfolio, click Create Initiative. Describe your initiative in plain language and the AI will structure it into a full brief — problem statement, expected outcome, target population, sector, SDG alignment, budget, and partnership ask. You can also fill it in manually. Once submitted, it is published to the marketplace.",
      },
      {
        q: "How does Get Matched work?",
        a: "Get Matched is a self-serve AI matching feature. Give your partnership request a title, describe what you're looking for in plain language, and the AI structures your profile and runs a match against all listed partners. You can choose to list yourself publicly in the Partnerships directory and receive inbound expressions of interest from other organisations.",
      },
      {
        q: "What is the Partnerships feature?",
        a: "Partnerships is a separate directory where organisations can list themselves as actively seeking a partner for a specific purpose. Other organisations can browse listings and express interest. Once both sides confirm, the partnership is recorded in your Portfolio with the partner's name, role, and contact details. You can manage the full lifecycle — from listing to confirmed partnership — without leaving the platform.",
      },
      {
        q: "How do I show funders my track record?",
        a: "Your Impact Profile lets you record cumulative reach — total beneficiaries, jobs created, female beneficiary percentage, years of operation, and previous funders. You can also note the total value of grants received and your on-time delivery rate. This data is automatically pulled into deal memos and CSR briefs that funders and corporates generate when reviewing your initiatives.",
      },
      {
        q: "Can small or community-based NGOs join?",
        a: "Yes. Verification is based on evidence of real delivery, not organisational size or budget.",
      },
      {
        q: "Is Natives free for NGOs?",
        a: "NGOs and social enterprises join for free, with no hidden costs. Access to certain features will require an upgrade.",
      },
    ],
  },
  {
    section: "For Corporates",
    items: [
      {
        q: "What does my dashboard show as a corporate?",
        a: "Your home dashboard shows an AI-matched feed of ESG and CSR-aligned initiatives, filtered to your sector focus and geographic priorities. You also see a pipeline view of initiatives you've expressed interest in, active conversations, and confirmed ESG adoptions. The dashboard is oriented around discovery and decision-making, not content creation.",
      },
      {
        q: "How do we find the right CSR or ESG implementation partners?",
        a: "Natives maintains a verified directory of NGOs and social enterprises across Africa. You can search by sector, geography, and focus area, or rely on the AI-matched feed on your home dashboard that surfaces initiatives aligned to your ESG mandate. Every verified organisation has gone through a structured review, reducing the time and cost of initial due diligence.",
      },
      {
        q: "How do we quickly evaluate whether an initiative fits our CSR mandate?",
        a: "From any initiative page, corporates can generate a CSR Adoption Brief — an AI assessment that evaluates the initiative against your ESG frameworks, priorities, and geographic focus. It ends with a recommended action: Adopt, Explore, or Pass.",
      },
      {
        q: "What ESG frameworks does the platform support?",
        a: "You can specify your ESG frameworks in your mandate settings — GRI, UN Global Compact, TCFD, or others. The AI matching and CSR brief generation use these to evaluate initiative fit.",
      },
      {
        q: "How do we set up our CSR mandate?",
        a: "In your profile settings, complete the Mandate Criteria section. Add your preferred ESG frameworks, annual CSR budget range, geographic focus, sector priorities, SDG alignments, and preferred partner types. This data is used for AI matching on your home dashboard and for CSR brief generation.",
      },
      {
        q: "How do we start on Natives?",
        a: "Create an account, select Corporate as your organisation type, complete your profile including your CSR mandate, and get verified. Once verified, your home dashboard activates with AI-matched initiatives. You can then generate CSR briefs, express interest in initiatives, and open conversations with implementers.",
      },
    ],
  },
  {
    section: "For Funders & DFIs",
    items: [
      {
        q: "What does my dashboard show as a funder?",
        a: "Your home dashboard shows an AI-matched feed of initiatives from across the marketplace, ranked by relevance to your mandate. The better you complete your mandate settings, the more accurate your matches.",
      },
      {
        q: "How does Natives help us find credible organisations to fund?",
        a: "Every verified organisation on Natives has been reviewed for legal registration, delivery capacity, and operational credibility. You can see each organisation's DD readiness score assessed over critical self-reported indicator criteria. This reduces the time and cost of initial due diligence.",
      },
      {
        q: "How do we quickly assess an initiative?",
        a: "From any initiative detail page, funders can generate an AI Deal Memo, evaluating the initiative against your mandate. The memo covers problem validity, solution fit, team credibility, financial assessment, mandate alignment, risk flags, and a recommended action.",
      },
      {
        q: "How do we know if an organisation is investment-ready?",
        a: "Each verified organisation's profile shows a DD Readiness Score, a percentage based on five self-reported indicators including impact measurement framework in place. Organisations with higher scores have signalled readiness to proceed to due diligence.",
      },
      {
        q: "Can we set a funding mandate?",
        a: "Yes. In your profile settings, you can define your grant range, funding instruments, geographic focus, stage preference, sector priorities, and SDG alignments. This mandate is used to power your AI-matched initiative feed and deal memo generation. Mandate criteria are private and not shown publicly.",
      },
      {
        q: "Can we track our pipeline?",
        a: "Yes. Expressions of interest, saved initiatives, active conversations, and confirmed partnerships are all tracked on the platform. You can pass on initiatives with a reason logged, save for later review, or move to active conversation — all from the initiative detail view.",
      },
    ],
  },
  {
    section: "Partnerships",
    items: [
      {
        q: "What is the Partnerships feature?",
        a: "Partnerships is a dedicated space for organisations actively seeking a specific type of partner. Rather than browsing the full marketplace, you list your partnership request — what you need, what you offer, your sector and SDG focus — and other organisations express interest. Both sides manage the full lifecycle on the platform, from first expression to confirmed partnership.",
      },
      {
        q: "How do I list my organisation as seeking a partner?",
        a: "Use the Get Matched feature. Give your request a title, describe what you're looking for in plain language, and the AI structures your listing. You can choose to list publicly in the Partnerships directory. Once listed, other organisations can express interest in you directly.",
      },
      {
        q: "How does a partnership get confirmed?",
        a: "Accept an inbound expression of interest and a conversation opens in Messages. From there, both sides agree on a partnership type and confirm. Once confirmed, the partnership is recorded in your Portfolio.",
      },
      {
        q: "What happens after I've formed a partnership?",
        a: "Your partnership is confirmed and recorded on the platform — both sides have a clear record of what was agreed and who is delivering. Your listing stays visible so others can see you've successfully formed partnerships. When you're ready to find a new partner, start a fresh request.",
      },
      {
        q: "Where do I see all my partnerships?",
        a: "In your Portfolio under Partnerships. Active listings, inbound expressions, and confirmed partnerships are all tracked in one place.",
      },
    ],
  },
  {
    section: "For Founders",
    items: [
      {
        q: "I am building a social enterprise. Is Natives relevant to me?",
        a: "Yes. You don't need a large organisation behind you to participate. Build a profile, post initiatives, use Get Matched to find partners, and receive inbound expressions of interest from verified NGOs, corporates, and funders.",
      },
      {
        q: "I do not have a registered organisation yet. Can I still join?",
        a: "Yes. Founders can join with an individual profile and participate in the ecosystem. You can build a profile, post initiatives, and connect with other actors on the platform. Verification as an organisation becomes available once you have your legal registration in place.",
      },
      {
        q: "Can I find a co-founder or technical partner on Natives?",
        a: "Yes. Individual profiles are searchable by sector, expertise, and focus area, making you discoverable to other founders, NGOs, and organisations looking for specific capabilities.",
      },
    ],
  },
  {
    section: "For Individuals & Creatives",
    items: [
      {
        q: "Do I need an organisation to join Natives?",
        a: "No. Individuals can join with a personal profile.",
      },
      {
        q: "What can I do on the platform as an individual?",
        a: "As a consultant, researcher, creative, or advocate, you can build a profile, post initiatives on the marketplace, express interest in initiatives posted by other organisations, and connect with organisations and funders looking for what you bring. Organisations can also find and reach out to you based on your profile.",
      },
      {
        q: "How do I get discovered by organisations and funders?",
        a: "Complete your profile with your sector focus, areas of expertise, and country. The more specific your profile, the easier it is for the right organisations to find you.",
      },
    ],
  },
  {
    section: "For Research Institutions",
    items: [
      {
        q: "How does Natives help research institutions?",
        a: "Natives connects research institutions to NGOs, corporates, and funders who can translate evidence into programme design, policy advocacy, and delivery. You can post research initiatives and find implementation partners directly.",
      },
      {
        q: "How does partner matching work for research institutions?",
        a: "Verified research institutions can use the Get Matched feature to describe their partnership needs and have the AI match them against relevant organisations in the directory. You can also list publicly in the Partnerships directory and receive inbound expressions of interest.",
      },
    ],
  },
  {
    section: "Trust & Verification",
    items: [
      {
        q: "How does verification work?",
        a: "Verification is conducted by the Natives platform team. Organisations are assessed based on legal registration, delivery capacity, and operational credibility relevant to their type. The process typically takes a few business days from document submission.",
      },
      {
        q: "What does the verified badge mean?",
        a: "A verified badge means the Natives team has reviewed your organisation's legal registration, programme delivery capacity, and operational credibility. It appears on your directory profile, initiative listings, expressions of interest, and partnership cards — signalling institutional credibility to potential partners before the first conversation.",
      },
      {
        q: "Who can verify an organisation?",
        a: "Verification is currently handled by the Natives team. The long-term model will introduce trusted ecosystem partners and anchor institutions as verification partners.",
      },
      {
        q: "What if our circumstances change after verification?",
        a: "Organisations can update their profiles and submit new supporting documentation at any time. Verification status may be reviewed periodically as the platform matures.",
      },
    ],
  },
  {
    section: "Data & Privacy",
    items: [
      {
        q: "Who can see my profile?",
        a: "Your public profile — organisation name, description, sector, country, needs, offers, and SDG alignment — is visible to all logged-in users on the platform. Your investment thesis and mandate criteria (for funders and corporates) are private and used only for AI matching.",
      },
      {
        q: "Is my mandate or CSR criteria visible publicly?",
        a: "No. Mandate criteria — grant range, stage preference, sector focus, ESG frameworks, and geographic priorities — are private. They are used for AI matching and brief generation but are never shown on your public profile.",
      },
      {
        q: "Who sees my expressions of interest?",
        a: "Expressions of interest are visible to the initiative owner only. They are not shown to other users on the platform.",
      },
      {
        q: "Can I control whether my partnership listing is public?",
        a: "Yes. When using Get Matched, you can choose to list publicly in the Partnerships directory or run AI matching privately without appearing in the directory.",
      },
    ],
  },
];

const ORANGE = "#C45C26";
const GREEN = "#2D6A4F";

export default function FAQPage() {
  const [activeSection, setActiveSection] = useState(0);
  const [openItem, setOpenItem] = useState<number | null>(null);

  const currentFAQs = faqs[activeSection].items;

  return (
    <div className="w-full max-w-screen-2xl mx-auto content-padding hp-hero py-12 md:py-18">
      {/* Header */}
      <div className="border-b border-border py-16">
        <div className="w-full">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: ORANGE }}
          >
            Support
          </p>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-muted-foreground text-lg max-w-20xl">
            Everything you need to know about Natives — the coordination
            infrastructure for Africa's impact economy.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="w-full py-16 flex flex-col md:flex-row gap-12">        {/* Sidebar tabs */}
        <aside className="md:w-56 shrink-0">
          <nav className="flex flex-col gap-1">
            {faqs.map((f, i) => (
              <button
                key={f.section}
                onClick={() => {
                  setActiveSection(i);
                  setOpenItem(null);
                }}
                className="text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
                style={
                  activeSection === i
                    ? {
                        backgroundColor: `${GREEN}15`,
                        color: GREEN,
                        borderLeft: `3px solid ${GREEN}`,
                      }
                    : { color: "var(--color-muted-foreground)" }
                }
              >
                {f.section}
              </button>
            ))}
          </nav>
        </aside>

        {/* Accordion */}
        <main className="flex-1 max-w-3xl">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            {faqs[activeSection].section}
          </h2>
          <div className="divide-y divide-border">
            {currentFAQs.map((item, i) => (
              <div key={i} className="py-4">
                <button
                  onClick={() => setOpenItem(openItem === i ? null : i)}
                  className="w-full flex justify-between items-start text-left gap-4"
                >
                  <span className="text-sm font-medium text-foreground">
                    {item.q}
                  </span>
                  <span
                    className="text-lg leading-none shrink-0 mt-0.5 transition-transform duration-200"
                    style={{
                      color: openItem === i ? ORANGE : "var(--color-muted-foreground)",
                      transform:
                        openItem === i ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    +
                  </span>
                </button>
                {openItem === i && (
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed pr-8">
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}