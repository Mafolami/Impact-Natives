import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { canDisplayImpactScore } from "@/lib/impactScore";

interface ToggleRow {
  show_impact_score: boolean;
  subscription_tier: string | null;
  user_id: string;
}

// Public/Private switch for the Impact Score. It reads and writes the same
// column as the Profile page (organizations.show_impact_score), so the two
// places always agree. Same rules as Profile: only the organisation owner on
// Plus or above can change it; anyone else gets a short note on click.
export default function ImpactScoreToggle({ orgId }: { orgId: string }) {
  const [row, setRow] = useState<ToggleRow | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteVisible, setNoteVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("organizations").select("show_impact_score, subscription_tier, user_id").eq("id", orgId).single(),
      supabase.auth.getUser(),
    ]).then(([orgRes, authRes]) => {
      if (cancelled || orgRes.error || !orgRes.data) return;
      const r = orgRes.data as ToggleRow;
      setRow(r);
      setIsOwner(authRes.data?.user?.id === r.user_id);
    }).catch(() => { /* toggle simply stays hidden */ });
    return () => { cancelled = true; };
  }, [orgId]);

  if (!row) return null;

  const isEligibleTier = canDisplayImpactScore(row.subscription_tier);

  async function handleClick() {
    if (!row) return;
    if (!(isEligibleTier && isOwner)) {
      setNoteVisible((v) => !v);
      return;
    }
    const next = !row.show_impact_score;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("organizations").update({ show_impact_score: next }).eq("id", orgId);
    setSaving(false);
    if (err) {
      setError("Couldn't update. Try again.");
      return;
    }
    setRow((prev) => (prev ? { ...prev, show_impact_score: next } : prev));
  }

  const isPublic = isEligibleTier && row.show_impact_score;
  const noteText = !isEligibleTier
    ? isOwner
      ? "Upgrade to Plus to show your Impact Score on your public profile and in Natives."
      : "Ask your organisation's owner to upgrade to Plus to make this public."
    : "Only the organisation owner can change this.";

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={handleClick} disabled={saving}
        aria-label="Impact Score visibility"
        className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors disabled:opacity-50 ${
          isPublic
            ? "border-[#2D6A4F] bg-[#2D6A4F] text-white hover:bg-[#245c43]"
            : "border-border text-black dark:text-white hover:border-foreground/30"
        }`}>
        {saving
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : row.show_impact_score ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        Impact Score: {row.show_impact_score ? "Public" : "Private"}
      </button>
      {noteVisible && <p className="text-xs text-[#C45C26] max-w-[260px] text-right">{noteText}</p>}
      {error && <p className="text-xs text-[#C45C26] max-w-[260px] text-right">{error}</p>}
    </div>
  );
}
