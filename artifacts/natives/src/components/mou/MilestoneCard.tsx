import { MouMilestone, MILESTONE_STATUS_LABEL, MILESTONE_STATUS_PILL_STYLES, isMilestoneOverdue } from "@/lib/milestones";

export default function MilestoneCard({ milestone, onClick }: { milestone: MouMilestone; onClick: () => void }) {
  const overdue = isMilestoneOverdue(milestone);
  const statusInfo = MILESTONE_STATUS_LABEL[milestone.status];
  const pillStyles = MILESTONE_STATUS_PILL_STYLES[statusInfo.tone];

  return (
    <button type="button" onClick={onClick}
      className="w-full text-left rounded-xl border border-border px-4 py-3 space-y-1.5 hover:border-[#2D6A4F]/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-black dark:text-white">{milestone.title}</p>
        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${pillStyles}`}>
          {overdue ? "Overdue" : statusInfo.label}
        </span>
      </div>
      {milestone.description && (
        <p className="text-sm text-black dark:text-white">{milestone.description}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-black dark:text-white">
        {milestone.target_date && <span>{new Date(milestone.target_date).toLocaleDateString("en-GB")}</span>}
        {milestone.linked_amount !== null && (
          <span className="font-medium">{milestone.linked_currency} {milestone.linked_amount.toLocaleString()}</span>
        )}
      </div>
    </button>
  );
}
