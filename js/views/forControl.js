import { el } from "../ui.js";
import { forTravelers } from "../lib/choices.js";

/**
 * "Who's this for?" (§7.6, §7.7): the "For: Matt, Sam · Automatic" line and,
 * while `editing`, the pills that set it by hand. `kind` is the `forTravelers`
 * kind ("hop", "stay", ...); `onToggle()` opens/closes the pills and
 * `onSet(ids)` takes a list of traveler ids, or null for automatic again.
 */
export function forControl(item, kind, { ctx, travelers, editing, onToggle, onSet }) {
  const ids = forTravelers(item, kind, ctx);
  const byHand = Array.isArray(item.forTravelerIds);
  const names = travelers.filter((t) => ids.includes(t.id)).map((t) => t.name);

  const toggleBtn = el("button", { type: "button", className: "btn btn-link route-for-btn", textContent: editing ? "Done" : "Who's this for?" });
  toggleBtn.addEventListener("click", onToggle);
  const line = el("div", { className: "route-for" }, [
    el("span", { className: "muted", textContent: "For: " }),
    el("b", { textContent: names.length ? names.join(", ") : "no one yet" }),
    el("span", { className: "muted", textContent: byHand ? " · Set by hand" : " · Automatic" }),
  ]);
  if (byHand) {
    const resetBtn = el("button", { type: "button", className: "btn btn-link route-for-btn", textContent: "Reset" });
    resetBtn.addEventListener("click", () => onSet(null));
    line.append(resetBtn);
  }
  line.append(toggleBtn);
  if (!editing) return line;

  const pill = (label, pressed, onClick) => {
    const btn = el("button", { type: "button", className: "route-for-pill", textContent: label, attrs: { "aria-pressed": String(pressed) } });
    btn.addEventListener("click", onClick);
    return btn;
  };
  const pills = el("div", { className: "route-for-pills" }, [
    pill("Automatic", !byHand, () => onSet(null)),
    ...travelers.map((t) =>
      pill(t.name, byHand && ids.includes(t.id), () => {
        const next = new Set(ids);
        if (next.has(t.id)) next.delete(t.id);
        else next.add(t.id);
        onSet(travelers.filter((x) => next.has(x.id)).map((x) => x.id));
      })
    ),
  ]);
  return el("div", { className: "route-for-edit" }, [line, pills]);
}
