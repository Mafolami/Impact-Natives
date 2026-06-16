import { useEffect } from "react";
import { useLocation } from "wouter";

export function useReveal() {
  const [location] = useLocation();

  useEffect(() => {
    // Small delay lets the new page's DOM actually render
    // before we query for [data-reveal] elements
    const timer = setTimeout(() => {
      const elements = document.querySelectorAll("[data-reveal]");

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

      elements.forEach((el) => observer.observe(el));

      return () => observer.disconnect();
    }, 50);

    return () => clearTimeout(timer);
  }, [location]); // ← re-runs on every route change
}