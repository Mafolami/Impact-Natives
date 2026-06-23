import { ShieldCheck } from "lucide-react"

export default function VerificationStandardPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-16 space-y-10">

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#2D6A4F]" />
            <span className="text-sm font-semibold text-[#2D6A4F] uppercase tracking-wider">Verification</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}>
            What it means to be verified on Impact Natives
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Verified organisations have gone through a document review process. The badge signals that an organisation is trusted, impact-credible, and partner-ready.
          </p>
        </div>

        {/* What verification confirms */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">What verification confirms</h2>
          <div className="space-y-3">
            {[
              { title: "Legal status", body: "The organisation is formally registered — as an NGO, social enterprise, foundation, company, or equivalent legal entity." },
              { title: "Organisational identity", body: "The organisation exists as described on their profile. Name, type, and country of operation are consistent with submitted documents." },
              { title: "Good faith participation", body: "The organisation has engaged with the verification process in good faith and provided documentation they believe supports their credibility on the platform." },
            ].map(item => (
              <div key={item.title} className="rounded-xl border border-border bg-card px-5 py-4">
                <p className="text-sm font-semibold text-foreground mb-1">{item.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What it does not confirm */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">What it does not confirm</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Verification is not an endorsement of an organisation's programmes, financial health, or impact claims. It does not guarantee successful partnerships. Users should conduct their own due diligence before entering formal agreements.
          </p>
        </div>

        {/* Documents accepted */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Documents accepted</h2>
          <ul className="space-y-2">
            {[
              "Certificate of incorporation or registration",
              "NGO or charity registration certificate",
              "Tax exemption or nonprofit status letter",
              "Government-issued operating licence",
              "MoU or endorsement letter from a recognised institution",
              "Any other document that supports your organisation's credibility",
            ].map(doc => (
              <li key={doc} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2D6A4F] shrink-0" />
                {doc}
              </li>
            ))}
          </ul>
        </div>

        {/* How to apply */}
        <div className="rounded-xl border border-[#2D6A4F]/30 bg-[#2D6A4F]/5 px-5 py-5 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">How to apply</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Verification is available to all organisations on Impact Natives. To apply, go to your dashboard, open your organisation profile, and submit your documents through the verification flow. Reviews are conducted by the Impact Natives team.
          </p>
          <a href="/dashboard"
            className="inline-block mt-1 rounded-full px-5 py-2 bg-[#2D6A4F] text-white text-sm font-semibold hover:bg-[#245c43] transition-colors">
            Go to your dashboard
          </a>
        </div>

      </div>
    </div>
  )
}