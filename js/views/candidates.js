import { addCandidate, updateCandidate, deleteCandidate, voteOnCandidate } from "../store.js";
import { el, confirmDialog, friendlyError, rankControl, field, dialogShell, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { sortByRank } from "../lib/votes.js";
import { safeUrl } from "../lib/links.js";

function candidateFormDialog(existing) {
  return dialogShell("candidate-dialog", (finish) => {
    const cityInput = el("input", { type: "text", value: existing?.city || "" });
    const countryInput = el("input", { type: "text", value: existing?.country || "" });
    const whyInput = el("textarea", { rows: 2, value: existing?.why || "" });
    const priceInput = el("input", { type: "text", value: existing?.roughPriceNote || "" });
    const dateIdeaInput = el("input", { type: "text", value: existing?.dateIdea || "" });
    const linkInput = el("input", { type: "text", value: existing?.link || "" });
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: existing ? "Save" : "Add" });

    const form = el("form", { method: "dialog", className: "candidate-form" }, [
      field("City", cityInput),
      field("Country", countryInput),
      field("Why", whyInput),
      field("Rough price note", priceInput),
      field("Date idea", dateIdeaInput),
      field("Link", linkInput),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const city = cityInput.value.trim();
      const country = countryInput.value.trim();
      if (!city || !country) {
        errorHolder.replaceChildren(
          el("p", { className: "field-error", textContent: "City and country are required." })
        );
        return;
      }
      finish({
        city,
        country,
        why: whyInput.value.trim(),
        roughPriceNote: priceInput.value.trim(),
        dateIdea: dateIdeaInput.value.trim(),
        link: linkInput.value.trim() || null,
      });
    });
    return { form, focusEl: cityInput };
  });
}

/**
 * Builds the "Candidate destinations" section of the Overview tab (§7.5): the
 * header with its Add button, and the ranked list of candidate cards. Call
 * `render(candidates, usersById)` whenever trip/candidates/users change — it
 * defers rebuilding the list on its own while someone is editing inside it (§8).
 */
export function createCandidatesSection({ tripId, myUid, onChoose }) {
  let candidateCommentUnsubscribes = [];

  const addCandidateBtn = el("button", {
    type: "button",
    className: "btn btn-primary",
    textContent: "Add candidate destination",
  });
  const candidateError = el("div", { className: "field-error-holder" });
  const candidatesEl = el("div", { className: "candidates-section" });

  addCandidateBtn.addEventListener("click", async () => {
    const result = await candidateFormDialog(null);
    if (!result) return;
    candidateError.replaceChildren();
    try {
      await addCandidate(tripId, result, myUid);
    } catch (err) {
      candidateError.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    }
  });

  function renderCandidateCard(candidate, usersById) {
    const errorHolder = el("div", { className: "field-error-holder" });
    const details = [];
    if (candidate.why) details.push(el("p", { textContent: candidate.why }));
    if (candidate.roughPriceNote) details.push(el("p", { className: "muted", textContent: candidate.roughPriceNote }));
    if (candidate.dateIdea) details.push(el("p", { className: "muted", textContent: candidate.dateIdea }));
    const safeLink = candidate.link ? safeUrl(candidate.link) : null;
    if (safeLink) {
      details.push(el("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", textContent: "Link" }));
    }

    const rank = rankControl({
      votes: candidate.votes || {},
      myUid,
      usersById,
      onVote: (choice) => {
        voteOnCandidate(tripId, candidate.id, myUid, choice).catch((err) => {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
        });
      },
    });

    const chooseBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Choose this destination" });
    chooseBtn.addEventListener("click", () => onChoose(candidate, chooseBtn, errorHolder));

    const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
    editBtn.addEventListener("click", async () => {
      const result = await candidateFormDialog(candidate);
      if (!result) return;
      try {
        await updateCandidate(tripId, candidate.id, result);
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    const deleteBtn = el("button", { type: "button", className: "btn btn-small btn-danger", textContent: "Delete" });
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await confirmDialog(`Delete ${candidate.city}, ${candidate.country}?`);
      if (!confirmed) return;
      try {
        await deleteCandidate(tripId, candidate.id);
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      }
    });

    const { element: commentsEl, unsubscribe: commentsUnsub } = renderComments({
      tripId,
      targetType: "candidate",
      targetId: candidate.id,
      myUid,
      usersById,
    });
    candidateCommentUnsubscribes.push(commentsUnsub);

    return el("article", { className: "card candidate-card" }, [
      el("h3", { textContent: `${candidate.city}, ${candidate.country}` }),
      ...details,
      rank,
      el("div", { className: "candidate-actions" }, [chooseBtn, editBtn, deleteBtn]),
      errorHolder,
      commentsEl,
    ]);
  }

  function renderList(candidates, usersById) {
    for (const unsub of candidateCommentUnsubscribes) unsub();
    candidateCommentUnsubscribes = [];
    const sorted = sortByRank(candidates);
    if (sorted.length === 0) {
      candidatesEl.replaceChildren(el("p", { className: "empty-state", textContent: "No candidates yet." }));
      return;
    }
    candidatesEl.replaceChildren(...sorted.map((c) => renderCandidateCard(c, usersById)));
  }

  const element = el("div", {}, [
    el("div", { className: "candidates-header" }, [el("h2", { textContent: "Candidate destinations" }), addCandidateBtn]),
    el("p", { className: "muted section-hint", textContent: "Add places you're considering, then rank them together." }),
    candidateError,
    candidatesEl,
  ]);

  return {
    element,
    render(candidates, usersById) {
      renderWhenIdle(candidatesEl, () => renderList(candidates, usersById));
    },
    renderError(message) {
      candidatesEl.replaceChildren(el("p", { className: "field-error", textContent: message }));
    },
    unsubscribe() {
      for (const unsub of candidateCommentUnsubscribes) unsub();
    },
  };
}
