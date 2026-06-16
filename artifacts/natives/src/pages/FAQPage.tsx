"use client";

import { useState } from "react";

const faqs = [
  {
    section: "General Platform",
    items: [
      {
        q: "What is Natives?",
        a: "Natives is a coordination platform for Africa's social impact ecosystem. It helps NGOs, corporates, funders, founders, and ecosystem experts find each other, form partnerships, and move resources more effectively.",
      },
      {
        q: "Who is Natives for?",
        a: "Natives serves NGOs, corporates, donors and DFIs, social enterprise founders, individual creatives and consultants, and research institutions. Each actor type has a tailored profile and set of platform capabilities.",
      },
      {
        q: "Is Natives a directory or grant listing site?",
        a: "No. Natives is built for active coordination. Discovery is one part of what the platform enables. The core function is helping the right actors find each other, verify credibility, and form partnerships that lead to real work.",
      },
      {
        q: "What geographies does Natives cover?",
        a: "Natives is Africa-wide. Funders, corporates, and organizations from anywhere can participate.",
      },
      {
        q: "Is the platform free?",
        a: "Yes, for now. All current users join as founding members at no cost. When paid tiers launch, founding members will lock in subsidised rates. ",
      },
      {
        q: "How is Natives different from LinkedIn or a directory?",
        a: "LinkedIn and directories surface contacts. Natives is built for structured coordination. Profiles are verified, initiatives are posted with intent, and connections move toward confirmed partnerships with records on both sides.",
      },
      {
        q: "I need more information. How do I get in touch?",
        a: "Visit our Contact page and send us a message. We respond to all enquiries.",
      },
    ],
  },
  {
    section: "For NGOs",
    items: [
      {
        q: "How does Natives help my NGO get found by funders and partners?",
        a: "A verified profile gives your organisation visibility to donors, DFIs, and corporates actively looking for implementation partners. You can also post initiatives on the marketplace and receive expressions of interest directly.",
      },
      {
        q: "What does verification mean for an NGO?",
        a: "Verification covers legal registration, programme delivery capacity, and financial credibility. Verified organisations receive a trust badge that signals institutional credibility to potential partners before the first conversation.",
      },
      {
        q: "Can small or community-based NGOs join?",
        a: "Yes. Verification is based on evidence of real delivery, not organisational size or budget.",
      },
      {
        q: "How does partner matching work?",
        a: "Partnership matching on Natives is facilitated by the Natives team. You submit a matching request through the Get Matched feature, and Natives identifies suitable partners based on your profile, sector, and stated needs. This reduces misfit matches and unnecessary waiting. You can increase your chances of connecting with a specific organisation by expressing interest in one of their initiatives, or by posting your own initiative and receiving expressions of interest from others.",
      },
    ],
  },
  {
    section: "For Corporates",
    items: [
      {
        q: "How do we find implementation partners for ESG and CSR initiatives?",
        a: "Natives maintains a verified directory of NGOs, social enterprises, and experts across Africa. You can search by sector, geography, and focus area to find partners suited to your programme needs.",
      },
      {
        q: "Can we commission a Lab around our ESG priorities?",
        a: "Yes. A commissioned Lab is a structured process where Natives convenes the right stakeholders around a specific challenge you define. You set the problem. Natives structures the process and manages delivery.",
      },
      {
        q: "How do we start on Natives?",
        a: "Create an account, complete your organisation profile, and submit a verification request. Once verified, you can search for partners, post initiatives, and commission a Lab.",
      },
    ],
  },
  {
    section: "For Funders & DFIs",
    items: [
      {
        q: "How does Natives help us find credible organisations to fund?",
        a: "Natives gives funders access to a verified ecosystem of NGOs, social enterprises, and implementers across Africa. Every verified organisation has gone through a structured review, reducing the time and cost of initial due diligence.",
      },
      {
        q: "Can we post funding opportunities on the platform?",
        a: "Yes. Verified funders can post funding opportunities on the marketplace. Verified organisations can then find them, review the criteria, and submit an expression of interest directly.",
      },
      {
        q: "What reporting does Natives support?",
        a: "Partnership activity, expressions of interest, and confirmed collaborations are tracked on the platform. Reporting features will expand as the platform grows.",
      },
    ],
  },
  {
    section: "For Founders",
    items: [
      {
        q: "I am building a social enterprise. Is Natives relevant to me?",
        a: "Yes. Natives connects founders to verified NGOs, corporates, funders, and ecosystem experts. You can build a profile, post initiatives, and find partners without needing a large organisation behind you.",
      },
      {
        q: "I do not have a registered organisation yet. Can I still join?",
        a: "Yes. Founders can join with an individual profile and participate in the ecosystem. You can build a profile, post initiatives, and connect with other actors on the platform.",
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
        a: "As a consultant, researcher, creative, or advocate, you can build a profile, post initiatives on the marketplace, express interest in initiatives posted by other organisations, and connect with organisations and funders looking for what you bring.  Organisations can also find and reach out to you based on your profile.",
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
        q: "Can we commission a Lab around a research challenge?",
        a: "Yes. A commissioned Lab is a structured process where Natives convenes the right stakeholders around a specific challenge. Research institutions can use this to bridge findings to practice and policy.",
      },
      {
        q: "How does partner matching work for research institutions?",
        a: "Verified research institutions can submit a matching request through the Get Matched feature. Natives identifies suitable partners based on your requests and assessed fit.",
      },
    ],
  },
  {
    section: "Labs",
    items: [
      {
        q: "What is a Lab?",
        a: "A Lab is a structured, time-bound process where Natives convenes stakeholders around a specific systemic challenge. It is a managed service. You define the problem. Natives structures the process and manages delivery.",
      },
      {
        q: "Who can commission a Lab?",
        a: "Any organisation or individual on the platform can commission a Lab. Labs are suited to challenges that require multiple stakeholders, structured coordination, and a defined outcome.",
      },
      {
        q: "What is a commissioned Lab?",
        a: "A commissioned Lab is initiated by an external partner with defined objectives. Natives provides the infrastructure for stakeholder alignment, coordination, and outcome tracking.",
      },
      {
        q: "How do I get involved in a Lab?",
        a: "Labs are not open applications. Natives curates participants based on profile fit, sector focus, and the specific needs of each Lab. If your profile matches a Lab being assembled, Natives will reach out directly. The best way to be considered is to keep your profile complete and up to date.",
      },
    ],
  },
  {
    section: "Trust & Verification",
    items: [
      {
        q: "How does verification work?",
        a: "Verification is conducted by the Natives platform team. Organisations are assessed based on legal registration, delivery capacity, and operational credibility relevant to their type. The process is designed to evolve into a multi-layered model involving trusted ecosystem partners over time.",
      },
      {
        q: "Who can verify an organisation?",
        a: "At present, verification is handled internally by the Natives team. The long-term design introduces a tiered model where selected anchor institutions and verified ecosystem actors may participate in the verification process.",
      },
      {
        q: "What if our circumstances change after verification?",
        a: "Organisations can update their profiles and submit new supporting documentation at any time. Verification status may be reviewed periodically as the platform matures.",
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
    <div className="w-full max-w-7xl mx-auto content-padding py-12 py-12 md:py-18">
      {/* Header */}
      <div className="border-b border-border py-16 px-6">
        <div className="max-w-7xl mx-auto">
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
      <div className="max-w-7xl mx-auto px-6 py-16 flex flex-col md:flex-row gap-12">
        {/* Sidebar tabs */}
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