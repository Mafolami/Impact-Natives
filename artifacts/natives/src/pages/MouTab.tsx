import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Loader2, FileText, PenLine, Upload, Plus, X, ArrowRight } from "lucide-react";
import CreateMouModal from "./CreateMouModal";
import MouDocumentDetail from "./MouDocumentDetail";

interface MouDocRow {
  id: string;
  org_a_id: string;
  org_b_id: string;
  initiative_id: string | null;
  source_type: string;
  status: string;
  updated_at: string;
}

interface OrgLite {
  id: string;
  organisation_name: string;
  user_id: string;
}

interface PartnerOption {
  orgId: string;
  userId: string;
  name: string;
  initiativeId: string | null;
  initiativeTitle: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#C45C26" },
  sent: { label: "Sent — awaiting signatures", color: "#C45C26" },
  signed_by_org_a: { label: "Partly signed", color: "#2D6A4F" },
  signed_by_org_b: { label: "Partly signed", color: "#2D6A4F" },
  pending_org_a_final_review: { label: "Awaiting final review", color: "#C45C26" },
  fully_executed: { label: "Fully executed", color: "#2D6A4F" },
};
const SOURCE_META: Record<string, { label: string; icon: typeof FileText }> = {
  template: { label: "Template", icon: FileText },
  custom: { label: "Custom", icon: PenLine },
  uploaded_pdf: { label: "Uploaded", icon: Upload },
};

