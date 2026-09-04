import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  BookMarked,
  Handshake,
  FileText,
  ArrowRight,
  MapPin,
  Building2,
  Bookmark,
  Trash2,
} from "lucide-react";

interface InitiativeRow {
  id: string;
  title: string;
  sectors: string[];
  locations: string[];
  status: string;
  eois: number;
  submitter_org: string;
  created_at: string;
}

interface EOIRow {
  id: string;
  partnership_type: string;
  message: string | null;
  created_at: string;
  initiative: Pick<InitiativeRow, "id" | "title" | "submitter_org"> | null;
}

const TABS = ["My Initiatives", "Saved", "Expressions of Interest"] as const;
type Tab = (typeof TABS)[number];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending review", color: "bg-amber-50 text-amber-700" },
  published: { label: "Listed", color: "bg-green-50 text-green-700" },
  rejected: { label: "Not approved", color: "bg-red-50 text-red-600" },
};

export default function Dashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [tab, setTab] = useState<Tab>("My Initiatives");

  const [myInitiatives, setMyInitiatives] = useState<InitiativeRow[]>([]);
  const [saved, setSaved] = useState<InitiativeRow[]>([]);
  const [eois, setEOIs] = useState<EOIRow[]>([]);

  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem("redirectAfterAuth", "/dashboard");
      navigate("/signin?redirect=/dashboard");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoadingData(true);
      const [myRes, savedRes, eoisRes] = await Promise.all([
        supabase
          .from("initiative_requests")
          .select("id,title,sectors,locations,status,eois,submitter_org,created_at")
          .or(`user_id.eq.${user!.id},submitter_email.eq.${user!.email}`)
          .order("created_at", { ascending: false }),
        supabase
          .from("saved_initiatives")
          .select("initiative_id, initiative_requests(id,title,sectors,locations,status,eois,submitter_org,created_at)")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("expressions_of_interest")
          .select("id,partnership_type,message,created_at, initiative:initiative_id(id,title,submitter_org)")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false }),
      ]);

      if (myRes.data) setMyInitiatives(myRes.data as InitiativeRow[]);
      if (savedRes.data) {
        const rows = savedRes.data
          .map((r: any) => r.initiative_requests)
          .filter(Boolean) as InitiativeRow[];
        setSaved(rows);
      }
      if (eoisRes.data) setEOIs(eoisRes.data.map((row: any) => ({
        id: row.id,
        partnership_type: row.partnership_type,
        message: row.message,
        created_at: row.created_at,
        initiative: Array.isArray(row.initiative) ? row.initiative[0] ?? null : row.initiative,
      })) as EOIRow[]);
      setLoadingData(false);
    }
    load();
  }, [user]);

  async function unsaveInitiative(initiativeId: string) {
    if (!user) return;
    await supabase
      .from("saved_initiatives")
      .delete()
      .eq("user_id", user.id)
      .eq("initiative_id", initiativeId);
    setSaved((prev) => prev.filter((i) => i.id !== initiativeId));
  }

  if (authLoading || !user) {
    return (
      <div className="light min-h-screen bg-[#F9F7F4] flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  const displayName = profile?.full_name || user.email?.split("@")[0] || "there";

  return (
    <div className="light min-h-screen bg-[#F9F7F4]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[15px] text-gray-500">Welcome back</p>
          <h1 className="text-[25px] font-semibold text-gray-900">
            {displayName}
          </h1>
          {profile?.org_name && (
            <p className="text-[15px] text-gray-500 mt-0.5">{profile.org_name}</p>
          )}
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <NavCard
            href="/platform/impact-marketplace"
            icon={<FileText className="w-4 h-4" />}
            label="Explore Marketplace"
          />
          <NavCard
            href="/platform/partnership-os"
            icon={<Handshake className="w-4 h-4" />}
            label="Get Matched"
          />
          <NavCard
            href="/labs/commission"
            icon={<BookMarked className="w-4 h-4" />}
            label="Commission a Lab"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-[15px] px-4 py-2 rounded-lg font-medium transition-colors ${
                tab === t
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
              {t === "My Initiatives" && myInitiatives.length > 0 && (
                <span className="ml-1.5 text-[13px] text-gray-400">({myInitiatives.length})</span>
              )}
              {t === "Saved" && saved.length > 0 && (
                <span className="ml-1.5 text-[13px] text-gray-400">({saved.length})</span>
              )}
              {t === "Expressions of Interest" && eois.length > 0 && (
                <span className="ml-1.5 text-[13px] text-gray-400">({eois.length})</span>
              )}
            </button>
          ))}
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
          </div>
        ) : (
          <>
            {tab === "My Initiatives" && (
              <div>
                {myInitiatives.length === 0 ? (
                  <EmptyState
                    message="You haven't submitted any initiatives yet."
                    cta="Submit an initiative"
                    href="/platform/impact-marketplace"
                  />
                ) : (
                  <div className="space-y-3">
                    {myInitiatives.map((init) => (
                      <InitiativeCard key={init.id} initiative={init} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "Saved" && (
              <div>
                {saved.length === 0 ? (
                  <EmptyState
                    message="No saved initiatives yet. Bookmark ones that interest you."
                    cta="Browse marketplace"
                    href="/platform/impact-marketplace"
                  />
                ) : (
                  <div className="space-y-3">
                    {saved.map((init) => (
                      <InitiativeCard
                        key={init.id}
                        initiative={init}
                        actions={
                          <button
                            onClick={() => unsaveInitiative(init.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Remove from saved"
                          >
                            <Bookmark className="w-4 h-4 fill-current" />
                          </button>
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "Expressions of Interest" && (
              <div>
                {eois.length === 0 ? (
                  <EmptyState
                    message="You haven't expressed interest in any initiatives yet."
                    cta="Browse marketplace"
                    href="/platform/impact-marketplace"
                  />
                ) : (
                  <div className="space-y-3">
                    {eois.map((eoi) => (
                      <div key={eoi.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        {eoi.initiative ? (
                          <Link href={`/initiatives/${eoi.initiative.id}`}>
                            <h3 className="font-medium text-gray-900 hover:text-[#2D6A4F] transition-colors cursor-pointer">
                              {eoi.initiative.title}
                            </h3>
                          </Link>
                        ) : (
                          <p className="font-medium text-gray-400 italic text-[15px]">Initiative unavailable</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[13px] bg-[#2D6A4F]/10 text-[#2D6A4F] px-2 py-0.5 rounded-full font-medium">
                            {eoi.partnership_type}
                          </span>
                          <span className="text-[13px] text-gray-400">
                            {new Date(eoi.created_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        {eoi.message && (
                          <p className="text-[15px] text-gray-500 mt-2 leading-relaxed">{eoi.message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InitiativeCard({
  initiative,
  actions,
}: {
  initiative: InitiativeRow;
  actions?: React.ReactNode;
}) {
  const status = STATUS_MAP[initiative.status] || { label: initiative.status, color: "bg-gray-100 text-gray-600" };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-[13px] px-2 py-0.5 rounded-full font-medium ${status.color}`}>
              {status.label}
            </span>
            {initiative.sectors.slice(0, 2).map((s) => (
              <Badge key={s} variant="secondary" className="text-[13px] bg-gray-100 text-gray-600 border-0">
                {s}
              </Badge>
            ))}
          </div>
          <Link href={`/initiatives/${initiative.id}`}>
            <h3 className="font-medium text-gray-900 hover:text-[#2D6A4F] transition-colors cursor-pointer truncate">
              {initiative.title}
            </h3>
          </Link>
          <div className="flex items-center gap-3 mt-1.5 text-[13px] text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {initiative.submitter_org}
            </span>
            {initiative.locations.length > 0 && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {initiative.locations.slice(0, 2).join(", ")}
              </span>
            )}
            <span>{initiative.eois} EOI{initiative.eois !== 1 ? "s" : ""}</span>
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

function NavCard({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between hover:border-[#2D6A4F]/30 hover:shadow-md transition-all cursor-pointer group">
        <div className="flex items-center gap-3 text-[15px] font-medium text-gray-700">
          <span className="text-[#2D6A4F]">{icon}</span>
          {label}
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#2D6A4F] transition-colors" />
      </div>
    </Link>
  );
}

function EmptyState({
  message,
  cta,
  href,
}: {
  message: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
      <p className="text-gray-500 text-[15px] mb-4">{message}</p>
      <Link href={href}>
        <Button variant="outline" size="sm">
          {cta}
        </Button>
      </Link>
    </div>
  );
}