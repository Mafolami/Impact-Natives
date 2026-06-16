# App.tsx — changes needed (surgical diff)

## 1. Add AuthProvider import + wrap the Router

At the top of App.tsx, add:
  import { AuthProvider } from "@/context/AuthContext";

Wrap your existing Router (or top-level div) in <AuthProvider>:
  function App() {
    return (
      <AuthProvider>
        {/* existing Router/Switch/Routes here */}
      </AuthProvider>
    );
  }

## 2. Add routes inside your Switch/Router

  import SignIn from "@/pages/SignIn";
  import SignUp from "@/pages/SignUp";
  import Onboarding from "@/pages/Onboarding";
  import AuthCallback from "@/pages/AuthCallback";
  import InitiativeDetail from "@/pages/InitiativeDetail";
  import Dashboard from "@/pages/Dashboard";

  // Inside your <Switch> or route list:
  <Route path="/signin" component={SignIn} />
  <Route path="/signup" component={SignUp} />
  <Route path="/onboarding" component={Onboarding} />
  <Route path="/auth/callback" component={AuthCallback} />
  <Route path="/initiatives/:id" component={InitiativeDetail} />
  <Route path="/dashboard" component={Dashboard} />


---

# ImpactMarketplace.tsx — bookmark + view button changes

## Bookmark icon on cards (add near your existing card render)

Add near top of the file:
  import { useAuth } from "@/context/AuthContext";
  import { useLocation } from "wouter";
  import { Bookmark } from "lucide-react";

Inside your component:
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

Fetch on mount (after existing data fetch):
  useEffect(() => {
    if (!user) return;
    supabase
      .from("saved_initiatives")
      .select("initiative_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setSavedIds(new Set(data.map((r) => r.initiative_id)));
      });
  }, [user]);

Toggle function:
  async function toggleSave(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    if (!user) return;
    if (savedIds.has(id)) {
      await supabase.from("saved_initiatives").delete().eq("user_id", user.id).eq("initiative_id", id);
      setSavedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } else {
      await supabase.from("saved_initiatives").insert({ user_id: user.id, initiative_id: id });
      setSavedIds((prev) => new Set(prev).add(id));
    }
  }

In your card JSX (inside the card, only render if user is signed in):
  {user && (
    <button onClick={(e) => toggleSave(e, initiative.id)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
      <Bookmark className={`w-4 h-4 ${savedIds.has(initiative.id) ? "fill-[#2D6A4F] text-[#2D6A4F]" : "text-gray-400"}`} />
    </button>
  )}

## View / Express Interest buttons on cards

  function handleCardAction(initiativeId: string, action: "view" | "eoi") {
    if (!user) {
      sessionStorage.setItem("redirectAfterAuth", `/initiatives/${initiativeId}`);
      navigate(`/signin?redirect=/initiatives/${initiativeId}`);
      return;
    }
    if (action === "view") navigate(`/initiatives/${initiativeId}`);
    // For EOI, navigate to detail page where modal lives
    if (action === "eoi") navigate(`/initiatives/${initiativeId}#eoi`);
  }

  // In card JSX:
  <Button size="sm" variant="outline" onClick={() => handleCardAction(initiative.id, "view")}>
    View
  </Button>
  <Button size="sm" className="bg-[#2D6A4F] hover:bg-[#245c43] text-white" onClick={() => handleCardAction(initiative.id, "eoi")}>
    Express Interest
  </Button>


---

# Supabase — Google OAuth setup (one-time)

1. In Supabase Dashboard → Authentication → Providers → Google:
   - Enable Google
   - Paste your Google Client ID and Secret from Google Cloud Console

2. In Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs, add:
   https://lzpxlnjvegpxjuexyjdj.supabase.co/auth/v1/callback

3. In Supabase Dashboard → Authentication → URL Configuration:
   - Site URL: your production domain (or http://localhost:5173 for dev)
   - Redirect URLs: add http://localhost:5173/auth/callback and your prod domain/auth/callback


---

# Onboarding trigger (optional — recommended)

After a new user signs up via email and confirms their email, redirect them to /onboarding.
The cleanest way: in AuthCallback.tsx, check if profile.full_name is null. If so, go to /onboarding instead of /dashboard.

Replace the navigate line in AuthCallback.tsx with:

  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (session) {
      const redirect = sessionStorage.getItem("redirectAfterAuth");
      if (redirect) sessionStorage.removeItem("redirectAfterAuth");
      // Check if profile is complete
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();
      if (!profile?.full_name) {
        navigate("/onboarding");
      } else {
        navigate(redirect || "/dashboard");
      }
    } else {
      navigate("/signin");
    }
  });
