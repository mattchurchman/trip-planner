import { addCandidate, updateCandidate, deleteCandidate, voteOnCandidate, setCandidatePhoto } from "../store.js";
import { el, confirmDialog, friendlyError, rankControl, field, dialogShell, renderWhenIdle } from "../ui.js";
import { renderComments } from "./comments.js";
import { wikipediaSummary } from "../lookup.js";
import { photoTitles, pickPhoto } from "../lib/photos.js";
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
 * Tries each candidate title in turn (§7.5, §9.7) and returns the first usable
 * photo, `null` if none of the titles have one, or `undefined` if a request
 * failed outright (try again later — nothing should be saved for that case).
 */
async function findPhoto(city, country) {
  for (const title of photoTitles(city, country)) {
    let json;
    try {
      json = await wikipediaSummary(title);
    } catch {
      return undefined;
    }
    const photo = pickPhoto(json);
    if (photo) return photo;
  }
  return null;
}

/** The gradient placeholder (§7.5): shown for `photo: null`, a still-missing
 * `photo`, or an image that fails to load. */
function buildPhotoPlaceholder(candidate) {
  const letter = (candidate.city || "").trim().charAt(0).toUpperCase() || "?";
  return el("div", { className: "candidate-photo-placeholder" }, [el("span", { textContent: letter })]);
}

function buildPhotoBanner(candidate) {
  const wrap = el("div", { className: "candidate-photo" });
  const imgSrc = candidate.photo ? safeUrl(candidate.photo.url) : null;
  if (!imgSrc) {
    wrap.appendChild(buildPhotoPlaceholder(candidate));
    return wrap;
  }
  const img = el("img", {
    className: "candidate-photo-img",
    src: imgSrc,
    alt: `${candidate.city}, ${candidate.country}`,
    loading: "lazy",
    attrs: { referrerpolicy: "no-referrer" },
  });
  // Never a broken-image icon (§7.5): swap in the same placeholder used for a
  // missing or not-yet-found photo.
  img.addEventListener("error", () => wrap.replaceChildren(buildPhotoPlaceholder(candidate)));
  wrap.appendChild(img);
  const creditHref = safeUrl(candidate.photo.pageUrl || "");
  if (creditHref) {
    wrap.appendChild(
      el("a", {
        className: "candidate-photo-credit",
        href: creditHref,
        target: "_blank",
        rel: "noopener noreferrer",
        textContent: "Photo: Wikipedia",
      })
    );
  }
  return wrap;
}

/** The labeled `<dl>` of candidate details (§7.5), or the "no details" hint
 * when why/price/when/link are all empty. */
function buildDetailsList(candidate) {
  const rows = [];
  if (candidate.why) rows.push(["Why go", candidate.why]);
  if (candidate.roughPriceNote) rows.push(["Rough price", candidate.roughPriceNote]);
  if (candidate.dateIdea) rows.push(["When", candidate.dateIdea]);
  const safeLink = candidate.link ? safeUrl(candidate.link) : null;

  if (rows.length === 0 && !safeLink) {
    return el("p", { className: "muted", textContent: "No details yet — use Edit to add some." });
  }

  const dl = el("dl", { className: "candidate-details" });
  for (const [label, value] of rows) {
    dl.append(el("dt", { textContent: label }), el("dd", { textContent: value }));
  }
  if (safeLink) {
    dl.append(
      el("dt", { textContent: "Link" }),
      el("dd", {}, [el("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", textContent: "Open link" })])
    );
  }
  return dl;
}

/**
 * Builds the "Candidate destinations" section of the Overview tab (§7.5): the
 * header with its Add button, and the ranked list of candidate cards. Call
 * `render(candidates, trip, usersById)` whenever trip/candidates/users change
 * — it defers rebuilding the list on its own while someone is editing inside
 * it (§8).
 */