export default function MouTab() {
  const { user } = useAuth();
  const userId = user?.id;
  const [location] = useLocation();
  const [loading, setLoading] = useState(true);
  const [myOrgId, setMyOrgId] = useState<string | null>(null);
  const [docs, setDocs] = useState<MouDocRow[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, OrgLite>>({});
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [initiativeTitleMap, setInitiativeTitleMap] = useState<Record<string, string>>({});

  const [showPicker, setShowPicker] = useState(false);
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [mouTarget, setMouTarget] = useState<{
    partnerUserId?: string; partnerOrgId?: string; partnerName: string; initiativeId: string | null; initiativeTitle: string;
  } | null>(null);

  useEffect(() => { if (userId) load(); }, [userId]);

  // Arriving from another tab's "MoU" button — e.g. ?newForOrgId=... or ?newForUserId=...
  useEffect(() => {
    const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
    const newForOrgId = params.get("newForOrgId");
    const newForUserId = params.get("newForUserId");
    if (newForOrgId || newForUserId) {
      setMouTarget({
        partnerOrgId: newForOrgId ?? undefined,
        partnerUserId: newForUserId ?? undefined,
        partnerName: params.get("partnerName") ?? "Partner",
        initiativeId: params.get("initiativeId"),
        initiativeTitle: params.get("initiativeTitle") ?? "",
      });
    }
  }, [location]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data: myOrg } = await supabase.from("organizations").select("id").eq("user_id", userId).maybeSingle();
    if (!myOrg) { setLoading(false); return; }
    setMyOrgId(myOrg.id);

    const { data: docRows } = await supabase
      .from("mou_documents")
      .select("id, org_a_id, org_b_id, initiative_id, source_type, status, updated_at")
      .or(`org_a_id.eq.${myOrg.id},org_b_id.eq.${myOrg.id}`)
      .order("updated_at", { ascending: false });

      const orgIds = [...new Set((docRows ?? []).flatMap((d) => [d.org_a_id, d.org_b_id]))];
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase.from("organizations").select("id, organisation_name, user_id").in("id", orgIds);
        const map: Record<string, OrgLite> = {};
        (orgs ?? []).forEach((o: any) => { map[o.id] = o; });
        setOrgMap(map);
      }
      const initIds = [...new Set((docRows ?? []).map((d) => d.initiative_id).filter((x): x is string => !!x))];
      if (initIds.length > 0) {
        const { data: inits } = await supabase.from("initiative_requests").select("id, title").in("id", initIds);
        const titleMap: Record<string, string> = {};
        (inits ?? []).forEach((i: any) => { titleMap[i.id] = i.title; });
        setInitiativeTitleMap(titleMap);
      }
      setDocs(docRows ?? []);
      setLoading(false);
  }

  async function openPicker() {
    setShowPicker(true);
    setLoadingOptions(true);
    if (!myOrgId || !userId) { setLoadingOptions(false); return; }

    // Combines both partnership models on the platform — initiative-based
    // confirmed EOI partners, and direct org-to-org formed connections —
    // into one picker, rather than requiring the person to already be on
    // one of the three source pages to start an MoU.
    const [{ data: myInits }, { data: inboundFormed }, { data: outboundFormed }] = await Promise.all([
      supabase.from("initiative_requests").select("id, title, confirmed_partners").eq("user_id", userId).not("confirmed_partners", "is", null),
      supabase.from("partnership_connections").select("id, sender_org_id, partnership_title").eq("receiver_org_id", myOrgId).eq("status", "formed"),
      supabase.from("partnership_connections").select("id, receiver_org_id, partnership_title").eq("sender_org_id", myOrgId).eq("status", "formed"),
    ]);

    const options: PartnerOption[] = [];
    const seenOrgIds = new Set<string>();

    for (const ini of myInits ?? []) {
      const confirmed = ((ini.confirmed_partners as any[]) ?? []).filter((p) => (p.status ?? "confirmed") === "confirmed");
      for (const p of confirmed) {
        options.push({ orgId: "", userId: p.user_id, name: p.name, initiativeId: ini.id, initiativeTitle: ini.title });
      }
    }

    const connOrgIds = [
      ...(inboundFormed ?? []).map((c: any) => c.sender_org_id),
      ...(outboundFormed ?? []).map((c: any) => c.receiver_org_id),
    ];
    if (connOrgIds.length > 0) {
      const { data: connOrgs } = await supabase.from("organizations").select("id, organisation_name, user_id").in("id", connOrgIds);
      const connOrgMap = new Map((connOrgs ?? []).map((o: any) => [o.id, o]));
      for (const c of inboundFormed ?? []) {
        const org = connOrgMap.get(c.sender_org_id);
        if (org && !seenOrgIds.has(org.id)) {
          seenOrgIds.add(org.id);
          options.push({ orgId: org.id, userId: org.user_id, name: org.organisation_name, initiativeId: null, initiativeTitle: c.partnership_title ?? "" });
        }
      }
      for (const c of outboundFormed ?? []) {
        const org = connOrgMap.get(c.receiver_org_id);
        if (org && !seenOrgIds.has(org.id)) {
          seenOrgIds.add(org.id);
          options.push({ orgId: org.id, userId: org.user_id, name: org.organisation_name, initiativeId: null, initiativeTitle: c.partnership_title ?? "" });
        }
      }
    }

    setPartnerOptions(options);
    setLoadingOptions(false);
  }

  function otherOrg(doc: MouDocRow): OrgLite | undefined {
    const otherId = doc.org_a_id === myOrgId ? doc.org_b_id : doc.org_a_id;
    return orgMap[otherId];
  }

  if (loading || !userId) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-black dark:text-white">MoUs</h1>
        <p className="text-sm text-black dark:text-white mt-0.5">
          Memorandums of understanding across your confirmed partnerships and initiatives.
        </p>
      </div>
      <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-lg font-bold text-black dark:text-white leading-none">{docs.length}</p>
            <p className="text-xs text-black dark:text-white mt-1">Total</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-lg font-bold text-black dark:text-white leading-none">
              {docs.filter((d) => d.status !== "draft" && d.status !== "fully_executed").length}
            </p>
            <p className="text-xs text-black dark:text-white mt-1">In progress</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-lg font-bold text-black dark:text-white leading-none">
              {docs.filter((d) => d.status === "fully_executed").length}
            </p>
            <p className="text-xs text-black dark:text-white mt-1">Fully executed</p>
          </div>
        </div>
        <button type="button" onClick={openPicker}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white font-medium transition-colors shrink-0">
          <Plus className="w-4 h-4" /> New MoU
        </button>
      </div>
      {docs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white dark:bg-card p-12 text-center">
          <FileText className="w-8 h-8 text-black dark:text-white mx-auto mb-4" />
          <p className="text-base font-medium text-black dark:text-white mb-2">No MoUs yet.</p>
          <p className="text-sm text-black dark:text-white max-w-sm mx-auto">
            Start one from a confirmed partnership or initiative, or create one here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {docs.map((d) => {
            const meta = STATUS_META[d.status] ?? { label: d.status, color: "#C45C26" };
            const sourceMeta = SOURCE_META[d.source_type] ?? { label: d.source_type, icon: FileText };
            const SourceIcon = sourceMeta.icon;
            const title = d.initiative_id ? initiativeTitleMap[d.initiative_id] : null;
            return (
              <button key={d.id} type="button" onClick={() => setOpenDocId(d.id)}
                className="text-left rounded-2xl border border-border bg-white dark:bg-card p-5 hover:border-[#2D6A4F]/50 transition-colors flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 p-2 rounded-lg bg-[#2D6A4F]/10 shrink-0">
                      <SourceIcon className="w-4 h-4 text-[#2D6A4F]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-black dark:text-white truncate">
                        {otherOrg(d)?.organisation_name ?? "Unknown organisation"}
                      </p>
                      <p className="text-sm text-black dark:text-white mt-0.5 truncate">
                        {title || sourceMeta.label}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-black/40 dark:text-white/40 shrink-0 mt-1" />
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-black dark:text-white">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                    {meta.label}
                  </span>
                  <span className="text-xs text-black dark:text-white whitespace-nowrap">
                    {new Date(d.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowPicker(false)}>
          <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-md shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-black dark:text-white">Choose a partner</h3>
              <button type="button" onClick={() => setShowPicker(false)} className="text-black dark:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto space-y-2">
              {loadingOptions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[#2D6A4F] animate-spin" />
                </div>
              ) : partnerOptions.length === 0 ? (
                <p className="text-sm text-black dark:text-white">
                  No confirmed partners yet. Confirm a partnership first, then come back here.
                </p>
              ) : (
                partnerOptions.map((opt, i) => (
                  <button key={i} type="button"
                    onClick={() => {
                      setMouTarget({
                        partnerUserId: opt.userId, partnerOrgId: opt.orgId || undefined,
                        partnerName: opt.name, initiativeId: opt.initiativeId, initiativeTitle: opt.initiativeTitle,
                      });
                      setShowPicker(false);
                    }}
                    className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-[#2D6A4F]/50 transition-colors">
                    <p className="text-base font-medium text-black dark:text-white">{opt.name}</p>
                    {opt.initiativeTitle && <p className="text-sm text-black dark:text-white mt-0.5">{opt.initiativeTitle}</p>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {mouTarget && (
        <CreateMouModal
          myUserId={userId}
          partnerUserId={mouTarget.partnerUserId}
          partnerOrgId={mouTarget.partnerOrgId}
          partnerName={mouTarget.partnerName}
          initiativeId={mouTarget.initiativeId}
          initiativeTitle={mouTarget.initiativeTitle}
          onClose={() => { setMouTarget(null); load(); }}
          onOpenDocument={(documentId) => {
            // Goes straight into the new (or pre-existing) draft instead of
            // dropping back to the list -- the list still gets refreshed in
            // the background so it's accurate whenever they do return to it.
            setMouTarget(null);
            setOpenDocId(documentId);
            load();
          }}
        />
      )}
      {openDocId && (
        <MouDocumentDetail documentId={openDocId} myUserId={userId} onClose={() => { setOpenDocId(null); load(); }} />
      )}
    </div>
    </div>
  );
}