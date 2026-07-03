import { useEffect, useState } from "react";
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

// Pages
import HomePage from "@/pages/HomePage";
import PlatformPage from "@/pages/PlatformPage";
import { ImpactMarketplace } from "@/components/platform/ImpactMarketplace";
import AdminInitiativeReview from '@/pages/AdminInitiativeReview'
import SolutionsPage from "@/pages/SolutionsPage";
import LabsPage from "@/pages/LabsPage";
import InsightsPage from "@/pages/InsightsPage";
import PartnerPage from "@/pages/PartnerPage";
import FAQPage from "@/pages/FAQPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/contact";
import { LoginPage, SignupRolePage } from "@/pages/AuthPages";
import NotFound from "@/pages/not-found";
import AdminDashboard from "./pages/AdminDashboard";
import { AuthProvider } from "@/context/AuthContext";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";
import LegalPage from "@/pages/LegalPage";
import Onboarding from "@/pages/Onboarding";
import AuthCallback from "@/pages/AuthCallback";
import VerifyOrganisation from "@/pages/VerifyOrganisation";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import InitiativeDetail from "@/pages/InitiativeDetail";
import DashboardHome from "@/pages/DashboardHome";
import DashboardPartnerships from "@/pages/DashboardPartnerships";
import DashboardInitiatives from "@/pages/DashboardInitiatives";
import DashboardLabs from "@/pages/DashboardLabs";
import DashboardMarketplace from "@/pages/DashboardMarketplace";
import DashboardMessages from "@/pages/DashboardMessages";
import DashboardProfile from "@/pages/DashboardProfile";
import UpgradeToOrganisation from "@/pages/UpgradeToOrganisation";
import DashboardSettings from "@/pages/DashboardSettings";
import DashboardNatives from "@/pages/DashboardNatives";
import DashboardFeed from "@/pages/DashboardFeed";
import DashboardStrategy from "@/pages/DashboardStrategy";
import DashboardLayout from "@/layouts/DashboardLayout";
import VerificationStandardPage from "@/pages/VerificationStandardPage";

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
        <Switch>
          <Route path="/admin/initiatives">
            <DashboardLayout adminOnly><AdminInitiativeReview /></DashboardLayout>
          </Route>
          <Route path="/admin">
            <DashboardLayout adminOnly><AdminDashboard /></DashboardLayout>
          </Route>
        </Switch>
      </>
    );
  }

  if (isDashboard) {
    return (
      <>
        <ScrollToTop />
        <Switch>
          <Route path="/dashboard/partnerships">
            <DashboardLayout><DashboardPartnerships /></DashboardLayout>
          </Route>
          <Route path="/dashboard/initiatives/:id">
            <DashboardLayout><DashboardInitiatives /></DashboardLayout>
          </Route>
          <Route path="/dashboard/initiatives">
            <DashboardLayout><DashboardInitiatives /></DashboardLayout>
          </Route>
          <Route path="/dashboard/labs">
            <DashboardLayout><DashboardLabs /></DashboardLayout>
          </Route>
          <Route path="/dashboard/marketplace/:id">
            <DashboardLayout><DashboardMarketplace /></DashboardLayout>
          </Route>
          <Route path="/dashboard/marketplace">
            <DashboardLayout><DashboardMarketplace /></DashboardLayout>
          </Route>
          <Route path="/dashboard/strategy">
            <DashboardLayout><DashboardStrategy /></DashboardLayout>
          </Route>
          <Route path="/dashboard/natives">
            <DashboardLayout><DashboardNatives /></DashboardLayout>
          </Route>
          <Route path="/dashboard/feed">
            <DashboardLayout><DashboardFeed /></DashboardLayout>
          </Route>
          <Route path="/dashboard/messages">
            <DashboardLayout><DashboardMessages /></DashboardLayout>
          </Route>
          <Route path="/dashboard/profile">
            <DashboardLayout><DashboardProfile /></DashboardLayout>
          </Route>
          <Route path="/dashboard/upgrade-organisation">
            <DashboardLayout><UpgradeToOrganisation /></DashboardLayout>
          </Route>
          <Route path="/dashboard/settings">
            <DashboardLayout><DashboardSettings /></DashboardLayout>
          </Route>
          <Route path="/dashboard">
            <DashboardLayout><DashboardHome /></DashboardLayout>
          </Route>
        </Switch>
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
              <Router />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

