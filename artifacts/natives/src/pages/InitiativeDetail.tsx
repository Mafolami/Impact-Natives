import { useEffect, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  Lock,
  MapPin,
  Building2,
  Tag,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
interface Initiative {
  id: string;
  title: string;
  sectors: string[];
  locations: string[];
  budget: string | null;
  problem: string;
  outcome: string;
  tags: string[];
  partnerships: string[];
  esg_alignment: boolean;
  status: string;
  eois: number;
  submitter_name: string;
  submitter_org: string;
  detail_content: string | null;
  resource_link: string | null;
  created_at: string;
}
const PARTNERSHIP_TYPES = [
  "Co-implementer",
  "Funder",
  "Technical Partner",
  "Research Partner",
  "Government/Policy",
  "Private Sector",
  "Community Partner",
];
export default function InitiativeDetail() {
  const [, params] = useRoute("/initiatives/:id");
  const [, navigate] = useLocation();
  const { user, orgOwnerId } = useAuth();
  const [initiative, setInitiative] = useState<Initiative | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // EOI modal state
  const [eoiOpen, setEoiOpen] = useState(false);
  const [partnershipType, setPartnershipType] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [eoiError, setEoiError] = useState<string | null>(null);
  // Saved state
  const [saved, setSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const id = params?.id;
  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("initiative_requests")
        .select("*")
        .eq("id", id)
        .eq("status", "published")
        .single();
      if (error || !data) {
        setNotFound(true);
      } else {
        setInitiative(data as Initiative);
      }
      setLoading(false);
    }
    load();
  }, [id]);
  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from("saved_initiatives")
      .select("id")
      .eq("user_id", user.id)
      .eq("initiative_id", id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [user, id]);
  async function toggleSave() {
    if (!user || !id) return;
    setSavingToggle(true);
    if (saved) {
      await supabase
        .from("saved_initiatives")
        .delete()
        .eq("user_id", user.id)
        .eq("initiative_id", id);
      setSaved(false);
    } else {
      await supabase
        .from("saved_initiatives")
        .insert({ user_id: user.id, initiative_id: id });
      setSaved(true);
    }
    setSavingToggle(false);
  }
  async function submitEOI() {
    if (!user || !orgOwnerId || !id || !partnershipType) return;

    setSubmitting(true);
    setEoiError(null);
    // Org-level, not per-person: once anyone on the org expresses interest,
    // the unique constraint on (initiative_id, user_id) blocks a second
    // EOI from any other member of that same org -- matching the same fix
    // applied to MarketplaceDetail's submitEOI.
    const { error } = await supabase.from("expressions_of_interest").insert({
      initiative_id: id,
      user_id: orgOwnerId,
      partnership_type: partnershipType,
      message: message || null,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        setEoiError("Your organisation has already expressed interest in this initiative.");
      } else {
        setEoiError(error.message);
      }
    } else {
      setSubmitted(true);
      // bump local eoi count
      if (initiative) {
        setInitiative({ ...initiative, eois: initiative.eois + 1 });
      }
    }
  }
  function handleExpressInterest() {
    if (!user) {
      sessionStorage.setItem("redirectAfterAuth", `/initiatives/${id}`);
      navigate(`/signin?redirect=/initiatives/${id}`);
      return;
    }
    setEoiOpen(true);
  }
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#2D6A4F] animate-spin" />
      </div>
    );
  }
  if (notFound || !initiative) {
    return (
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center text-center px-4">
        <div>
          <p className="text-gray-500 mb-4">Initiative not found or not yet published.</p>
          <Link href="/platform/impact-marketplace">
            <Button variant="outline">Back to Marketplace</Button>
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#F9F7F4]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back nav */}
        <Link
          href="/platform/impact-marketplace"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-3">
                {initiative.sectors.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs bg-[#2D6A4F]/10 text-[#2D6A4F] border-0">
                    {s}
                  </Badge>
                ))}
                {initiative.esg_alignment && (
                  <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 border-0">
                    ESG Aligned
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">{initiative.title}</h1>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  {initiative.submitter_org}
                </span>
                {initiative.locations.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {initiative.locations.join(", ")}
                  </span>
                )}
                {initiative.budget && (
                  <span className="font-medium text-gray-700">{initiative.budget}</span>
                )}
              </div>
            </div>
            {/* Actions */}
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                onClick={handleExpressInterest}
                className="bg-[#2D6A4F] hover:bg-[#245c43] text-white whitespace-nowrap"
              >
                Express Interest
              </Button>
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSave}
                  disabled={savingToggle}
                  className={saved ? "border-[#2D6A4F] text-[#2D6A4F]" : ""}
                >
                  {saved ? "Saved" : "Save"}
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
            <span>{initiative.eois} expression{initiative.eois !== 1 ? "s" : ""} of interest</span>
            <span>·</span>
            <span>{new Date(initiative.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>
        {/* Problem & Outcome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Problem</h3>
            <p className="text-gray-700 text-sm leading-relaxed">{initiative.problem}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Desired Outcome</h3>
            <p className="text-gray-700 text-sm leading-relaxed">{initiative.outcome}</p>
          </div>
        </div>
        {/* Partnership needs */}
        {initiative.partnerships.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Partnership Needs</h3>
            <div className="flex flex-wrap gap-2">
              {initiative.partnerships.map((p) => (
                <span key={p} className="text-sm bg-gray-50 border border-gray-200 text-gray-700 rounded-full px-3 py-1">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
        {/* Tags */}
        {initiative.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Tag className="w-3.5 h-3.5 text-gray-400" />
            {initiative.tags.map((t) => (
              <span key={t} className="text-xs text-gray-500">#{t}</span>
            ))}
          </div>
        )}
        {/* Gated: detail content + resource link */}
        {user ? (
          <>
            {initiative.detail_content && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Initiative Detail</h3>
                <div
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: initiative.detail_content }}
                />
              </div>
            )}
            {initiative.resource_link && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
                <a
                  href={initiative.resource_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[#2D6A4F] hover:underline font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  View resource / external link
                </a>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-1">Full details are for members only</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Sign in to see the full initiative brief, attachments, and resource links. It's free.
                </p>
                <div className="flex gap-3">
                  <Link href={`/signin?redirect=/initiatives/${id}`}>
                    <Button className="bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm h-9">
                      Sign in
                    </Button>
                  </Link>
                  <Link href={`/signup?redirect=/initiatives/${id}`}>
                    <Button variant="outline" className="text-sm h-9">
                      Create account
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* EOI Modal */}
      <Dialog open={eoiOpen} onOpenChange={(open) => { if (!submitting) setEoiOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Express Interest</DialogTitle>
          </DialogHeader>
          {submitted ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 text-[#2D6A4F] mx-auto mb-3" />
              <p className="font-medium text-gray-900">Expression submitted</p>
              <p className="text-sm text-gray-500 mt-1">
                The initiative lead will be notified. You can track this in your dashboard.
              </p>
              <Button
                onClick={() => setEoiOpen(false)}
                className="mt-5 bg-[#2D6A4F] hover:bg-[#245c43] text-white"
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-5 pt-2">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Partnership type <span className="text-red-500">*</span></p>
                <div className="flex flex-wrap gap-2">
                  {PARTNERSHIP_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPartnershipType(t)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        partnershipType === t
                          ? "bg-[#2D6A4F] text-white border-[#2D6A4F]"
                          : "border-gray-200 text-gray-600 hover:border-[#2D6A4F]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Message <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Briefly describe how you could contribute or what you'd like to discuss..."
                  rows={4}
                  className="text-sm border-gray-200 resize-none"
                />
              </div>
              {eoiError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{eoiError}</p>
              )}
              <Button
                onClick={submitEOI}
                disabled={!partnershipType || submitting}
                className="w-full bg-[#2D6A4F] hover:bg-[#245c43] text-white"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Expression of Interest
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}