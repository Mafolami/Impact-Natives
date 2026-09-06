export const IS_APP_DOMAIN = typeof window !== "undefined" && window.location.hostname === "app.impactnatives.com";

export function getAuthLinkProps(path: "/signup" | "/signin" | "/login") {
  return {
    href: IS_APP_DOMAIN ? path : `https://app.impactnatives.com${path}`,
    target: IS_APP_DOMAIN ? undefined : ("_blank" as const),
    rel: "noreferrer",
  };
}

// For programmatic navigation (setLocation/navigate calls) instead of <a> props.
// Pass the component's own wouter setter so an internal move stays client-side.
export function navigateToAuth(path: "/signup" | "/signin" | "/login", setLocation?: (to: string) => void) {
  if (IS_APP_DOMAIN) {
    if (setLocation) setLocation(path);
    else window.location.href = path;
  } else {
    window.open(`https://app.impactnatives.com${path}`, "_blank", "noreferrer");
  }
}
