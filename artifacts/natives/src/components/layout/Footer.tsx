export function Footer() {
  return (
    <footer className="border-t bg-white py-12 md:py-16">
      <div className="container grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
        <div className="space-y-3">
          <h4 className="font-bold text-lg tracking-tight">Natives</h4>
          <p className="text-muted-foreground">
            Institutional-grade digital coordination and partnership infrastructure for Africa's social impact economy.
          </p>
        </div>
        <div>
          <h5 className="font-semibold mb-3">Platform</h5>
          <ul className="space-y-2 text-muted-foreground">
            <li>Partnership OS</li>
            <li>Impact Verification</li>
            <li>Funding Infrastructure</li>
            <li>Trust & Verification</li>
          </ul>
        </div>
        <div>
          <h5 className="font-semibold mb-3">Solutions</h5>
          <ul className="space-y-2 text-muted-foreground">
            <li>For NGOs</li>
            <li>For Corporates</li>
            <li>For Donors & Governments</li>
            <li>For Founders</li>
          </ul>
        </div>
        <div>
          <h5 className="font-semibold mb-3">Company</h5>
          <ul className="space-y-2 text-muted-foreground">
            <li>About</li>
            <li>Partner With Us</li>
            <li>Contact</li>
            <li>Privacy Policy</li>
          </ul>
        </div>
      </div>
      <div className="container mt-12 pt-8 border-t text-muted-foreground text-xs flex justify-between items-center">
        <p>© {new Date().getFullYear()} Impact Natives. All rights reserved.</p>
        <p>Built for the continent's most important work.</p>
      </div>
    </footer>
  );
}
