// ─── OrgDocumentsList.tsx ─────────────────────────────────────────────────────
// Supporting documents for one organisation, for the Documents tab of the profile.
// Which rows come back is decided by the database (row-level security on
// dd_evidence_documents): the uploader and org owner see everything, other viewers see
// documents marked Public, plus documents marked Connections when they have a live
// relationship with the org. Files open through the get-dd-document-url edge function,
// which reads the row with the viewer's own login and then issues a short-lived link.
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type DocRow = {
  id: string;
  dd_item_key: string;
  file_name: string;
  visibility: "private" | "relationship" | "public";
  created_at: string;
};

const VISIBILITY_LABEL: Record<DocRow["visibility"], string> = {
  private: "Private",
  relationship: "Connections",
  public: "Public",
};

// dd_item_key is stored without the dd_/fdd_ prefix that the org record's columns carry.
function itemKeyOf(columnKey: string): string {
  return columnKey.replace(/^f?dd_/, "");
}

export default function OrgDocumentsList({ orgId, isOwnOrg, labels }: {
  orgId: string; isOwnOrg: boolean; labels: { key: string; label: string }[];
}) {
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const [preview, setPreview] = useState<{ url: string; fileName: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDocs(null);
    setLoadFailed(false);
    setPreview(null);
    supabase.from("dd_evidence_documents")
      .select("id,dd_item_key,file_name,visibility,created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setLoadFailed(true);
        setDocs((data ?? []) as DocRow[]);
      });
    return () => { cancelled = true; };
  }, [orgId]);

  async function openDoc(doc: DocRow) {
    setOpeningId(doc.id);
    setOpenFailed(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-dd-document-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ documentId: doc.id }),
      });
      const result = await res.json();
      if (result.url) setPreview({ url: result.url, fileName: doc.file_name });
      else setOpenFailed(true);
    } catch {
      setOpenFailed(true);
    }
    setOpeningId(null);
  }

  if (docs === null) {
    return <Loader2 className="w-4 h-4 animate-spin text-[#2D6A4F]" />;
  }
  if (loadFailed) {
    return <p className="text-sm text-black dark:text-white">Couldn't load documents.</p>;
  }
  if (docs.length === 0) {
    return (
      <p className="text-sm text-black dark:text-white leading-relaxed">
        {isOwnOrg
          ? "You haven't uploaded any supporting documents yet. Add them from the due diligence items on your profile."
          : "No documents have been shared with you. Each organisation chooses who can see its files."}
      </p>
    );
  }

  // Group by due diligence item, in checklist order, then anything else.
  const known = labels.map(l => ({ key: itemKeyOf(String(l.key)), label: l.label }));
  const groups: { key: string; label: string; items: DocRow[] }[] = known
    .map(k => ({ ...k, items: docs.filter(d => d.dd_item_key === k.key) }))
    .filter(g => g.items.length > 0);
  const knownKeys = new Set(known.map(k => k.key));
  const otherKeys = [...new Set(docs.filter(d => !knownKeys.has(d.dd_item_key)).map(d => d.dd_item_key))];
  for (const key of otherKeys) {
    groups.push({ key, label: key.replace(/_/g, " "), items: docs.filter(d => d.dd_item_key === key) });
  }

  const ext = preview?.fileName.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
  const isPdf = ext === "pdf";

  return (
    <>
      <div className="space-y-4">
        {groups.map(g => (
          <div key={g.key}>
            <p className="text-xs font-semibold text-black dark:text-white mb-1.5 capitalize">{g.label}</p>
            <div className="space-y-1.5">
              {g.items.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-card">
                  <p className="text-sm text-foreground truncate">{d.file_name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#2D6A4F]/40 text-foreground">
                      {VISIBILITY_LABEL[d.visibility] ?? d.visibility}
                    </span>
                    <button type="button" onClick={() => openDoc(d)} disabled={openingId === d.id}
                      className="text-xs font-semibold text-[#2D6A4F] hover:underline underline-offset-2 disabled:opacity-50 flex items-center gap-1">
                      {openingId === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {openFailed && <p className="text-xs text-black dark:text-white">Couldn't open that document. It may no longer be shared with you.</p>}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <div role="dialog" aria-modal="true"
            className="bg-white dark:bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border shrink-0">
              <button type="button" onClick={() => setPreview(null)}
                className="text-sm font-medium text-black dark:text-white hover:underline underline-offset-2 shrink-0">
                Close
              </button>
              <p className="text-sm font-medium text-foreground truncate flex-1 text-center">{preview.fileName}</p>
              <a href={preview.url} download={preview.fileName}
                className="text-sm font-medium text-[#2D6A4F] hover:underline underline-offset-2 shrink-0">
                Download
              </a>
            </div>
            <div className="flex-1 overflow-auto flex items-start justify-center min-h-[50vh]">
              {isImage && <img src={preview.url} alt={preview.fileName} className="max-w-full max-h-[75vh] object-contain" />}
              {isPdf && <iframe src={preview.url} title={preview.fileName} className="w-full h-[75vh] border-0" />}
              {!isImage && !isPdf && (
                <p className="text-sm text-black dark:text-white p-8 text-center">
                  A preview isn't available for this file type. Use Download to open it.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
