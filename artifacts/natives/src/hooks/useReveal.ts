import { useEffect } from "react";
import { useLocation } from "wouter";

export function useReveal() {
  const [location] = useLocation();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          } else {
            entry.target.classList.remove("revealed");
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -60px 0px" }
    );

    // Observe whatever [data-reveal] elements already exist right now.
    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));

    // Lazy-loaded route chunks (React.lazy + Suspense) can still be
    // fetching over the network when this effect first runs -- on a cold
    // first visit, that page's [data-reveal] sections don't exist in the
    // DOM yet at the moment of the scan above, so they never get observed
    // and stay at opacity: 0 forever. Nothing re-triggers this effect once
    // the chunk finally renders, since the route itself hasn't changed --
    // it just finished loading late. A MutationObserver catches those
    // elements the instant they're actually added to the DOM, regardless
    // of how long the chunk took to arrive, closing that race entirely.
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.hasAttribute("data-reveal")) observer.observe(node);
          node.querySelectorAll?.("[data-reveal]").forEach((el) => observer.observe(el));
        });
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [location]);
}