"use client";

import { useState } from "react";

const faqs = [
  {
    section: "General Platform",
    items: [
      {
        q: "What is Natives?",
        a: "Natives is coordination infrastructure for Africa's impact sector. It helps organisations find relevant partners, assess available information, formalise agreements, and track evidence of the work that follows.",
      },
      {
        q: "Who is Natives for?",
        a: "Natives is built for NGOs, social enterprises, funders, DFIs, corporates, consultants, creatives, founders, public institutions, and research organisations working across Africa's impact sector.",
      },
      {
        q: "Is Natives a directory?",
        a: "Natives includes a directory and marketplace for discovering organisations, initiatives, and partnership opportunities. Discovery is the starting point. Users can express interest, communicate, agree terms, formalise partnerships, and track milestones and evidence within the platform.",
      },
      {
        q: "How does Natives use AI?",
        a: "AI supports partner matching, initiative creation, brief generation, partner assessment, and outreach. Recommendations and generated content are based on information available on the platform and remain editable by users.",
      },
      {
        q: "Where does Natives operate?",
        a: "Natives is open to organisations and individuals globally, with a focus on partnerships and impact work across Africa.",
      },
      {
        q: "Is Natives free?",
        a: "Natives offers four plans: Free (directory access, initiative listings, messaging, and milestone tracking), Plus, Pro, and Compliance, which add AI-assisted matching, evaluation, and audit-ready compliance tools as you scale. See our Pricing page for full details.",
      },
      {
        q: "How is Natives different from LinkedIn or a directory?",
        a: "Natives is structured around the partnership itself: who is involved, what they are working on, what has been agreed, and what evidence follows. The platform keeps that information connected from discovery through to outcomes.",
      },
    ],
  },
  {
    section: "Getting Started",
    items: [
      {
        q: "What should I do first?",
        a: "Create your profile, add your organisation or individual information, and specify your areas of work, capabilities, needs, and partnership interests. You can then create initiatives, explore opportunities, or use matching to find relevant partners.",
      },
      {
        q: "What is verification?",
        a: "Verification confirms an organisation's identity and key organisational information through Natives' review process. Verified organisations receive a verification status on their profile.",
      },
      {
        q: "Do I need to be verified?",
        a: "You can create an account and participate on Natives without completing verification. Verification provides an additional trust signal and supports stronger partner assessment.",
      },
      {
        q: "How long does verification take?",
        a: "Verification is completed after the required information and supporting documentation have been submitted. Review times depend on the completeness of the information provided.",
      },
      {
        q: "Can I join as an individual?",
        a: "Yes. Individuals can create a profile, post initiatives, express interest in opportunities, and connect with organisations and funders. AI-assisted matching, MoUs, and milestone tracking require a contracting organisation — individuals who need those can convert their profile into a consultancy organisation.",
      },
    ],
  },
  {
    section: "Partnerships",
    items: [
      {
        q: "How do partnerships work on Natives?",
        a: "Partnerships move through a structured process: find relevant organisations or initiatives, express interest, communicate, agree terms, formalise the partnership, and track the work that follows.",
      },
      {
        q: "How do I find a partner?",
        a: "You can search the directory and marketplace or use AI-assisted matching. Matching considers factors such as mandate, geography, sector, focus, stage, budget, and available support.",
      },
      {
        q: "What is a Partnership Request?",
        a: "A Partnership Request lets you specify the kind of organisation, capability, funding, expertise, or support you are looking for. Natives uses this information to identify relevant potential partners.",
      },
      {
        q: "What happens after I find a potential partner?",
        a: "You can express interest and communicate with the organisation through Natives. If both parties want to proceed, you can agree the terms of the collaboration and formalise them through an MoU.",
      },
      {
        q: "Can Natives help with MoUs?",
        a: "Yes. Natives supports MoU origination, review, finalisation, receiving, and signing, depending on the users and plans involved.",
      },
      {
        q: "What happens after a partnership is agreed?",
        a: "The partnership can move into milestone tracking and evidence submission. Agreed outcomes and supporting evidence can be recorded and reviewed over time.",
      },
      {
        q: "Where can I see my partnerships?",
        a: "Partnership activity and confirmed collaborations are accessible through your Natives account and relevant portfolio or partnership views.",
      },
    ],
  },
  {
    section: "For Organisations",
    items: [
      {
        q: "How can an NGO or social enterprise get discovered?",
        a: "Complete your organisation profile, describe your work and capabilities, and create relevant initiatives. This gives potential partners information they can use when assessing your organisation and enables AI-assisted matching.",
      },
      {
        q: "How do I create an initiative?",
        a: "You can create an initiative manually or use AI-assisted creation. Add information about the work, intended outcomes, sector, geography, budget, and the type of partnership or support you need.",
      },
      {
        q: "How does AI matching work for organisations?",
        a: "Natives compares your organisation or initiative with available partner information and ranks potential matches based on relevant criteria such as mandate, geography, sector, stage, budget, and support requirements.",
      },
      {
        q: "Can I show my organisation's track record?",
        a: "Yes. Your profile and initiatives provide structured information about your organisation, programmes, capabilities, and work. Where relevant, this information can support partner assessment and AI-generated briefs.",
      },
      {
        q: "Can community-based or smaller organisations join?",
        a: "Yes. Organisations of different sizes and structures can participate. Verification and partner assessment are based on the information and documentation available for review.",
      },
      {
        q: "Can founders, consultants, creatives, and researchers join?",
        a: "Yes. Natives supports individuals and specialist organisations whose expertise, services, research, or capabilities are relevant to partnership opportunities.",
      },
      {
        q: "Is Natives free for organisations?",
        a: "Organisations can join on the Free plan. Paid plans provide additional AI-assisted matching, evaluation, outreach, and other capabilities.",
      },
    ],
  },
  {
    section: "For Funders & Corporates",
    items: [
      {
        q: "How can funders find potential partners?",
        a: "Funders can search the directory, explore initiatives, define funding criteria, and use AI-assisted matching to identify organisations and opportunities aligned with their mandate.",
      },
      {
        q: "How can corporates find CSR or ESG partners?",
        a: "Corporates can define their priorities, geography, sectors, budget, frameworks, and preferred partner types, then use the directory and AI-assisted matching to identify relevant organisations and initiatives.",
      },
      {
        q: "How can I assess a potential partner?",
        a: "Natives brings together available organisational information, Verification Status, Due Diligence Readiness, supporting documentation, and relevant initiative information to support assessment.",
      },
      {
        q: "What is an AI Deal Memo?",
        a: "An AI Deal Memo structures information about a potential partnership or funding opportunity, including mandate alignment, available organisational information, delivery considerations, financial information where available, and potential risks. Users can review and edit the resulting brief.",
      },
      {
        q: "What is Due Diligence Readiness?",
        a: "Due Diligence Readiness indicates how prepared an organisation is for due diligence based on the information and documentation available on Natives. It does not represent completed due diligence.",
      },
      {
        q: "Can I define a funding or CSR mandate?",
        a: "Yes. You can specify criteria such as funding range, geography, sectors, stage, SDGs, partner types, and other relevant priorities.",
      },
      {
        q: "Can I manage a partnership pipeline?",
        a: "Yes. You can keep track of initiatives, expressions of interest, conversations, and confirmed partnerships through your Natives account.",
      },
    ],
  },
  {
    section: "Trust, Verification & Data",
    items: [
      {
        q: "What are the three layers of trust on Natives?",
        a: "Natives separates three distinct areas: Verification Status confirms the organisation's identity and key organisational information. Due Diligence Readiness shows the organisation's readiness for due diligence, based on the information and documentation available on Natives. Impact Verification shows evidence supporting agreed outcomes, reviewed and tracked over time.",
      },
      {
        q: "What does the Verified badge mean?",
        a: "A Verified badge means the organisation has completed Natives' verification process and its identity and key organisational information have been reviewed.",
      },
      {
        q: "Does a Verified badge mean the organisation has passed due diligence?",
        a: "No. Verification and due diligence are separate. The Verified badge confirms the scope of Natives' verification process. Due Diligence Readiness indicates the information and documentation available for further assessment.",
      },
      {
        q: "Does Due Diligence Readiness mean due diligence is complete?",
        a: "No. It indicates the organisation's readiness for a due diligence process based on the information available on Natives.",
      },
      {
        q: "What is Impact Verification?",
        a: "Impact Verification records and reviews evidence supporting agreed milestones or outcomes during a partnership. It creates a traceable record of the work and evidence submitted over time.",
      },
      {
        q: "Who conducts verification?",
        a: "Verification is currently conducted through Natives' review process. Natives may work with trusted ecosystem partners as the verification system develops.",
      },
      {
        q: "What happens if an organisation's information changes?",
        a: "Organisations can update relevant information and documentation. Information may also be subject to further review when circumstances or partnership requirements change.",
      },
      {
        q: "Who can see my information?",
        a: "Some profile information is available to logged-in Natives users to support discovery and matching. Users control information submitted through private partnership activity, and access to specific partnership or assessment information depends on the relevant workflow and permissions.",
      },
      {
        q: "Are partnership details public?",
        a: "Partnership information can be managed according to the relevant visibility settings and workflow. Private discussions, expressions of interest, and sensitive assessment information are handled within the platform.",
      },
      {
        q: "How does Natives protect user data?",
        a: "Natives uses account controls, access permissions, and platform security measures to protect information submitted by users. Users should only provide information appropriate for the intended purpose and audience.",
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
            className="text-sm font-semibold uppercase tracking-widest mb-4"
            style={{ color: ORANGE }}
          >
            Support
          </p>
          <h1 className="text-5xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-foreground text-xl max-w-20xl">
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
                className="text-left px-4 py-2.5 rounded-lg text-base font-medium transition-colors duration-150"
                style={
                  activeSection === i
                    ? {
                        backgroundColor: `${GREEN}15`,
                        color: GREEN,
                        borderLeft: `3px solid ${GREEN}`,
                      }
                    : { color: "var(--color-foreground)" }
                }
              >
                {f.section}
              </button>
            ))}
          </nav>
        </aside>

        {/* Accordion */}
        <main className="flex-1 max-w-3xl">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            {faqs[activeSection].section}
          </h2>
          <div className="divide-y divide-border">
            {currentFAQs.map((item, i) => (
              <div key={i} className="py-4">
                <button
                  onClick={() => setOpenItem(openItem === i ? null : i)}
                  className="w-full flex justify-between items-start text-left gap-4"
                >
                  <span className="text-base font-medium text-foreground">
                    {item.q}
                  </span>
                  <span
                    className="text-lg leading-none shrink-0 mt-0.5 transition-transform duration-200"
                    style={{
                      color: openItem === i ? ORANGE : "var(--color-foreground)",
                      transform:
                        openItem === i ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    +
                  </span>
                </button>
                {openItem === i && (
                  <p className="mt-3 text-base text-foreground leading-relaxed pr-8">
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