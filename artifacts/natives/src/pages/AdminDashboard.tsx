import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const [cta, setCta] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: ctaData } = await supabase
        .from("cta_clicks")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: eventData } = await supabase
        .from("form_events")
        .select("*")
        .order("created_at", { ascending: false });

      setCta(ctaData || []);
      setEvents(eventData || []);
    }

    load();
  }, []);

  return (
    <div className="p-8 space-y-10">
      <h1 className="text-3xl font-bold">Natives Dashboard</h1>
  
      {/* CTA SUMMARY */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Total CTA Clicks</h2>
          <p className="text-2xl">{cta.length}</p>
        </div>
  
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Form Opens</h2>
          <p className="text-2xl">
            {events.filter(e => e.event_name === "form_opened").length}
          </p>
        </div>
  
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Submissions</h2>
          <p className="text-2xl">
            {events.filter(e => e.event_name === "form_submitted").length}
          </p>
        </div>
      </div>

          {/* FUNNEL BREAKDOWN */}
    <div className="border rounded p-6">
      <h2 className="text-xl font-bold mb-4">Form Funnel</h2>

      {[...Array(9)].map((_, i) => {
        const stepEvents = events.filter(
          e => e.event_name === "step_completed" && e.step === i
        ).length;

        return (
          <div key={i} className="flex justify-between py-1">
            <span>Step {i + 1}</span>
            <span>{stepEvents}</span>
          </div>
        );
      })}
    </div>

        {/* RECENT ACTIVITY */}
        <div className="border rounded p-6">
      <h2 className="text-xl font-bold mb-4">Recent Events</h2>

      <div className="space-y-2 text-sm">
        {events.slice(0, 20).map((e, i) => (
          <div key={i} className="flex justify-between">
            <span>{e.event_name}</span>
            <span className="text-muted-foreground">{e.step ?? "-"}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);
}