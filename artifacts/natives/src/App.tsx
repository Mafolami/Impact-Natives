import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

// Pages
import HomePage from "@/pages/HomePage";
import PlatformPage from "@/pages/PlatformPage";
import SolutionsPage from "@/pages/SolutionsPage";
import LabsPage from "@/pages/LabsPage";
import InsightsPage from "@/pages/InsightsPage";
import PartnerPage from "@/pages/PartnerPage";
import AboutPage from "@/pages/AboutPage";
import { LoginPage, SignupPage, SignupRolePage } from "@/pages/AuthPages";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={HomePage} />
          
          <Route path="/platform" component={PlatformPage} />
          <Route path="/platform/:tab" component={PlatformPage} />
          
          <Route path="/solutions" component={SolutionsPage} />
          <Route path="/solutions/:tab" component={SolutionsPage} />
          
          <Route path="/labs" component={LabsPage} />
          <Route path="/labs/:tab" component={LabsPage} />
          
          <Route path="/insights" component={InsightsPage} />
          <Route path="/insights/:tab" component={InsightsPage} />
          
          <Route path="/partner" component={PartnerPage} />
          <Route path="/about" component={AboutPage} />
          
          <Route path="/login" component={LoginPage} />
          <Route path="/signup" component={SignupPage} />
          <Route path="/signup/role" component={SignupRolePage} />
          
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
