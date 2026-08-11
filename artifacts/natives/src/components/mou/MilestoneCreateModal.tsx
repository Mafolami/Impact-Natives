import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { OrgRef } from "@/lib/milestones";
const CURRENCY_OPTIONS = ["NGN", "USD", "GBP", "EUR", "KES", "GHS", "ZAR"];
export default function MilestoneCreateModal({ mouDocumentId, orgA, orgB, isBinding, myUserId, onClose, onCreated }: {
  mouDocumentId: string;
  orgA: OrgRef | null;
  orgB: OrgRef | null;
  isBinding: boolean;
  myUserId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [payerSide, setPayerSide] = useState<"org_a" | "org_b" | "none">("none");
  const [creating, setCreating] = useState(false);
  async function createMilestone() {
    if (!orgA || !orgB || !title.trim()) return;
    // Non-binding agreements carry no financial commitment -- the fields
    // are hidden below, but this is the actual guarantee: even if state
    // somehow held a stale value (e.g. isBinding flipped mid-session),
    // nothing financial reaches the database for a non-binding agreement.
    const parsedAmount = isBinding && amount.trim() ? Number(amount) : null;
    if (parsedAmount !== null && payerSide === "none") return;
    setCreating(true);
    const payerOrgId = parsedAmount !== null ? (payerSide === "org_a" ? orgA.id : payerSide === "org_b" ? orgB.id : null) : null;
    const recipientOrgId = parsedAmount !== null ? (payerSide === "org_a" ? orgB.id : payerSide === "org_b" ? orgA.id : null) : null;
    const { error } = await supabase.from("mou_milestones").insert({
      mou_document_id: mouDocumentId,
      title: title.trim(),
      description: description.trim() || null,
      target_date: targetDate || null,
      linked_amount: parsedAmount,
      linked_currency: parsedAmount !== null ? currency : null,
      payer_org_id: payerOrgId,
      recipient_org_id: recipientOrgId,
      created_by: myUserId,
    });
    setCreating(false);
    if (error) return;
    onCreated();
    onClose();
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-sm shadow-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <p className="text-base font-bold text-black dark:text-white">New milestone</p>
        {!isBinding && (
          <p className="text-xs text-black dark:text-white">
            Non-binding agreement -- this milestone tracks a deliverable, not a financial commitment.
          </p>
        )}
        <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
        <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)}
          rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white resize-none" />
        <div>
          <label className="text-xs text-black dark:text-white">Target date</label>
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
        </div>
        {isBinding && (
          <>
            <div className="flex gap-2">
              <input type="number" placeholder="Amount (optional)" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="flex-1 h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white" />
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!amount.trim()}
                className="w-24 h-10 px-2 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white disabled:opacity-60">
                {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {amount.trim() && (
              <div>
                <label className="text-xs text-black dark:text-white">Who releases this amount</label>
                <select value={payerSide} onChange={(e) => setPayerSide(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-transparent text-sm text-black dark:text-white">
                  <option value="none">Select...</option>
                  <option value="org_a">{orgA?.organisation_name ?? "Org A"}</option>
                  <option value="org_b">{orgB?.organisation_name ?? "Org B"}</option>
                </select>
              </div>
            )}
          </>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 h-10 rounded-full border border-border text-sm text-black dark:text-white hover:border-foreground/30 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={createMilestone}
            disabled={creating || !title.trim() || (isBinding && !!amount.trim() && payerSide === "none")}
            className="flex-1 h-10 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium disabled:opacity-60 transition-colors">
            {creating ? "Adding..." : "Add milestone"}
          </button>
        </div>
      </div>
    </div>
  );
}