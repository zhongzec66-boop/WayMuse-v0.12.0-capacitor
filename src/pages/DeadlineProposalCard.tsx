import { CalendarClock, Check, X } from "lucide-react";
import { useState } from "react";
import { proposalDueAt } from "../agent";
import type { DeadlineProposal } from "../agent";
import { newId } from "../id";
import type { Assignment, Exam } from "../semester";

/**
 * 作业 / 考试的确认卡。
 *
 * 定稿里这叫「信任来源」：写日历、写记忆、设提醒之前先问一句。
 * 模型只说它听到了什么，落不落库由用户点一下决定。
 */

function dateText(proposal: DeadlineProposal): string {
  const at = new Date(proposalDueAt(proposal));
  const month = at.getMonth() + 1;
  const day = at.getDate();
  const hour = String(at.getHours()).padStart(2, "0");
  const minute = String(at.getMinutes()).padStart(2, "0");
  return `${month} 月 ${day} 日 ${hour}:${minute}`;
}

export default function DeadlineProposalCard({
  proposals,
  onAssignmentsChange,
  onExamsChange,
  onDismiss,
}: {
  proposals: DeadlineProposal[];
  onAssignmentsChange: (items: Assignment[]) => void;
  onExamsChange: (items: Exam[]) => void;
  onDismiss: () => void;
}) {
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (!proposals.length || hidden) return null;

  const accept = () => {
    const assignments: Assignment[] = [];
    const exams: Exam[] = [];
    for (const proposal of proposals) {
      if (proposal.kind === "exam") {
        exams.push({
          id: newId(),
          at: proposalDueAt(proposal),
          ...(proposal.scope ? { scope: proposal.scope } : {}),
        });
      } else {
        assignments.push({
          id: newId(),
          title: proposal.title,
          dueAt: proposalDueAt(proposal),
          status: "todo",
          ...(proposal.weight ? { weightPercent: proposal.weight } : {}),
        });
      }
    }
    if (assignments.length) onAssignmentsChange(assignments);
    if (exams.length) onExamsChange(exams);
    setDone(true);
  };

  return (
    <section
      className={"wr-deadline-proposal" + (done ? " is-done" : "")}
      aria-label="作业或考试确认"
    >
      <small>
        <CalendarClock size={13} /> 记下这个 · 等你确认
      </small>
      {proposals.map((proposal, index) => (
        <div className="wr-deadline-proposal-row" key={index}>
          <b>{proposal.title}</b>
          <small>
            {proposal.kind === "exam" ? "考试" : "作业"} · {dateText(proposal)}
            {proposal.weight ? ` · 占 ${proposal.weight}%` : ""}
            {proposal.scope ? ` · ${proposal.scope}` : ""}
          </small>
        </div>
      ))}
      {done ? (
        <p className="wr-deadline-proposal-note">已加入计划</p>
      ) : (
        <div className="wr-deadline-proposal-actions">
          <button type="button" className="is-primary" onClick={accept}>
            <Check size={14} /> 对，记下来
          </button>
          <button
            type="button"
            onClick={() => {
              setHidden(true);
              onDismiss();
            }}
          >
            <X size={14} /> 不用
          </button>
        </div>
      )}
    </section>
  );
}
