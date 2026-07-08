import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LogOut, User } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [descLeft, setDescLeft] = useState(24);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHovering = useRef(false);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut } = useAuth();
const [scrolled, setScrolled] = useState(false);
const isHomePage = location === "/" || location === "/labs/commission" 
|| location.startsWith("/labs/commission") || location === "/partner" 
|| location.startsWith("/partner") || location === "/market" || location === "/platform/impact-marketplace" 
|| location === "/platform/marketplace" || location === "/platform/partnership-os" 
|| location.startsWith("/platform/partnership-os") || location === "/solutions" || location.startsWith("/solutions/")
|| location === "/about" || location.startsWith("/about")
;

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 80);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleSection = (section: string) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isAuthPage =
    location.startsWith("/login") || location.startsWith("/signup") ||
    location.startsWith("/signin") || location.startsWith("/register");

  if (isAuthPage) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur h-[72px] md:h-[130px] py-8">
        {/* auth page header content */}
      </header>
    );
  }

  return (
    <>
<header id="main-header" className={`top-0 z-50 w-full transition-all duration-300 ${
  isHomePage ? "fixed" : "sticky bg-background border-b border-border"
} ${isHomePage && scrolled
    ? "bg-background border-b border-border shadow-sm"
    : isHomePage ? "border-b border-transparent backdrop-blur-none"
    : ""
}`} style={{
  background: isHomePage && !scrolled
    ? (document.documentElement.classList.contains('dark') ? 'transparent' : '#ffffff')
    : undefined
}}>
<div className="max-w-8xl mx-auto content-padding py-2 w-full flex items-center justify-between min-w-0">

          {/* ── LEFT — Logo ── */}
          <Link href="/" className="flex items-center shrink-0" ref={logoRef}>
            <img src="/logo.png" className="w-auto dark:hidden" style={{ height: 'clamp(4rem, 4.5vw, 4.5rem)' }} />
            <img src="/logodark.png" className="w-auto hidden dark:block" style={{ height: 'clamp(4rem, 4.5vw, 4.5rem)' }} />
          </Link>

          {/* ── CENTER — Desktop Navigation (hidden on mobile) ── */}
          <div className="hidden md:flex flex-1 items-center px-4" style={{ justifyContent: 'flex-end', marginRight: '120px' }}>
            <nav className="flex items-center gap-1 relative h-16 mr-8">
              {[
                {
                  label: "Platform",
                  description: "Tools and infrastructure to power your impact operations.",
                  links: [
                    { href: "/platform/partnership-os", label: "Find a Partner" },
                    { href: "/platform/impact-marketplace", label: "Impact Marketplace" },
                    { href: "/labs/commission", label: "Commission a Lab" },
                    // { href: "/platform/funding-infrastructure", label: "Funding Infrastructure" },
                    // { href: "/platform/impact-verification", label: "Impact Verification" },
                    // { href: "/platform/api-integrations", label: "API & Integrations" },
                    // { href: "/platform/founders-ecosystem", label: "Founders Ecosystem" },
                  ],
                },
                {
                  label: "Solutions",
                  description: "Tailored pathways for every actor in the impact ecosystem.",
                  links: [
                    { href: "/solutions/ngos", label: "NGOs & Non-Profits" },
                    { href: "/solutions/corporates", label: "Corporations" },
                    { href: "/solutions/donors", label: "Funders & Donors" },
                    { href: "/solutions/startups", label: "Startups & Social Enterprises" },
                    { href: "/solutions/individuals", label: "Individuals & Creatives" },
                    { href: "/solutions/research", label: "Research Institutions" },
                  ],
                },
                // {
                //   label: "Labs & Network",
                //   description: "Explore innovation programmes and connect with our growing ecosystem.",
                //   links: [
                //     { href: "/labs/commission", label: "Commission a Lab" },
                //     { href: "/labs/impact-map", label: "Impact Map" },
                //   ],
                // },
                                // {
                //   label: "Insights & Impact",
                //   description: "Data, research, and resources to inform decisions and demonstrate results.",
                //   links: [
                //     { href: "/insights/dashboard", label: "Impact Dashboard" },
                //     { href: "/insights/case-studies", label: "Case Studies" },
                //     { href: "/insights/research", label: "Research & Reports" },
                //     { href: "/insights/solution-library", label: "Solution Library" },
                //     { href: "/insights/resources", label: "Resource Hub" },
                //   ],
                // },
                {
                  label: "About",
                  description: "Learn who we are, what drives us, and how to work with us.",
                  links: [
                    { href: "/about", label: "Natives" },
                    { href: "/contact", label: "Contact Us" },
                    { href: "/faq", label: "FAQ" },
                  ],
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={(e) => {
                    isHovering.current = true;
                    if (closeTimer.current) clearTimeout(closeTimer.current);
                    setOpenSection(item.label);
                    const headerEl = document.getElementById('main-header');
                    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 130;
                    document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const logoRect = logoRef.current?.getBoundingClientRect();
                    const logoLeft = logoRect ? logoRect.left : 24;
                    if (item.label === "Platform") {
                      document.documentElement.style.setProperty('--trigger-left', `${logoLeft + 370}px`);
                    } else {
                      document.documentElement.style.setProperty('--trigger-left', `${rect.left}px`);
                    }
                    setDescLeft(item.label === "Platform" ? logoLeft + 110 : rect.left - 236);
                    document.documentElement.style.setProperty('--trigger-right', `${window.innerWidth - rect.right}px`);
                  }}
                  onMouseLeave={() => {
                    isHovering.current = false;
                    closeTimer.current = setTimeout(() => {
                      if (!isHovering.current) setOpenSection(null);
                    }, 300);
                  }}
                >
                                                        <button
                      className={`nav-trigger inline-flex h-7 items-center justify-center rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none ${
                      scrolled || !isHomePage || !document.documentElement.classList.contains('dark') ? "text-foreground" : "text-white"
                    } ${openSection === item.label || item.links.some(l => location.startsWith(l.href)) ? 'active' : ''}`}
                  >
                    {item.label}
                    <ChevronDown className={`relative top-[1px] ml-1 h-3 w-3 transition duration-300 ${openSection === item.label ? 'rotate-180' : ''}`} />
                  </button>
                  {openSection === item.label && (
<div
                      style={{ position: 'fixed', left: 0, top: 'var(--header-height, 64px)', width: '100vw', zIndex: 50 }}
                      onMouseEnter={() => {
                        isHovering.current = true;
                        if (closeTimer.current) clearTimeout(closeTimer.current);
                      }}
                      onMouseLeave={() => {
                        isHovering.current = false;
                        closeTimer.current = setTimeout(() => {
                          if (!isHovering.current) setOpenSection(null);
                        }, 300);
                      }}
                    >
                      <div className="shadow-lg py-8 relative border-b border-border bg-background" style={{ height: '350px' }}>
                        <div style={{ position: 'absolute', left: `${descLeft}px`, top: '2rem', width: '220px' }}>
                          <p className="text-xl font-bold text-foreground mb-2">{item.label}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <div style={{ position: 'absolute', left: `calc(var(--trigger-left, 200px) - 0.5rem)`, top: '2rem', bottom: '2rem', width: '1px' }} className="bg-border" />
                        <ul className="flex flex-col gap-1" style={{ paddingLeft: `calc(var(--trigger-left, 200px) + 1rem)`, paddingRight: '1.5rem' }}>
                          {item.links.map((link) => (
                            <li key={link.href}>
                              <Link
                                href={link.href}
                                className="flex items-center gap-3 py-2 text-base font-semibold text-foreground hover:text-primary transition-colors"
                                onClick={() => setOpenSection(null)}
                              >
                                {link.label} {/*<span>→</span>*/}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ))}
             <Link
                href="/partner"
                className={`nav-trigger inline-flex h-7 items-center justify-center rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none ${
                  scrolled || !isHomePage || !document.documentElement.classList.contains('dark') ? "text-foreground" : "text-white"
                } ${location.startsWith("/partner") ? "active" : ""}`}
              >
                Partner With Us
              </Link>
            </nav>
          </div>

          {/* ── RIGHT — Desktop auth buttons ── */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
<div style={{ color: scrolled || !isHomePage ? undefined : "white" }}>
              <ThemeToggle />
            </div>
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex items-center gap-2 rounded-full px-2 py-1 transition-colors ${isHomePage && !scrolled ? 'hover:bg-white/10' : 'hover:bg-muted'}`}
                  style={{ }}
                >
                  <div className="w-8 h-8 rounded-full bg-[#2D6A4F] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                    {((profile && profile.full_name && profile.full_name.trim()) || (user && user.email) || "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${scrolled || !isHomePage || !document.documentElement.classList.contains('dark') ? "text-foreground" : "text-white"}`}>
                  {(profile && profile.full_name) ? profile.full_name.split(" ")[0] : "Account"}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-background shadow-lg py-1 z-50">
                    <Link href="/dashboard" onClick={() => setUserMenuOpen(false)}>
                      <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer">
                        <User className="w-4 h-4" />
                        Dashboard
                      </div>
                    </Link>
                    <Link href="/dashboard/profile" onClick={() => setUserMenuOpen(false)}>
                      <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer">
                        <User className="w-4 h-4" />
                        Profile
                      </div>
                    </Link>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => { signOut(); setUserMenuOpen(false); }}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-muted transition-colors w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/signin">
                  <Button variant="ghost" className={`sign-in-btn transition-all duration-200 ${!scrolled && document.documentElement.classList.contains('dark') ? "text-white hover:text-white hover:bg-white/10" : ""}`}>
                    Log In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className={`transition-all duration-200 ${!scrolled && document.documentElement.classList.contains('dark') ? "bg-white text-[#2D6A4F] hover:bg-white/90" : "bg-primary text-white hover:bg-primary/90"}`}>
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* ── MOBILE — Hamburger ── */}
<div className="md:hidden flex items-center gap-2">
            <div style={{ color: scrolled || !isHomePage ? undefined : "white" }}>
              <ThemeToggle />
            </div>
            <button
              className={`p-2 rounded-md ${scrolled || !isHomePage || !document.documentElement.classList.contains('dark') ? "hover:bg-accent text-foreground" : "hover:bg-white/10 text-white"}`}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </header>

      {/* ── MOBILE MENU — outside header so it scrolls ── */}
      {mobileOpen && (
        <div
          className="md:hidden overflow-y-auto bg-background border border-border rounded-bl-2xl shadow-xl"
          style={{ position: 'fixed', top: '64px', right: 0, width: '288px', maxHeight: 'calc(100vh - 64px)', zIndex: 50 }}
        >
          <div className="flex flex-col px-6 py-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground py-2">Explore</p>
            <button onClick={() => toggleSection("platform")} className="flex items-center justify-between h-12 md:h-16 w-full py-2 text-sm font-medium text-left text-foreground hover:text-primary transition-colors">
              Platform
              <span className="text-xs text-muted-foreground">{openSection === "platform" ? "−" : "+"}</span>
            </button>
            {openSection === "platform" && (
              <div className="w-full flex flex-col gap-1 py-3 px-4 rounded-md border border-border bg-muted/50">
                <Link href="/platform/partnership-os" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Find a Partner</Link>
                <Link href="/platform/impact-marketplace" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Impact Marketplace</Link>
                {/*<Link href="/platform/impact-verification" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Impact Verification</Link>*/}
                <Link href="/labs/commission" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Commission a Lab</Link>
                {/* <Link href="/platform/funding-infrastructure" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Funding Infrastructure</Link> */}
              </div>
            )}
            <button onClick={() => toggleSection("solutions")} className="flex items-center justify-between h-12 md:h-16 w-full py-2 text-sm font-medium text-left text-foreground hover:text-primary transition-colors">
              Solutions
              <span className="text-xs text-muted-foreground">{openSection === "solutions" ? "−" : "+"}</span>
            </button>
            {openSection === "solutions" && (
              <div className="w-full flex flex-col gap-1 py-3 px-4 rounded-md border border-border bg-muted/50">
<Link href="/solutions/ngos" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>NGOs & Non-Profits</Link>
                <Link href="/solutions/corporates" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Corporations</Link>
                <Link href="/solutions/donors" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Funders & Donors</Link>
                <Link href="/solutions/startups" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Startups & Social Enterprises</Link>
                <Link href="/solutions/individuals" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Individuals & Creatives</Link>
                <Link href="/solutions/research" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Research Institutions</Link>
              </div>
            )}
            {/* Labs & Network — commented out; Commission a Lab moved to Platform
            <button onClick={() => toggleSection("labs")} className="flex items-center justify-between h-12 md:h-16 w-full py-2 text-sm font-medium text-left text-foreground hover:text-primary transition-colors">
              Labs & Network
              <span className="text-xs text-muted-foreground">{openSection === "labs" ? "−" : "+"}</span>
            </button>
            {openSection === "labs" && (
              <div className="w-full flex flex-col gap-1 py-3 px-4 rounded-md border border-border bg-muted/50">
                <Link href="/labs/commission" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Commission a Lab</Link>
                <Link href="/labs/impact-map" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Impact Map</Link>
              </div>
            )}
            */}
{/* Insights & Impact — hidden until content is ready
            <button onClick={() => toggleSection("insights")} className="flex items-center justify-between h-12 md:h-16 w-full py-2 text-sm font-medium text-left text-foreground hover:text-primary transition-colors">
              Insights & Impact
              <span className="text-xs text-muted-foreground">{openSection === "insights" ? "−" : "+"}</span>
            </button>
            {openSection === "insights" && (
              <div className="w-full flex flex-col gap-1 py-3 px-4 rounded-md border border-border bg-muted/50">
                <Link href="/insights/dashboard" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Impact Dashboard</Link>
                <Link href="/insights/case-studies" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Case Studies</Link>
                <Link href="/insights/research" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Research & Reports</Link>
                <Link href="/insights/solution-library" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Solution Library</Link>
                <Link href="/insights/resources" className="text-sm text-foreground hover:text-primary py-1" onClick={() => setMobileOpen(false)}>Resource Hub</Link>
              </div>
            )}
            */}
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground py-2 pt-4">Company</p>
            <Link href="/about" className="text-sm font-medium py-2 text-foreground hover:text-primary transition-colors" onClick={() => setMobileOpen(false)}>About</Link>
            <Link href="/partner" className="text-sm font-medium py-2 text-foreground hover:text-primary transition-colors" onClick={() => setMobileOpen(false)}>Partner With Us</Link>
            <Link href="/faq" className="text-sm font-medium py-2 text-foreground hover:text-primary transition-colors" onClick={() => setMobileOpen(false)}>FAQ</Link>
            <Link href="/about" className="text-sm font-medium py-2 text-foreground hover:text-primary transition-colors" onClick={() => setMobileOpen(false)}>Contact Us</Link>
            <div className="pt-4 border-t flex flex-col gap-3 mt-2">
              {user ? (
                <>
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full">Dashboard</Button>
                  </Link>
                  <Button
                    className="w-full bg-destructive text-white"
                    onClick={() => { signOut(); setMobileOpen(false); }}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/signin" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full">Log In</Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                      Create Account
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}