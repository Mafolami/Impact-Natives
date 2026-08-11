import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Loader2, Upload, Download } from "lucide-react";
import { MouMilestone, MilestoneEvidenceRow, WorkflowComment, OrgRef, actorLabel, MILESTONE_STATUS_LABEL, MILESTONE_STATUS_PILL_STYLES } from "@/lib/milestones";

export default function MilestoneDetailModal({ milestone, orgA, orgB, myUserId, onClose, onChanged }: {
  milestone: MouMilestone;
  orgA: OrgRef | null;
  orgB: OrgRef | null;
  myUserId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState<MouMilestone>(milestone);
  const [evidence, setEvidence] = useState<MilestoneEvidenceRow[]>([]);
  const [comments, setComments] = useState<WorkflowComment[]>([]);
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  useEffect(() => { loadDetail(); }, [milestone.id]);

  async function loadDetail() {
    setLoading(true);
    const [{ data: evidenceRows }, { data: commentRows }] = await Promise.all([
      supabase.from("milestone_evidence").select("id,submitted_by,file_path,note,created_at").eq("milestone_id", milestone.id).order("created_at", { ascending: true }),
      supabase.from("workflow_comments").select("id,author_id,body,created_at").eq("target_table", "mou_milestones").eq("target_id", milestone.id).order("created_at", { ascending: true }),
    ]);
    setEvidence((evidenceRows as MilestoneEvidenceRow[]) ?? []);
    setComments((commentRows as WorkflowComment[]) ?? []);
    const withFiles = ((evidenceRows as MilestoneEvidenceRow[]) ?? []).filter((e) => e.file_path);
    const urlEntries = await Promise.all(withFiles.map(async (e) => {
      const { data } = await supabase.storage.from("mou-documents").createSignedUrl(e.file_path!, 3600);
      return [e.id, data?.signedUrl ?? ""] as const;
    }));
    setEvidenceUrls(Object.fromEntries(urlEntries));
    setLoading(false);
  }

  async function submitEvidence(file: File | null) {
    setUploadingEvidence(true);
    let filePath: string | null = null;
    if (file) {
      filePath = `milestone-evidence/${current.mou_document_id}/${current.id}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("mou-documents").upload(filePath, file);
      if (uploadError) { setUploadingEvidence(false); return; }
    }
    if (!filePath && !evidenceNote.trim()) { setUploadingEvidence(false); return; }
    const { error } = await supabase.from("milestone_evidence").insert({
      milestone_id: current.id, submitted_by: myUserId, file_path: filePath, note: evidenceNote.trim() || null,
    });
    setUploadingEvidence(false);
    if (error) return;
    setEvidenceNote("");
    const { data: fresh } = await supabase
      .from("mou_milestones")
      .select("id,mou_document_id,title,description,target_date,linked_amount,linked_currency,payer_org_id,recipient_org_id,status,created_at")
      .eq("id", current.id).maybeSingle();
    if (fresh) setCurrent(fresh as MouMilestone);
    await loadDetail();
    onChanged();
  }

  async function postComment() {
    if (!newComment.trim()) return;
    setPostingComment(true);
    const myOrgId = myUserId === orgA?.user_id ? orgA?.id : orgB?.id;
    const { error } = await supabase.from("workflow_comments").insert({
      org_id: myOrgId, target_table: "mou_milestones", target_id: current.id, author_id: myUserId, body: newComment.trim(),
    });
    setPostingComment(false);
    if (error) return;
    setNewComment("");
    await loadDetail();
  }

  // The database trigger is the real authority check -- these mirror it
  // client-side only so the right buttons show up, not to duplicate the rule.
  const isPayerOwner =
    (current.payer_org_id === orgA?.id && myUserId === orgA?.user_id) ||
    (current.payer_org_id === orgB?.id && myUserId === orgB?.user_id);
  const isDocParticipant = myUserId === orgA?.user_id || myUserId === orgB?.user_id;
  const canVerify =
    current.status !== "verified" && current.status !== "disbursed" &&
    (current.payer_org_id ? isPayerOwner : isDocParticipant);
  const canDisburse = current.status === "verified" && current.payer_org_id !== null && isPayerOwner;

  async function transitionTo(status: "verified" | "disbursed") {
    setTransitioning(true);
    setTransitionError(null);
    const { data, error } = await supabase.from("mou_milestones").update({ status }).eq("id", current.id).select().maybeSingle();
    setTransitioning(false);
    if (error || !data) {
      setTransitionError(
        error?.message.includes("permission") || error?.code === "42501"
          ? "You don't have permission to do that."
          : (error?.message ?? "That didn't go through -- try again.")
      );
      return;
    }
    setCurrent(data as MouMilestone);
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-black dark:text-white">{current.title}</p>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${MILESTONE_STATUS_PILL_STYLES[MILESTONE_STATUS_LABEL[current.status].tone]}`}>
                {MILESTONE_STATUS_LABEL[current.status].label}
              </span>
            </div>
            {current.target_date && (
              <p className="text-xs text-black dark:text-white mt-0.5">
                {new Date(current.target_date).toLocaleDateString("en-GB")}
                {current.linked_amount !== null && ` · ${current.linked_currency} ${current.linked_amount.toLocaleString()}`}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 p-1">
            <X className="w-4 h-4 text-black dark:text-white" />
          </button>
        </div>

        {current.description && (
          <p className="text-sm text-black dark:text-white">{current.description}</p>
        )}

        {(canVerify || canDisburse) && (
          <div className="space-y-2">
            {transitionError && (
              <p className="text-sm text-amber-600 dark:text-amber-500">{transitionError}</p>
            )}
            {canVerify && (
              <button type="button" onClick={() => transitionTo("verified")} disabled={transitioning}
                className="w-full h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-60 transition-colors">
                {transitioning ? "Verifying..." : "Mark as verified"}
              </button>
            )}
            {canDisburse && (
              <button type="button" onClick={() => transitionTo("disbursed")} disabled={transitioning}
                className="w-full h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-60 transition-colors">
                {transitioning ? "Releasing..." : "Release disbursement"}
              </button>
            )}
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-semibold text-black dark:text-white">Evidence</p>

          {loading && <p className="text-sm text-black dark:text-white">Loading...</p>}
          {!loading && evidence.length === 0 && (
            <p className="text-sm text-black dark:text-white">Nothing submitted yet.</p>
          )}

          {evidence.map((e) => (
            <div key={e.id} className="rounded-lg border border-border px-3 py-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-black dark:text-white">{actorLabel(e.submitted_by, myUserId, orgA, orgB)}</p>
                <p className="text-xs text-black dark:text-white">{new Date(e.created_at).toLocaleDateString("en-GB")}</p>
              </div>
              {e.note && <p className="text-sm text-black dark:text-white">{e.note}</p>}
              {e.file_path && evidenceUrls[e.id] && (
                <a href={evidenceUrls[e.id]} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[#2D6A4F] hover:underline inline-flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> View file
                </a>
              )}
            </div>
          ))}

          <textarea placeholder="Add a note (optional if attaching a file)" value={evidenceNote}
            onChange={(e) => setEvidenceNote(e.target.value)} rows={2}
            className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />
          <div className="flex gap-2">
            <label className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full border border-dashed border-border text-sm text-black dark:text-white hover:border-[#2D6A4F]/40 transition-colors cursor-pointer">
              {uploadingEvidence ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingEvidence ? "Uploading..." : "Attach file"}
              <input type="file" className="hidden" disabled={uploadingEvidence}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) submitEvidence(f); }} />
            </label>
            <button type="button" onClick={() => submitEvidence(null)}
              disabled={uploadingEvidence || !evidenceNote.trim()}
              className="h-10 px-4 rounded-full border border-border text-sm text-black dark:text-white disabled:opacity-60 transition-colors">
              Add note only
            </button>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-semibold text-black dark:text-white">Comments</p>

          {!loading && comments.length === 0 && (
            <p className="text-sm text-black dark:text-white">No comments yet.</p>
          )}

          {comments.map((c) => (
            <div key={c.id} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-black dark:text-white">{actorLabel(c.author_id, myUserId, orgA, orgB)}</p>
                <p className="text-xs text-black dark:text-white">{new Date(c.created_at).toLocaleDateString("en-GB")}</p>
              </div>
              <p className="text-sm text-black dark:text-white">{c.body}</p>
            </div>
          ))}

          <div className="flex gap-2">
            <input type="text" placeholder="Write a comment" value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
              className="flex-1 h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
            <button type="button" onClick={postComment} disabled={postingComment || !newComment.trim()}
              className="h-10 px-4 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-60 transition-colors">
              Post
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
