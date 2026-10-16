// The Overview "Shared links" card (§7.5, T59): the Album and Our My Maps
// rows. Replaces the old free-standing Album field.
import { el, field, row, icon, menuButton, externalLink, confirmDialog, friendlyError, linkField, dialogShell, setPending } from "../ui.js";
import { updateTripFields } from "../store.js";
import { safeUrl } from "../lib/links.js";
import { parseMyMapsUrl, isShortMapsLink } from "../lib/mymaps.js";

function albumMessage(text) {
  return safeUrl(text) ? null : "That doesn't look like a link.";
}

function myMapsMessage(text) {
  if (parseMyMapsUrl(text)) return null;
  if (isShortMapsLink(text)) return "That's a short link. Open it, then copy the address from the browser bar and paste that.";
  return "That doesn't look like a Google My Maps link (it should contain google.com/maps/d/).";
}

/**
 * A small sheet with one link box, live validation as the user types or
 * pastes (`validate(text)` returns an error message or null), and **Save**,
 * which re-checks before closing. Resolves the trimmed link, or null on
 * cancel.
 */
export function editLinkSheet({ title, placeholder, ariaLabel, initialValue, validate }) {
  return dialogShell("shared-link-dialog", (finish) => {
    const errorHolder = el("div", { className: "field-error-holder" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Save" });

    function showMessage(message) {
      errorHolder.replaceChildren(message ? el("p", { className: "field-error", textContent: message }) : null);
    }

    const { row: linkRow, input: linkInput } = linkField({
      placeholder,
      ariaLabel,
      onLink: (text) => showMessage(text.trim() ? validate(text.trim()) : null),
    });
    linkInput.value = initialValue || "";

    const form = el("form", { method: "dialog" }, [
      el("h3", { textContent: title }),
      field(ariaLabel, linkRow),
      errorHolder,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = linkInput.value.trim();
      if (!value) {
        showMessage("Paste a link first.");
        return;
      }
      const message = validate(value);
      if (message) {
        showMessage(message);
        return;
      }
      finish(value);
    });

    return { form, focusEl: linkInput };
  });
}

function sharedLinkRow({ tripId, iconName, title, url, unsetHint, fieldName, sheetTitle, placeholder, ariaLabel, validate, onError }) {
  // Pending state sits on whichever trailing control started the save: the
  // Add link button for an unset row, or the row's own ⋯ menu trigger for a
  // set row (disabled rather than relabeled — it's icon-only, so swapping its
  // text like setPending() would clobber the icon).
  let menuTrigger = null;

  async function openEdit() {
    const value = await editLinkSheet({ title: sheetTitle, placeholder, ariaLabel, initialValue: url || "", validate });
    if (value === null) return;
    if (addBtn) setPending(addBtn, true);
    if (menuTrigger) menuTrigger.disabled = true;
    try {
      await updateTripFields(tripId, { [fieldName]: value });
    } catch (err) {
      onError(friendlyError(err));
    } finally {
      if (addBtn) setPending(addBtn, false);
      if (menuTrigger) menuTrigger.disabled = false;
    }
  }

  async function handleRemove() {
    const confirmed = await confirmDialog(`Remove the ${title} link?`, "Remove");
    if (!confirmed) return;
    if (menuTrigger) menuTrigger.disabled = true;
    try {
      await updateTripFields(tripId, { [fieldName]: null });
    } catch (err) {
      onError(friendlyError(err));
    } finally {
      if (menuTrigger) menuTrigger.disabled = false;
    }
  }

  const leading = icon(iconName, { size: 20 });
  let addBtn = null;
  if (!url) {
    addBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Add link", onclick: openEdit });
    return row({ leading, title, subtitle: unsetHint, trailing: addBtn });
  }

  menuTrigger = menuButton(
    [
      { label: "Change link", icon: "edit", onSelect: openEdit },
      { label: "Remove link", icon: "trash", onSelect: handleRemove, danger: true },
    ],
    { label: `More actions for ${title}` }
  );
  const trailing = el("div", { className: "list-row-actions" }, [externalLink(url, "Open ↗"), menuTrigger]);
  return row({ leading, title, trailing });
}

/** Renders the Shared links card (Album, Our My Maps) into `container`. */
export function renderSharedLinks(container, { tripId, trip, onError }) {
  container.replaceChildren(
    el("h2", { textContent: "Shared links" }),
    el("div", { className: "card shared-links-card" }, [
      sharedLinkRow({
        tripId,
        iconName: "link",
        title: "Album",
        url: trip.albumUrl,
        unsetHint: "Add your shared photo album",
        fieldName: "albumUrl",
        sheetTitle: "Album link",
        placeholder: "https://photos.app.goo.gl/…",
        ariaLabel: "Album link",
        validate: albumMessage,
        onError,
      }),
      sharedLinkRow({
        tripId,
        iconName: "map",
        title: "Our My Maps",
        url: trip.myMapsUrl,
        unsetHint: "Add the group's shared map",
        fieldName: "myMapsUrl",
        sheetTitle: "Our My Maps link",
        placeholder: "https://www.google.com/maps/d/edit?mid=…",
        ariaLabel: "My Maps link",
        validate: myMapsMessage,
        onError,
      }),
    ])
  );
}
