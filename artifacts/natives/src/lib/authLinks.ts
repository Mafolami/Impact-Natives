export const IS_APP_DOMAIN = typeof window !== "undefined" && window.location.hostname === "app.impactnatives.com";

// Campaign/channel tracking across the marketing-site <-> app-domain boundary.
// The two live on separate origins (impactnatives.com vs app.impactnatives.com),
// so a ?ref= param on a marketing page (e.g. impactnatives.com/?ref=outreach, used
// by the LinkedIn outreach campaign) can't ride in localStorage/sessionStorage across
// to the app -- it has to travel as a query param on the actual cross-domain link.
// SignUp.tsx reads it back off app.impactnatives.com's own URL and stashes it in
// sessionStorage as "signupSource" from there; Onboarding.tsx consumes it when the
// organizations row is created, which is what start_org_trial's auto-grant trigger
// keys off.
function getRefParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("ref");
}

export function appendRefParam(url: string): string {
  const ref = getRefParam();
  if (!ref) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}ref=${encodeURIComponent(ref)}`;
}

export function getAuthLinkProps(path: string) {
  return {
    href: IS_APP_DOMAIN ? path : appendRefParam(`https://app.impactnatives.com${path}`),
    target: IS_APP_DOMAIN ? undefined : ("_blank" as const),
    rel: "noreferrer",
  };
}

// For programmatic navigation (setLocation/navigate calls) instead of <a> props.
// Pass the component's own wouter setter so an internal move stays client-side.
export function navigateToAuth(path: string, setLocation?: (to: string) => void) {
  if (IS_APP_DOMAIN) {
    if (setLocation) setLocation(path);
    else window.location.href = path;
  } else {
    window.open(appendRefParam(`https://app.impactnatives.com${path}`), "_blank", "noreferrer");
  }
}