export function createCandidatesSection({ tripId, myUid, onChoose }) {
  let candidateCommentUnsubscribes = [];
  // Candidate ids a photo lookup has already been started for, this page load
  // only (§7.5) — a live update re-rendering the same candidate must not fire
  // a second request while the first is still in flight or already saved.
  const photoLookupsStarted = new Set();

  const addCandidateBtn = el("button", {
    type: "button",
    className: "btn btn-primary",
    textContent: "Add candidate destination",
  });
  const candidateError = el("div", { className: "field-error-holder" });
  const candidatesEl = el("div", { className: "candidates-section" });

  async function lookupAndSavePhoto(candidateId, city, country) {
    const photo = await findPhoto(city, country);
    if (photo === undefined) return; // a request failed; retried on a later visit, nothing saved
    try {
      await setCandidatePhoto(tripId, candidateId, photo);
    } catch {
      // Best-effort: a save failure here just means the next render (or visit) tries again.
    }
  }

  /** Starts a photo lookup for a candidate whose city/country just changed
   * (add, or an edit that changed either), overriding any earlier lookup. */
  function refreshPhoto(candidateId, city, country) {
    photoLookupsStarted.add(candidateId);
    lookupAndSavePhoto(candidateId, city, country);
  }

  /** Starts a photo lookup only if this candidate hasn't had one started yet
   * this page load — for a card rendering with `photo` still missing. */
  function ensurePhoto(candidate) {
    if (photoLookupsStarted.has(candidate.id)) return;
    photoLookupsStarted.add(candidate.id);
    lookupAndSavePhoto(candidate.id, candidate.city, candidate.country);
  }

  addCandidateBtn.addEventListener("click", async () => {
    const result = await candidateFormDialog(null);
    if (!result) return;
    candidateError.replaceChildren();
    try {
      const ref = await addCandidate(tripId, result, myUid);
      refreshPhoto(ref.id, result.city, result.country);
    } catch (err) {
      candidateError.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    }
  });

  function renderCandidateCard(candidate, trip, usersById) {
    const errorHolder = el("div", { className: "field-error-holder" });
    const isChosen = trip.destinationId === candidate.id;

    if (candidate.photo === undefined) ensurePhoto(candidate);

    const titleRow = el("div", { className: "candidate-title-row" }, [
      el("div", {}, [
        el("h3", { textContent: candidate.city }),
        el("p", { className: "muted candidate-country", textContent: candidate.country }),
      ]),
      isChosen ? el("span", { className: "candidate-chosen-pill", textContent: "Chosen" }) : null,
    ].filter(Boolean));

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

    const chooseBtn = isChosen
      ? null
      : el("button", { type: "button", className: "btn btn-small btn-primary", textContent: "Choose this destination" });
    if (chooseBtn) chooseBtn.addEventListener("click", () => onChoose(candidate, chooseBtn, errorHolder));

    const editBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Edit" });
    editBtn.addEventListener("click", async () => {
      const result = await candidateFormDialog(candidate);
      if (!result) return;
      try {
        await updateCandidate(tripId, candidate.id, result);
        if (result.city !== candidate.city || result.country !== candidate.country) {
          refreshPhoto(candidate.id, result.city, result.country);
        }
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
      buildPhotoBanner(candidate),
      el("div", { className: "candidate-card-body" }, [
        titleRow,
        buildDetailsList(candidate),
        rank,
        el("div", { className: "candidate-actions" }, [chooseBtn, editBtn, deleteBtn].filter(Boolean)),
        errorHolder,
        commentsEl,
      ]),
    ]);
  }

  function renderList(candidates, trip, usersById) {
    for (const unsub of candidateCommentUnsubscribes) unsub();
    candidateCommentUnsubscribes = [];
    const sorted = sortByRank(candidates);
    if (sorted.length === 0) {
      candidatesEl.replaceChildren(el("p", { className: "empty-state", textContent: "No candidates yet." }));
      return;
    }
    candidatesEl.replaceChildren(...sorted.map((c) => renderCandidateCard(c, trip, usersById)));
  }

  const element = el("div", {}, [
    el("div", { className: "candidates-header" }, [el("h2", { textContent: "Candidate destinations" }), addCandidateBtn]),
    el("p", { className: "muted section-hint", textContent: "Add places you're considering, then rank them together." }),
    candidateError,
    candidatesEl,
  ]);

  return {
    element,
    render(candidates, trip, usersById) {
      renderWhenIdle(candidatesEl, () => renderList(candidates, trip, usersById));
    },
    renderError(message) {
      candidatesEl.replaceChildren(el("p", { className: "field-error", textContent: message }));
    },
    unsubscribe() {
      for (const unsub of candidateCommentUnsubscribes) unsub();
    },
  };
}
