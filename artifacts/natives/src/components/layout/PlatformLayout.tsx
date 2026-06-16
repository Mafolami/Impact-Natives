import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function PlatformLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthPage =
    location === "/login" ||
    location === "/signup" ||
    location === "/signup/role";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-border/50 flex-shrink-0 z-20 transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="flex flex-col h-full px-4 py-6 space-y-4">
          <nav className="flex-1 space-y-2">
            <Link href="/dashboard" className={`block px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md ${location === '/dashboard' ? 'bg-accent text-accent-foreground' : ''}`}>
              Dashboard
            </Link>
            <Link href="/marketplace" className={`block px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md ${location === '/marketplace' ? 'bg-accent text-accent-foreground' : ''}`}>
              Marketplace
            </Link>
            <Link href="/funding" className={`block px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md ${location === '/funding' ? 'bg-accent text-accent-foreground' : ''}`}>
              Funding
            </Link>
            <Link href="/labs" className={`block px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md ${location === '/labs' ? 'bg-accent text-accent-foreground' : ''}`}>
              Labs
            </Link>
            <Link href="/founders" className={`block px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md ${location === '/founders' ? 'bg-accent text-accent-foreground' : ''}`}>
              Founders
            </Link>
            <Link href="/insights" className={`block px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md ${location === '/insights' ? 'bg-accent text-accent-foreground' : ''}`}>
              Insights
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-64 md:ml-0 z-[9999] transition-md">
        {/* Topbar */}
        {!isAuthPage && (
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex-1">
                {title && <h1 className="text-xl font-semibold tracking-tight">{title}</h1>}
              </div>
              <div className="flex items-center gap-3 md:hidden">
                <button
                  className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setMobileOpen(!mobileOpen)}
                  aria-label="Toggle menu"
                >
                  {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
              <div className="hidden md:flex items-center gap-3">
                {/* User area placeholder */}
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="text-muted-foreground">User</span>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Page content */}
        <main className="pt-16 pb-12 px-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}