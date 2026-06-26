import { NewsletterSignup } from "@/components/platform/NewsletterSignup";  

export function Footer() {
  return (
<footer className="border-t py-12 md:py-16" style={{ background: "hsl(193,20%,7%)", borderColor: "rgba(255,255,255,0.06)" }}>
<div className="max-w-8xl mx-auto content-padding py-12 w-full text-sm">
  {/* Mobile: stacked. Desktop: single row */}
  <div id="footer-desktop" style={{ display: 'none', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '2rem' }}>
    <div>
      <h5 className="font-bold mb-3" style={{ color: "#f7f3ed" }}>Platform</h5>
      <ul className="space-y-2" style={{ color: "rgba(247,243,237,0.55)" }}>
        <li><a href="/platform/partnership-os" className="hover:underline">Find a Partner</a></li>
        <li><a href="/platform/impact-marketplace" className="hover:underline">Impact Marketplace</a></li>
        <li><a href="/labs/commission" className="hover:underline">Commission a Lab</a></li>
      </ul>
    </div>
    <div>
      <h5 className="font-bold mb-3" style={{ color: "#f7f3ed" }}>Solutions</h5>
      <ul className="space-y-2" style={{ color: "rgba(247,243,237,0.55)" }}>
        <li><a href="/solutions/ngos" className="hover:underline">For NGOs/Non-Profits</a></li>
        <li><a href="/solutions/corporates" className="hover:underline">For Corporations</a></li>
        <li><a href="/solutions/donors" className="hover:underline">For Funders/Donors</a></li>
        <li><a href="/solutions/startups" className="hover:underline">For Startups & Social Enterprises</a></li>
      </ul>
    </div>
    <div>
      <h5 className="font-bold mb-3" style={{ color: "#f7f3ed" }}>Company</h5>
      <ul className="space-y-2" style={{ color: "rgba(247,243,237,0.55)" }}>
        <li><a href="/about" className="hover:underline">About</a></li>
        <li><a href="/partner" className="hover:underline">Partner With Us</a></li>
        <li><a href="/contact" className="hover:underline">Contact</a></li>
      </ul>
    </div>
    <div>
      <h5 className="font-bold mb-3" style={{ color: "#f7f3ed" }}>Legal</h5>
      <ul className="space-y-2" style={{ color: "rgba(247,243,237,0.55)" }}>
        <li><a href="/legal/privacy" className="hover:underline">Privacy Policy</a></li>
        <li><a href="/legal/terms" className="hover:underline">Terms of Service</a></li>
        <li><a href="/legal/cookies" className="hover:underline">Cookie Policy</a></li>
      </ul>
    </div>
    <div className="md:col-span-2 space-y-3" style={{ maxWidth: '280px' }}>
      <h4 className="font-bold text-lg tracking-tight" style={{ color: "#f7f3ed" }}>Natives</h4>
      <p style={{ color: "rgba(247,243,237,0.55)" }}>
        Institutional-grade digital coordination and partnership infrastructure for Africa's social impact economy.
      </p>
      <div className="pt-2">
        <NewsletterSignup variant="footer" />
      </div>
    </div>
  </div>

  {/* Mobile only */}
  <div id="footer-mobile" className="space-y-8">
    <div className="grid grid-cols-2 gap-8">
      <div>
        <h5 className="font-bold mb-3" style={{ color: "#f7f3ed" }}>Platform</h5>
        <ul className="space-y-2" style={{ color: "rgba(247,243,237,0.55)" }}>
          <li><a href="/platform/partnership-os" className="hover:underline">Find a Partner</a></li>
          <li><a href="/platform/impact-marketplace" className="hover:underline">Impact Marketplace</a></li>
          <li><a href="/labs/commission" className="hover:underline">Commission a Lab</a></li>
        </ul>
      </div>
      <div>
        <h5 className="font-bold mb-3" style={{ color: "#f7f3ed" }}>Solutions</h5>
        <ul className="space-y-2" style={{ color: "rgba(247,243,237,0.55)" }}>
          <li><a href="/solutions/ngos" className="hover:underline">For NGOs/Non-Profits</a></li>
          <li><a href="/solutions/corporates" className="hover:underline">For Corporations</a></li>
          <li><a href="/solutions/donors" className="hover:underline">For Funders/Donors</a></li>
          <li><a href="/solutions/startups" className="hover:underline">For Startups & Social Enterprises</a></li>
        </ul>
      </div>
      <div>
        <h5 className="font-bold mb-3" style={{ color: "#f7f3ed" }}>Company</h5>
        <ul className="space-y-2" style={{ color: "rgba(247,243,237,0.55)" }}>
          <li><a href="/about" className="hover:underline">About</a></li>
          <li><a href="/partner" className="hover:underline">Partner With Us</a></li>
          <li><a href="/contact" className="hover:underline">Contact</a></li>
        </ul>
      </div>
      <div>
        <h5 className="font-bold mb-3" style={{ color: "#f7f3ed" }}>Legal</h5>
        <ul className="space-y-2" style={{ color: "rgba(247,243,237,0.55)" }}>
          <li><a href="/legal/privacy" className="hover:underline">Privacy Policy</a></li>
          <li><a href="/legal/terms" className="hover:underline">Terms of Service</a></li>
          <li><a href="/legal/cookies" className="hover:underline">Cookie Policy</a></li>
        </ul>
      </div>
      <div className="space-y-3">
      <h4 className="font-bold text-lg tracking-tight" style={{ color: "#f7f3ed" }}>Natives</h4>
      <p style={{ color: "rgba(247,243,237,0.55)" }}>
        Institutional-grade digital coordination and partnership infrastructure for Africa's social impact economy.
      </p>
      <div className="pt-2">
        <NewsletterSignup variant="footer" />
      </div>
    </div>
    </div>
  </div>
</div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full mt-12 pt-8 text-xs flex justify-between items-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(247,243,237,0.35)" }}>
        <p>© {new Date().getFullYear()} Impact Natives. All rights reserved.</p>
        <p>Built for the continent's most important work.</p>
      </div>
    </footer>
  );
}