export function isMarketingDomain(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "impactnatives.com";
}

export function getAuthLinkProps(path: "/signup" | "/signin" | "/login") {
  const external = isMarketingDomain();
  return {
    href: external ? `https://app.impactnatives.com${path}` : path,
    target: external ? ("_blank" as const) : undefined,
    rel: external ? "noreferrer" : undefined,
  };
}
