import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useReveal } from "@/hooks/useReveal";
import { ThemeProvider } from "next-themes"
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ExitIntentPopup } from "@/components/platform/ExitIntentPopup";
import { AuthProvider } from "@/context/AuthContext";
// Public pages — loaded eagerly (homepage visitors need these immediately)
import HomePage from "@/pages/HomePage";
import NotFound from "@/pages/not-found";
// Public pages — lazy loaded
const PlatformPage = lazy(() => import("@/pages/PlatformPage"));
const ImpactMarketplace = lazy(() => import("@/components/platform/ImpactMarketplace").then(m => ({ default: m.ImpactMarketplace })));
const SolutionsPage = lazy(() => import("@/pages/SolutionsPage"));
const LabsPage = lazy(() => import("@/pages/LabsPage"));
const InsightsPage = lazy(() => import("@/pages/InsightsPage"));
const PartnerPage = lazy(() => import("@/pages/PartnerPage"));
const FAQPage = lazy(() => import("@/pages/FAQPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const ContactPage = lazy(() => import("@/pages/contact"));
const LegalPage = lazy(() => import("@/pages/LegalPage"));
const InitiativeDetail = lazy(() => import("@/pages/InitiativeDetail"));
const VerificationStandardPage = lazy(() => import("@/pages/VerificationStandardPage"));
const UnsubscribePage = lazy(() => import("@/pages/UnsubscribePage"));
// Auth pages — lazy loaded
const LoginPage = lazy(() => import("@/pages/AuthPages").then(m => ({ default: m.LoginPage })));
const SignupRolePage = lazy(() => import("@/pages/AuthPages").then(m => ({ default: m.SignupRolePage })));
const SignIn = lazy(() => import("@/pages/SignIn"));
const SignUp = lazy(() => import("@/pages/SignUp"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const VerifyOrganisation = lazy(() => import("@/pages/VerifyOrganisation"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
// Dashboard pages — lazy loaded
const DashboardHome = lazy(() => import("@/pages/DashboardHome"));
const DashboardPartnerships = lazy(() => import("@/pages/DashboardPartnerships"));
const DashboardPortfolio = lazy(() => import("@/pages/DashboardPortfolio"));
const DashboardLabs = lazy(() => import("@/pages/DashboardLabs"));
const DashboardMarketplace = lazy(() => import("@/pages/DashboardMarketplace"));
const DashboardMessages = lazy(() => import("@/pages/DashboardMessages"));
const DashboardProfile = lazy(() => import("@/pages/DashboardProfile"));
const UpgradeToOrganisation = lazy(() => import("@/pages/UpgradeToOrganisation"));
const DashboardSettings = lazy(() => import("@/pages/DashboardSettings"));
const DashboardNatives = lazy(() => import("@/pages/DashboardNatives"));
const DashboardFeed = lazy(() => import("@/pages/DashboardFeed"));
const DashboardStrategy = lazy(() => import("@/pages/DashboardStrategy"));
const DashboardLayout = lazy(() => import("@/layouts/DashboardLayout"));
// Admin pages — lazy loaded
const AdminReview = lazy(() => import("@/pages/AdminReview"));

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [, navigate] = useLocation();


  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/signin"); return; }
    if (profile && !profile.is_admin) { navigate("/dashboard"); }
  }, [user, profile, loading, navigate]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  if (!profile.is_admin) return null;

  return <>{children}</>;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();
  const [hideFooter, setHideFooter] = useState(
    () => location === "/partner" && sessionStorage.getItem("openForm") === "1"
  );

  useEffect(() => {
    const handleOpen = () => setHideFooter(true);
    const handleClose = () => setHideFooter(false);
    window.addEventListener("partnerFormOpened", handleOpen);
    window.addEventListener("partnerFormClosed", handleClose);
    return () => {
      window.removeEventListener("partnerFormOpened", handleOpen);
      window.removeEventListener("partnerFormClosed", handleClose);
    };
  }, []);

    const isDashboard = location.startsWith("/dashboard");
  const isAdmin = location.startsWith("/admin");


if (isAdmin) {
    return (
      <>
        <ScrollToTop />
        <DashboardLayout adminOnly><AdminReview /></DashboardLayout>
      </>
    );
  }

  if (isDashboard) {
    return (
      <>
        <ScrollToTop />
        {/* DashboardLayout (and the Sidebar inside it) now mounts ONCE for
            the whole /dashboard section instead of once per Route. Before,
            each Route wrapped its own separate DashboardLayout instance, so
            Switch swapping branches destroyed and rebuilt the entire layout
            \u2014 sidebar included \u2014 on every single navigation. The nested
            Suspense below keeps a not-yet-loaded page chunk's loading state
            confined to the content area, so it no longer bubbles up to the
            app-level Suspense and blanks the sidebar too. */}
        <DashboardLayout>
          <Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
            </div>
          }>
            <Switch>
              <Route path="/dashboard/partnerships"><DashboardPartnerships /></Route>
              <Route path="/dashboard/portfolio/partner/:orgId"><DashboardPortfolio /></Route>
              <Route path="/dashboard/portfolio/:id"><DashboardPortfolio /></Route>
              <Route path="/dashboard/portfolio"><DashboardPortfolio /></Route>
              <Route path="/dashboard/labs"><DashboardLabs /></Route>
              <Route path="/dashboard/marketplace/:id"><DashboardMarketplace /></Route>
              <Route path="/dashboard/marketplace"><DashboardMarketplace /></Route>
              <Route path="/dashboard/strategy"><DashboardStrategy /></Route>
              <Route path="/dashboard/natives"><DashboardNatives /></Route>
              <Route path="/dashboard/feed"><DashboardFeed /></Route>
              <Route path="/dashboard/messages"><DashboardMessages /></Route>
              <Route path="/dashboard/profile"><DashboardProfile /></Route>
              <Route path="/dashboard/upgrade-organisation"><UpgradeToOrganisation /></Route>
              <Route path="/dashboard/settings"><DashboardSettings /></Route>
              <Route path="/dashboard"><DashboardHome /></Route>
            </Switch>
          </Suspense>
        </DashboardLayout>
      </>
    );
  }
    const isAuthPage = [
    "/signin", "/signup", "/register", "/login",
    "/forgot-password", "/reset-password",
    "/onboarding", "/auth/callback", "/verify",
  ].includes(location) || location.startsWith("/signup");

  if (isAuthPage) {
    return (
      <>
        <ScrollToTop />
        <Switch>
          <Route path="/signup" component={SignUp} />
          <Route path="/signup/role" component={SignupRolePage} />
          <Route path="/signin" component={SignIn} />
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={SignUp} />
          <Route path="/onboarding" component={Onboarding} />
          <Route path="/auth/callback" component={AuthCallback} />
          <Route path="/verify" component={VerifyOrganisation} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
        </Switch>
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
<main className="flex-1 homepage-main">
        <Switch>
          <Route path="/legal/:doc" component={LegalPage} />
          <Route path="/legal" component={LegalPage} />
          <Route path="/" component={HomePage} />
          <Route path="/platform" component={PlatformPage} />
          <Route path="/platform/:tab" component={PlatformPage} />
          <Route path="/market" component={ImpactMarketplace} />
          <Route path="/platform/marketplace" component={ImpactMarketplace} />
          <Route path="/platform/impact-marketplace" component={ImpactMarketplace} />
          <Route path="/solutions" component={SolutionsPage} />
          <Route path="/solutions/:tab" component={SolutionsPage} />
          <Route path="/labs" component={LabsPage} />
          <Route path="/labs/:tab" component={LabsPage} />
          <Route path="/insights" component={InsightsPage} />
          <Route path="/insights/:tab" component={InsightsPage} />
          <Route path="/partner" component={PartnerPage} />
          <Route path="/faq" component={FAQPage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/initiatives/:id" component={InitiativeDetail} />
          <Route path="/test-supabase" component={SupabaseTest} />
          <Route path="/contact" component={ContactPage} />
          <Route path="/unsubscribe" component={UnsubscribePage} />
          <Route path="/verification-standard" component={VerificationStandardPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      {!hideFooter && <Footer />}
      <ExitIntentPopup />
    </div>
  );
}

function SupabaseTest() {
  useEffect(() => {
    async function test() {
      const { data, error } = await supabase
        .from("organizations")
        .select("*");
    }

    test();
  }, []);

  return (
    <div className="p-10">
      Testing Supabase connection...
    </div>
  );
}

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
  </div>
);

const AUTH_PATHS = ["/signin", "/signup", "/onboarding", "/auth/callback", "/verify", "/forgot-password", "/reset-password"];
function App() {
  useReveal();
  const isAuthPage = AUTH_PATHS.some(p => window.location.pathname.startsWith(p));
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={isAuthPage ? "light" : "system"}
      enableSystem={!isAuthPage}
      forcedTheme={isAuthPage ? "light" : undefined}
      disableTransitionOnChange
      storageKey="next-themes">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Suspense fallback={<PageLoader />}>
                <Router />
              </Suspense>
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

