import { useEffect, useState } from "react";

// Loading indicator: nothing for the first 300ms (most loads finish by then),
// after that a thin green bar across the top of the screen. Use instead of a
// centred spinner when a page or section is loading. Styles live in index.css
// (.route-bar-track / .route-bar).
export function TopBarLoader({ fullScreen, minHeight }: { fullScreen?: boolean; minHeight?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={fullScreen ? "min-h-screen bg-background" : ""} style={!fullScreen && minHeight ? { minHeight } : undefined} aria-busy="true">
      {show && (
        <div className="route-bar-track" role="progressbar" aria-label="Loading">
          <div className="route-bar" />
        </div>
      )}
    </div>
  );
}
