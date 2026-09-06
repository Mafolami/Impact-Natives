import { useEffect, useRef, useState } from "react";
import { navigateToAuth } from "@/lib/authLinks";
import { useParams } from "wouter";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { Users, Calendar, Search, MapPin, Globe, ShieldCheck } from "lucide-react";
import { CommissionLabTab } from "@/components/platform/CommissionLabTab";
import { LabRequestModal } from "@/components/platform/LabRequestModal";

function ImpactMap({ view, verifiedOnly }: { view: string; verifiedOnly: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const orgData = [
    { name: "Kilimo Trust", country: "Uganda", sector: "Agritech", sdgs: [2,8], verified: true, lat: 1.3, lon: 32.3 },
    { name: "GreenBase Africa", country: "Kenya", sector: "Climate", sdgs: [13,15], verified: false, lat: -1.3, lon: 36.8 },
    { name: "HealthBridge NGO", country: "Nigeria", sector: "Health", sdgs: [3,10], verified: true, lat: 9.1, lon: 8.7 },
    { name: "Sahel Adapt", country: "Senegal", sector: "Climate", sdgs: [13,1], verified: true, lat: 14.5, lon: -14.5 },
    { name: "AgriLink Co-op", country: "Ghana", sector: "Agritech", sdgs: [2,17], verified: false, lat: 7.9, lon: -1.0 },
    { name: "Ubuntu Health Fund", country: "South Africa", sector: "Health", sdgs: [3,8], verified: true, lat: -28.5, lon: 24.7 },
  ];

  const projectData = [
    { name: "Agritech Innovation Lab", country: "Kenya", status: "Open", lat: -0.5, lon: 37.5 },
    { name: "Climate Resilience Lab", country: "Ethiopia", status: "Open", lat: 9.0, lon: 40.5 },
    { name: "Health Systems Lab", country: "Nigeria", status: "Coming Soon", lat: 6.5, lon: 3.4 },
  ];

  const partnershipData = [
    { name: "Kilimo × HealthBridge", countries: ["Uganda", "Nigeria"], lat: 5.0, lon: 20.0 },
    { name: "GreenBase × Sahel Adapt", countries: ["Kenya", "Senegal"], lat: 10.0, lon: 10.0 },
  ];

  const sectorColors: Record<string, string> = {
    Agritech: "#3B6D11",
    Climate: "#185FA5",
    Health: "#993C1D",
  };

  function renderMap() {
    const d3 = (window as any).d3;
    const topojson = (window as any).topojson;
    if (!d3 || !topojson || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 600, height = 650;
    const projection = d3.geoMercator().center([20, 2]).scale(620).translate([width / 2, height / 2]);
    const path = d3.geoPath(projection);
    const isDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const fillBase = isDark ? "#2a2a28" : "#e8e6df";
    const fillHighlight = isDark ? "#3a3a35" : "#d4d1c5";
    const strokeColor = isDark ? "rgba(255,255,255,0.1)" : "#fff";

    const g = svg.append("g");
    const pointsG = svg.append("g");

    const africaIds = new Set([
      12,24,72,108,120,132,140,144,148,174,175,180,188,204,226,231,232,262,266,270,288,
      324,328,384,404,426,430,434,440,450,454,458,466,478,480,504,508,516,562,566,624,
      630,646,678,686,694,706,710,716,724,728,729,732,740,768,788,800,818,834,854,894
    ]);

    const showTip = (e: MouseEvent, html: string) => {
      if (!tooltipRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      tooltipRef.current.innerHTML = html;
      tooltipRef.current.style.display = "block";
      tooltipRef.current.style.left = (e.clientX - rect.left + 12) + "px";
      tooltipRef.current.style.top = (e.clientY - rect.top - 10) + "px";
    };
    const hideTip = () => {
      if (tooltipRef.current) tooltipRef.current.style.display = "none";
    };

    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then((world: any) => {
      const countries = topojson.feature(world, world.objects.countries);
      g.selectAll("path")
        .data(countries.features.filter((d: any) => africaIds.has(+d.id)))
        .join("path")
        .attr("d", path)
        .attr("fill", fillBase)
        .attr("stroke", strokeColor)
        .attr("stroke-width", 0.5)
        .on("mouseover", function (this: any) { d3.select(this).attr("fill", fillHighlight); })
        .on("mouseout", function (this: any) { d3.select(this).attr("fill", fillBase); });

      if (view === "orgs") {
        const items = verifiedOnly ? orgData.filter(d => d.verified) : orgData;
        items.forEach(d => {
          const [x, y] = projection([d.lon, d.lat]);
          const col = sectorColors[d.sector] || "#5F5E5A";
          const pg = pointsG.append("g").style("cursor", "pointer");
          pg.append("circle").attr("cx", x).attr("cy", y).attr("r", 9)
            .attr("fill", col).attr("fill-opacity", 0.9)
            .attr("stroke", "#fff").attr("stroke-width", 1.5);
          if (d.verified) {
            pg.append("text").attr("x", x).attr("y", y + 4)
              .attr("text-anchor", "middle").attr("font-size", 9)
              .attr("fill", "#fff").attr("pointer-events", "none").text("✓");
          }
          pg.on("mousemove", (e: MouseEvent) => showTip(e,
            `<strong>${d.name}</strong><br>
            <span style="color:var(--color-text-secondary)">${d.country} · ${d.sector}<br>SDGs: ${d.sdgs.join(", ")}</span>
            ${d.verified ? '<br><span style="color:#3B6D11">✓ Verified</span>' : ""}`
          )).on("mouseleave", hideTip);
        });
      } else if (view === "projects") {
        projectData.forEach(d => {
          const [x, y] = projection([d.lon, d.lat]);
          const col = d.status === "Open" ? "#185FA5" : "#888780";
          const pg = pointsG.append("g").style("cursor", "pointer");
          pg.append("rect").attr("x", x - 8).attr("y", y - 8).attr("width", 16).attr("height", 16)
            .attr("rx", 3).attr("fill", col).attr("fill-opacity", 0.9)
            .attr("stroke", "#fff").attr("stroke-width", 1.5);
          pg.on("mousemove", (e: MouseEvent) => showTip(e,
            `<strong>${d.name}</strong><br>
            <span style="color:var(--color-text-secondary)">${d.country}</span><br>
            <span style="color:${col}">${d.status}</span>`
          )).on("mouseleave", hideTip);
        });
      } else {
        partnershipData.forEach(d => {
          const [x, y] = projection([d.lon, d.lat]);
          const pg = pointsG.append("g").style("cursor", "pointer");
          pg.append("polygon")
            .attr("points", "0,-11 9,5 -9,5")
            .attr("transform", `translate(${x},${y})`)
            .attr("fill", "#993C1D").attr("fill-opacity", 0.9)
            .attr("stroke", "#fff").attr("stroke-width", 1.5);
          pg.on("mousemove", (e: MouseEvent) => showTip(e,
            `<strong>${d.name}</strong><br>
            <span style="color:var(--color-text-secondary)">${d.countries.join(" ↔ ")}</span>`
          )).on("mouseleave", hideTip);
        });
      }
    });
  }

  useEffect(() => {
    const loadAndRender = () => {
      if ((window as any).d3 && (window as any).topojson) {
        renderMap();
        return;
      }
      const d3Script = document.createElement("script");
      d3Script.src = "https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js";
      d3Script.onload = () => {
        const topoScript = document.createElement("script");
        topoScript.src = "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
        topoScript.onload = () => renderMap();
        document.head.appendChild(topoScript);
      };
      document.head.appendChild(d3Script);
    };
    loadAndRender();
  }, []);

  useEffect(() => {
    if ((window as any).d3 && (window as any).topojson) renderMap();
  }, [view, verifiedOnly]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg ref={svgRef} viewBox="0 0 600 650" width="100%" style={{ display: "block" }} />
      <div
        ref={tooltipRef}
        style={{
          display: "none",
          position: "absolute",
          background: "var(--color-background-primary, white)",
          border: "0.5px solid #ccc",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 13,
          pointerEvents: "none",
          maxWidth: 200,
          zIndex: 10,
        }}
      />
    </div>
  );
}

export default function LabsPage() {
  const [sdgFilter, setSdgFilter] = useState<number[]>([]);
const [showLabModal, setShowLabModal] = useState(false);
  const [labTier, setLabTier] = useState<"starter" | "standard" | "strategic">("starter");
  const params = useParams();
  const tab = params.tab || "active";
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [mapView, setMapView] = useState<"projects" | "orgs" | "partnerships">("orgs");
  const [sectorFilter, setSectorFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");

  const organizations = [
    { name: "Kilimo Trust", sector: "Agritech", country: "Uganda", type: "NGO", sdgs: [2, 8], verified: true },
    { name: "GreenBase Africa", sector: "Climate", country: "Kenya", type: "NGO", sdgs: [13, 15], verified: false },
    { name: "HealthBridge NGO", sector: "Health", country: "Nigeria", type: "NGO", sdgs: [3, 10], verified: true },
    { name: "Sahel Adapt", sector: "Climate", country: "Senegal", type: "NGO", sdgs: [13, 1], verified: true },
    { name: "AgriLink Co-op", sector: "Agritech", country: "Ghana", type: "Co-op", sdgs: [2, 17], verified: false },
    { name: "Ubuntu Health Fund", sector: "Health", country: "South Africa", type: "Funder", sdgs: [3, 8], verified: true },
  ];

  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  function handleOrgClick(orgName: string) {
    if (!session) {
      navigateToAuth("/login", setLocation);
    } else {
      setLocation(`/org/${orgName.toLowerCase().replace(/\s+/g, "-")}`);
    }
  }

  const filteredOrgs = organizations.filter((org) => {
    return (
      org.name.toLowerCase().includes(search.toLowerCase()) &&
      (sectorFilter ? org.sector === sectorFilter : true) &&
      (countryFilter ? org.country === countryFilter : true) &&
      (typeFilter ? org.type === typeFilter : true) &&
      (sdgFilter.length > 0 ? sdgFilter.every((s) => org.sdgs.includes(s)) : true) &&
      (verifiedOnly ? org.verified === true : true)
    );
  });

  const countries = [...new Set(organizations.map(o => o.country))];
  const sectors = [...new Set(organizations.map(o => o.sector))];
  const types = [...new Set(organizations.map(o => o.type))];

  return (
    <>
    {showLabModal && <LabRequestModal onClose={() => setShowLabModal(false)} initialTier={labTier} />}
    {tab === "commission" && (
            <CommissionLabTab onOpen={(tier) => { setLabTier(tier); setShowLabModal(true); }} />
    )}

      {tab !== "commission" && (
        <div className="w-full max-w-7xl mx-auto content-padding py-12 md:py-18">
        <div className="mb-12">

      


          

{/*          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrgs.map((org, i) => (
              <Card key={i} className="hover:border-primary/30 transition-all cursor-pointer group" onClick={() => handleOrgClick(org.name)}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center font-bold text-lg text-muted-foreground">
                      {org.name.slice(0, 2).toUpperCase()}
                    </div>
                    {org.verified && (
                      <Badge className="bg-[#2D6A4F] text-white border-none flex items-center gap-1 text-xs font-semibold">
                        <VerifiedBadge />
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-bold text-lg mb-0.5 group-hover:text-primary transition-colors">{org.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                    <MapPin className="w-3 h-3" />{Array.isArray(org.country) ? org.country[0] : String(org.country ?? "").replace(/^\{|\}$/g, "").split(",")[0]?.replace(/"/g, "").trim()} · {org.sector} · {org.type}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">Providing essential infrastructure services and capacity building for local communities.</p>
                  <div className="flex flex-wrap gap-2">
                    {org.sdgs.map(n => (
                      <Badge key={n} className="text-xs font-medium bg-[#2D6A4F]/10 text-[#2D6A4F] border-[#2D6A4F]/20 border">SDG {n}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>*/}
        </div>
      {/*)} */}

      {tab === "impact-map" && (
        <div className="space-y-12 animate-in fade-in duration-500">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">African Impact Map</h1>
            <p className="text-xl text-muted-foreground">
              A geographic view of active collaborations, verified organizations, and ecosystem activity across Africa.
            </p>
          </div>
           <div className="flex flex-wrap gap-3">
            <Button variant={mapView === "orgs" ? "default" : "outline"} onClick={() => setMapView("orgs")}>Organizations</Button>
            <Button variant={mapView === "projects" ? "default" : "outline"} onClick={() => setMapView("projects")}>Projects</Button>
            <Button variant={mapView === "partnerships" ? "default" : "outline"} onClick={() => setMapView("partnerships")}>Partnerships</Button>
            <Button variant={verifiedOnly ? "default" : "outline"} onClick={() => setVerifiedOnly((p) => !p)}>Verified Only</Button>
          </div>
          {/*<div className="border rounded-xl bg-card overflow-hidden">
            <ImpactMap view={mapView} verifiedOnly={verifiedOnly} />
          </div>*/}
          <div className="py-12 text-center text-muted-foreground text-sm">
                Impact Map populates and displays here when available.
              </div>
        </div>
      )}
      </div>
//*    </div>*/}
  )}
</>
);
}