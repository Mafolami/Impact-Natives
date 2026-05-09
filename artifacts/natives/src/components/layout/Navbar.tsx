import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

export function Navbar() {
  const [location] = useLocation();

  const isAuthPage = location.startsWith("/login") || location.startsWith("/signup");

  if (isAuthPage) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl tracking-tight">Natives</span>
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <span className="font-bold text-xl tracking-tight">Natives</span>
        </Link>
        
        <div className="hidden md:flex flex-1 justify-center">
          <NavigationMenu>
            <NavigationMenuList>
              
              <NavigationMenuItem>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <Link href="/">Home</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger>Platform</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                    <li>
                      <Link href="/platform/partnership-os" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">Partnership OS</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Discover organisations and collaborate.</p>
                      </Link>
                    </li>
                    <li>
                      <Link href="/platform/impact-verification" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">Impact Verification</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">SDG mapping and metrics dashboard.</p>
                      </Link>
                    </li>
                    <li>
                      <Link href="/platform/funding-infrastructure" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">Funding Infrastructure</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Grant alignment and co-funding tools.</p>
                      </Link>
                    </li>
                    <li>
                      <Link href="/platform/trust-verification" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">Trust & Verification</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Institutional-grade transparency signals.</p>
                      </Link>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger>Solutions</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                    <li>
                      <Link href="/solutions/ngos" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">For NGOs</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Funding visibility and reporting tools.</p>
                      </Link>
                    </li>
                    <li>
                      <Link href="/solutions/corporates" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">For Corporates</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">ESG implementation and impact tracking.</p>
                      </Link>
                    </li>
                    <li>
                      <Link href="/solutions/donors-governments" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">For Donors & Govts</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Measurable outcomes and coordination.</p>
                      </Link>
                    </li>
                    <li>
                      <Link href="/solutions/founders" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">For Founders</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Business model validation and pathways.</p>
                      </Link>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger>Labs & Network</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4">
                    <li>
                      <Link href="/labs/active" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">Active Labs</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Innovation challenges and programs.</p>
                      </Link>
                    </li>
                    <li>
                      <Link href="/labs/marketplace" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">Marketplace</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Searchable organization directory.</p>
                      </Link>
                    </li>
                    <li>
                      <Link href="/labs/impact-map" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">Impact Map</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Geographic visualization of ecosystem.</p>
                      </Link>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger>Insights & Impact</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2">
                    <li>
                      <Link href="/insights/dashboard" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">Impact Dashboard</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Ecosystem metrics, capital flows, SDG indicators.</p>
                      </Link>
                    </li>
                    <li>
                      <Link href="/insights/case-studies" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">Case Studies</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Evidence from the ground across sectors.</p>
                      </Link>
                    </li>
                    <li>
                      <Link href="/insights/research" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">Research & Reports</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Ecosystem intelligence and funding analyses.</p>
                      </Link>
                    </li>
                    <li>
                      <Link href="/insights/solution-library" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">Solution Library</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Proven models and intervention playbooks.</p>
                      </Link>
                    </li>
                    <li className="md:col-span-2">
                      <Link href="/insights/resources" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                        <div className="text-sm font-medium leading-none">Resource Hub</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">Templates, guides, and partnership frameworks.</p>
                      </Link>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <Link href="/partner">Partner With Us</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <Link href="/about">About</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center space-x-4">
          <Link href="/login">
            <Button variant="ghost" className="hidden sm:inline-flex">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Join Natives</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
