import { el, icon } from "../ui.js";
import { voteCounts } from "../lib/votes.js";

const LABELS = { love: "Love", like: "Like", pass: "Pass" };

/**
 * The vote bar on a place row (T71, §7.7): three 44px buttons that vote right
 * from the (closed or open) row, with the same clear-on-repeat behavior as
 * `rankControl`. `onVote(choice | null)` must return the write's promise so
 * the bar can disable itself while it's pending; the caller shows any error.
 */
export function voteBar({ votes = {}, myUid, onVote }) {
  const counts = voteCounts(votes);
  const myChoice = (votes || {})[myUid] ?? null;

  const bar = el("div", { className: "vote-bar" });
  const buttons = ["love", "like", "pass"].map((choice) => {
    const pressed = choice === myChoice;
    const btn = el(
      "button",
      {
        type: "button",
        className: `btn vote-bar-btn${pressed ? " vote-bar-pressed" : ""}`,
        attrs: { "aria-label": `${LABELS[choice]} · ${counts[choice]}`, "aria-pressed": pressed ? "true" : "false" },
      },
      [icon(choice, { size: 16 }), el("span", { textContent: String(counts[choice]) })]
    );
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      buttons.forEach((b) => (b.disabled = true));
      Promise.resolve(onVote(pressed ? null : choice)).finally(() => {
        buttons.forEach((b) => (b.disabled = false));
      });
    });
    return btn;
  });
  bar.append(...buttons);
  return bar;
}
