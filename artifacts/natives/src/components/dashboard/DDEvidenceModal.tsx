import { useState, useEffect } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { DDItemDef, DDDocument, DOCUMENT_REQUIRED_KEYS } from "@/lib/ddItems";

export default function DDEvidenceModal({ item, initialAnswers, orgId, userId, onClose, onSave }: {
  item: DDItemDef; initialAnswers: Record<string, any>; orgId: string; userId: string;
  onClose: () => void; onSave: (answers: Record<string, any>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers ?? {});
  const [attemptedInvalidSave, setAttemptedInvalidSave] = useState(false);
  const [documents, setDocuments] = useState<DDDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [wantsUpload, setWantsUpload] = useState(false);
  const [uploadVisibility, setUploadVisibility] = useState<DDDocument["visibility"]>("private");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!orgId) { setDocsLoading(false); return; }
    let cancelled = false;
    supabase.from("dd_evidence_documents")
      .select("id,organization_id,dd_item_key,file_path,file_name,visibility,created_at")
      .eq("organization_id", orgId)
      .eq("dd_item_key", item.key)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled) { setDocuments(data ?? []); setDocsLoading(false); } });
    return () => { cancelled = true; };
  }, [orgId, item.key]);

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId || !orgId) return;
    if (file.size > 10 * 1024 * 1024) { alert("File size must be under 10 MB."); return; }
    setUploading(true);
    const filePath = `${userId}/${item.key}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("dd-evidence-docs").upload(filePath, file);
    if (uploadError) { alert(`Upload failed: ${uploadError.message}`); setUploading(false); return; }
    const { data, error: insertError } = await supabase.from("dd_evidence_documents")
      .insert({ organization_id: orgId, dd_item_key: item.key, file_path: filePath, file_name: file.name, visibility: uploadVisibility })
      .select("id,organization_id,dd_item_key,file_path,file_name,visibility,created_at").single();
    if (insertError) { alert(`Couldn't save document record: ${insertError.message}`); setUploading(false); return; }
    setDocuments(prev => [data as DDDocument, ...prev]);
    setWantsUpload(false);
    setUploading(false);
  }

  async function handleDocView(doc: DDDocument) {
    const { data, error } = await supabase.storage.from("dd-evidence-docs").createSignedUrl(doc.file_path, 60);
    if (error || !data) { alert("Couldn't open document."); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function handleDocVisibilityChange(doc: DDDocument, visibility: DDDocument["visibility"]) {
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, visibility } : d));
    const { error } = await supabase.from("dd_evidence_documents").update({ visibility, updated_at: new Date().toISOString() }).eq("id", doc.id);
    if (error) alert(`Couldn't update visibility: ${error.message}`);
  }

  async function handleDocDelete(doc: DDDocument) {
    if (!confirm(`Remove "${doc.file_name}"?`)) return;
    await supabase.storage.from("dd-evidence-docs").remove([doc.file_path]);
    const { error } = await supabase.from("dd_evidence_documents").delete().eq("id", doc.id);
    if (error) { alert(`Couldn't remove document: ${error.message}`); return; }
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
  }

  function setAnswer(key: string, value: any) {
    setAnswers(prev => {
      const next = { ...prev, [key]: value };
      for (const q2 of item.questions) {
        if (q2.showIf?.key === key && q2.showIf.equals !== value) {
          delete next[q2.key];
          delete next[`${q2.key}_custom`];
        }
      }
      return next;
    });
  }

  function isQuestionMissing(q: typeof item.questions[number]): boolean {
    if (q.showIf && answers[q.showIf.key] !== q.showIf.equals) return false;
    const val = answers[q.key];
    // Blacklisting/pending-disputes disclosures require 20+ characters of
    // detail when answered Yes -- a real answer is required to save at all,
    // not just optional context. Scoped to these two keys specifically;
    // every other yesno+followUp question in the app keeps its normal
    // required:false behaviour untouched.
    if (q.key === "hasBlacklisting" || q.key === "hasPendingDisputes") {
      if (val !== true && val !== false) return true;
      if (val === true && q.type === "yesno" && q.followUpIfYes) {
        const detail = String(answers[q.followUpIfYes.key] ?? "").trim();
        if (detail.length < 20) return true;
      }
      return false;
    }
    if (q.required === false) return false;
    if (q.type === "yesno") {
      if (val !== true && val !== false) return true;
      if (q.followUpIfYes && q.followUpIfYes.required !== false && val === true && !answers[q.followUpIfYes.key]) return true;
      return false;
    }
    if (!val) return true;
    if (q.type === "select" && (val === "Other" || val === "Custom") && !answers[`${q.key}_custom`]) return true;
    return false;
  }

  // audited_accounts, legal_registration, governance_doc are the three DD
  // items a funder is most likely to treat as a hard fact rather than a
  // soft signal, and the three most likely to already exist as a real
  // file on the org's computer -- so requiring an upload isn't asking for
  // net-new work. The other six items and the whole FUNDER_DD_ITEMS
  // checklist stay questionnaire-only, unaffected by this.
  const missingDocument = DOCUMENT_REQUIRED_KEYS.includes(item.key) && documents.length === 0;
  const canSave = !item.questions.some(isQuestionMissing) && !missingDocument;

  function handleSave() {
    if (!canSave) { setAttemptedInvalidSave(true); return; }
    onSave(answers);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-md p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-[19px] font-bold text-foreground">{item.label}</h3>
          <p className="text-[15px] text-black dark:text-white mt-0.5">{item.sub}</p>
          {item.key === "legal_compliance_declaration" && (
            <p className="text-[13px] text-black dark:text-white mt-2 border border-border rounded-lg px-3 py-2 bg-muted/30">
              If you disclose a blacklisting or pending dispute, funders and corporate partners considering a partnership with you will see the detail you provide -- other organisations won't. Give a real, specific answer rather than a placeholder; vague or missing detail will block saving.
            </p>
          )}
        </div>
        {item.questions.map(q => {
          if (q.showIf && answers[q.showIf.key] !== q.showIf.equals) return null;
          const missing = attemptedInvalidSave && isQuestionMissing(q);
          const flagClass = missing ? "border-red-400" : "border-border";
          return (
          <div key={q.key}>
            <label className={`text-[13px] font-semibold uppercase tracking-wider mb-1.5 block ${missing ? "text-red-500" : "text-black dark:text-white"}`}>
              {q.label}{q.required !== false && <span className="text-red-500"> *</span>}
            </label>
            {q.type === "text" && (
              <input value={answers[q.key] ?? ""} onChange={e => setAnswer(q.key, e.target.value)}
                className={`w-full h-9 px-3 rounded-lg border bg-background text-[15px] text-foreground ${flagClass}`} />
            )}
            {q.type === "date" && (
              <input type="date" value={answers[q.key] ?? ""} onChange={e => setAnswer(q.key, e.target.value)}
                className={`w-full h-9 px-3 rounded-lg border bg-background text-[15px] text-foreground ${flagClass}`} />
            )}
            {q.type === "select" && (
              <>
                <select value={answers[q.key] ?? ""} onChange={e => setAnswer(q.key, e.target.value)}
                  className={`w-full h-9 px-3 rounded-lg border bg-background text-[15px] text-foreground ${flagClass}`}>
                  <option value="">Select...</option>
                  {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {(answers[q.key] === "Other" || answers[q.key] === "Custom") && (
                  <input value={answers[`${q.key}_custom`] ?? ""} onChange={e => setAnswer(`${q.key}_custom`, e.target.value)}
                    placeholder="Please specify"
                    className={`w-full h-9 px-3 mt-2 rounded-lg border bg-background text-[15px] text-foreground ${
                      attemptedInvalidSave && !answers[`${q.key}_custom`] ? "border-red-400" : "border-border"
                    }`} />
                )}
              </>
            )}
            {q.type === "yesno" && (
              <>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAnswer(q.key, true)}
                    className={`flex-1 h-9 rounded-lg border text-[15px] font-medium transition-colors ${
                      answers[q.key] === true ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : `${flagClass} text-black dark:text-white hover:border-[#2D6A4F]`
                    }`}>
                    Yes
                  </button>
                  <button type="button" onClick={() => {
                      setAnswer(q.key, false);
                      if (q.followUpIfYes) setAnswer(q.followUpIfYes.key, "");
                    }}
                    className={`flex-1 h-9 rounded-lg border text-[15px] font-medium transition-colors ${
                      answers[q.key] === false ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : `${flagClass} text-black dark:text-white hover:border-[#2D6A4F]`
                    }`}>
                    No
                  </button>
                </div>
                {q.followUpIfYes && answers[q.key] === true && (
                  <>
                    <input value={answers[q.followUpIfYes.key] ?? ""} onChange={e => setAnswer(q.followUpIfYes!.key, e.target.value)}
                      placeholder={q.followUpIfYes.label}
                      className={`w-full h-9 px-3 mt-2 rounded-lg border bg-background text-[15px] text-foreground ${
                        attemptedInvalidSave && isQuestionMissing(q) ? "border-red-400" : "border-border"
                      }`} />
                    {(q.key === "hasBlacklisting" || q.key === "hasPendingDisputes") && String(answers[q.followUpIfYes.key] ?? "").trim().length < 20 && (
                      <p className="text-[11px] mt-1 text-red-500">
                        {String(answers[q.followUpIfYes.key] ?? "").trim().length}/20 characters minimum
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          );
        })}

        {orgId && (
          <div className="pt-3 border-t border-border space-y-3">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-black dark:text-white">Supporting documents</p>
            {DOCUMENT_REQUIRED_KEYS.includes(item.key) && (
              <p className="text-[13px] text-black dark:text-white opacity-70">A document is required for this item.</p>
            )}

            {!docsLoading && documents.length > 0 && (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
                    <button type="button" onClick={() => handleDocView(doc)}
                      className="text-[15px] text-foreground hover:underline underline-offset-2 truncate text-left">
                      {doc.file_name}
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select value={doc.visibility} onChange={e => handleDocVisibilityChange(doc, e.target.value as DDDocument["visibility"])}
                        className="h-7 text-[13px] rounded-md border border-border bg-background px-1.5 text-foreground">
                        <option value="private">Private</option>
                        <option value="relationship">Connections only</option>
                        <option value="public">Public</option>
                      </select>
                      <button type="button" onClick={() => handleDocDelete(doc)} className="text-muted-foreground hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!wantsUpload ? (
              <button type="button" onClick={() => setWantsUpload(true)}
                className="text-[15px] text-[#2D6A4F] hover:underline underline-offset-2 font-medium">
                + Upload a supporting document
              </button>
            ) : (
              <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                <div>
                  <label className="text-[13px] font-semibold uppercase tracking-wider text-black dark:text-white mb-1.5 block">Who can view this document?</label>
                  <div className="flex gap-1.5">
                    {([["private","Only me"],["relationship","Connections"],["public","Public"]] as const).map(([v, label]) => (
                      <button key={v} type="button" onClick={() => setUploadVisibility(v)}
                        className={`flex-1 h-8 rounded-lg border text-[13px] font-medium transition-colors ${
                          uploadVisibility === v ? "bg-[#2D6A4F] border-[#2D6A4F] text-white" : "border-border text-black dark:text-white hover:border-[#2D6A4F]"
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-center gap-2 h-9 rounded-lg border border-border text-[15px] text-black dark:text-white hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Choose file"}
                  <input type="file" className="sr-only" onChange={handleDocUpload} disabled={uploading} />
                </label>
                <button type="button" onClick={() => setWantsUpload(false)} className="text-[13px] text-black dark:text-white hover:text-foreground">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {attemptedInvalidSave && item.questions.some(isQuestionMissing) && (
          <p className="text-[13px] text-red-500 font-medium">
            Fill in the required fields (marked *) before saving.
          </p>
        )}
        {attemptedInvalidSave && missingDocument && (
          <p className="text-[13px] text-red-500 font-medium">
            This item requires at least one supporting document before it can be marked complete.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 rounded-full border border-border text-[15px] text-black dark:text-white hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            className="flex-1 h-9 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-[15px] font-medium transition-colors">
            Save &amp; check
          </button>
        </div>
      </div>
    </div>
  );
}
