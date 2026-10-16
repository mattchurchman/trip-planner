// Shared DOM helpers. No Firebase imports here.
import { voteSummary } from "./lib/votes.js";
import { looksLikeLink, safeUrl } from "./lib/links.js";
import { ICONS } from "./lib/icons.js";

/** Creates an element. props supports className, textContent, onX handlers,
 * an `attrs` object for raw attributes, and any other DOM property. */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === "attrs") {
      for (const [attrName, attrValue] of Object.entries(value)) {
        if (attrValue === false || attrValue == null) continue;
        node.setAttribute(attrName, attrValue === true ? "" : attrValue);
      }
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      node[key] = value;
    }
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

/** Creates an SVG element (e.g. for the price sparkline, §7.8) with the given attributes. */
export function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child != null) node.appendChild(child);
  }
  return node;
}

/** Builds one icon from the shared set (R7 §5). Unknown names log a warning and render nothing. */
export function icon(name, { size = 20, label } = {}) {
  const paths = ICONS[name];
  if (!paths) {
    console.warn(`Unknown icon: ${name}`);
    return el("span", { className: "icon-missing" });
  }
  const attrs = { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" };
  if (label) {
    attrs.role = "img";
    attrs["aria-label"] = label;
  } else {
    attrs["aria-hidden"] = "true";
  }
  return svgEl("svg", attrs, paths.map((d) => svgEl("path", { d })));
}

/** An external link that appends the `external` icon (R7 §5) instead of relying on the CSS "↗". */
export function externalLink(href, text) {
  const safe = safeUrl(href);
  if (!safe) return null;
  const arrow = icon("external", { size: 14 });
  arrow.classList.add("ext-icon");
  return el("a", { href: safe, target: "_blank", rel: "noopener noreferrer" }, [text, arrow]);
}

/** Toggles a button between its normal label and a pending label, disabling it while pending. */
export function setPending(button, pending, pendingText = "Saving…") {
  if (pending) {
    if (button.dataset.originalText === undefined) button.dataset.originalText = button.textContent;
    button.textContent = pendingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText ?? button.textContent;
    delete button.dataset.originalText;
    button.disabled = false;
  }
}

/** Shows a short status message above the phone navigation bar. */
export function toast(message) {
  let notice = document.getElementById("app-toast");
  if (!notice) {
    notice = el("div", { className: "toast", attrs: { id: "app-toast", role: "status" } });
    document.body.appendChild(notice);
  }
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { notice.hidden = true; }, 2600);
}

/** Translates a Firestore/auth error into a message the owner's friends can act on. */
export function friendlyError(err) {
  if (err && err.code === "permission-denied") {
    return "You don't have access. Are you signed in with the approved account?";
  }
  return (err && err.message) || "Something went wrong. Try again in a moment.";
}

/**
 * A ⋯ icon button that opens a small action menu (R7 §6): a popover anchored
 * under the button from 760px, a bottom sheet below that. `items` is an
 * array of `{ label, icon, onSelect, danger? }`; falsy entries are skipped
 * so callers can gate an item inline (e.g. "creator only"). `label` names
 * what the menu acts on, for the trigger's `aria-label`.
 */
export function menuButton(items, { label = "More actions" } = {}) {
  const trigger = el("button", {
    type: "button",
    className: "icon-btn menu-trigger",
    attrs: { "aria-label": label, "aria-haspopup": "menu" },
  }, [icon("more", { size: 20 })]);

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    openActionMenu(trigger, items.filter(Boolean));
  });

  return trigger;
}

function openActionMenu(trigger, items) {
  const dialog = el("dialog", { className: "app-dialog menu-popover", attrs: { role: "menu" } });
  const itemButtons = items.map(({ label, icon: iconName, onSelect, danger }) => {
    const itemBtn = el(
      "button",
      { type: "button", className: `menu-item${danger ? " menu-item-danger" : ""}`, attrs: { role: "menuitem" } },
      [icon(iconName, { size: 18 }), el("span", { textContent: label })]
    );
    itemBtn.addEventListener("click", () => {
      dialog.close();
      onSelect();
    });
    return itemBtn;
  });
  dialog.append(...itemButtons);
  document.body.appendChild(dialog);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const at = itemButtons.indexOf(document.activeElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    itemButtons[(at + step + itemButtons.length) % itemButtons.length]?.focus();
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    trigger.focus();
  });

  dialog.showModal();
  if (window.innerWidth >= 760) {
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = dialog.getBoundingClientRect();
    const left = Math.min(triggerRect.left, window.innerWidth - menuRect.width - 16);
    const top = Math.min(triggerRect.bottom + 8, window.innerHeight - menuRect.height - 16);
    dialog.style.position = "fixed";
    dialog.style.margin = "0";
    dialog.style.top = `${Math.max(16, top)}px`;
    dialog.style.left = `${Math.max(16, left)}px`;
  }
  // preventScroll: focusing a just-repositioned fixed element can otherwise
  // trigger the browser's own scroll-into-view, undoing the position above.
  itemButtons[0]?.focus({ preventScroll: true });
}

/** Shows a native, accessible confirm dialog. `confirmLabel` names the action
 * itself ("Delete", "Remove", "Publish") rather than a generic "Confirm", per
 * the wording guide's "say what a button does, as a verb." Resolves true/false. */
export function confirmDialog(message, confirmLabel = "Confirm") {
  return new Promise((resolve) => {
    const dialog = el("dialog", { className: "app-dialog" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "button", className: "btn btn-danger", textContent: confirmLabel });
    dialog.append(
      el("p", { textContent: message }),
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn])
    );
    document.body.appendChild(dialog);

    function finish(result) {
      dialog.close();
      dialog.remove();
      resolve(result);
    }
    cancelBtn.addEventListener("click", () => finish(false));
    okBtn.addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", () => finish(false));
    dialog.showModal();
    okBtn.focus();
  });
}

/** Shows a native, accessible text-input dialog. Resolves the typed string, or null if cancelled. */
export function promptDialog(message, defaultValue = "") {
  return new Promise((resolve) => {
    const dialog = el("dialog", { className: "app-dialog" });
    const input = el("input", { type: "text", value: defaultValue, className: "prompt-input" });
    const label = el("label", { className: "prompt-label" }, [el("span", { textContent: message }), input]);
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Save" });
    const form = el("form", { method: "dialog" }, [
      label,
      el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
    ]);
    dialog.appendChild(form);
    document.body.appendChild(dialog);

    function finish(result) {
      dialog.close();
      dialog.remove();
      resolve(result);
    }
    cancelBtn.addEventListener("click", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      finish(input.value);
    });
    dialog.addEventListener("cancel", () => finish(null));
    dialog.showModal();
    input.focus();
    input.select();
  });
}

/**
 * Renders now, or waits until the user has finished typing inside `container`
 * (§8: a live update must never wipe an in-progress edit). Deferring rather than
 * simply skipping matters — a skipped render would otherwise leave the section
 * stale until some later snapshot happens to arrive while nothing is focused.
 */
export function renderWhenIdle(container, render) {
  const active = document.activeElement;
  const editing = container.contains(active) && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
  if (!editing) {
    render();
    return;
  }
  if (container.dataset.renderDeferred) return;
  container.dataset.renderDeferred = "1";
  container.addEventListener("focusout", function whenDone(event) {
    // Focus moving to another control in the same section is still editing.
    if (container.contains(event.relatedTarget)) return;
    container.removeEventListener("focusout", whenDone);
    delete container.dataset.renderDeferred;
    render();
  });
}

/** Reads the clipboard for Paste flight link (V4 §4.5). Resolves the text, or
 * null when the browser has no Clipboard API, refuses, or the user never
 * grants the permission prompt — the caller falls back to a text box the
 * owner pastes into by hand (iPhone shows its own Paste bubble there). */
export async function readClipboardText() {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) return null;
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

/** A labeled form field: a <label> wrapping a caption span and the given input/select/textarea. */
export function field(labelText, input) {
  return el("label", { className: "field" }, [el("span", { textContent: labelText }), input]);
}

/**
 * A link-paste box plus a Paste button, shared by the flight, stay and place
 * dialogs (T42). `onLink(text)` fires once for the box's current text: on
 * `paste` (next tick, since the value isn't updated yet when it fires), on
 * typing (debounced ~250ms), and right after the Paste button or `fill()`
 * sets the value — never twice in a row for the same text. Returns
 * `{ row, input, fill }`; `fill(text)` is also how a dialog's own
 * auto-read-on-open sets the box. `multiline` makes `input` a 2-row
 * `<textarea>` (the flight link sheet) instead of a single-line `<input>`.
 */
export function linkField({ placeholder, ariaLabel, onLink, multiline = false }) {
  const input = multiline
    ? el("textarea", { rows: 2, placeholder, attrs: { "aria-label": ariaLabel } })
    : el("input", { type: "text", placeholder, attrs: { "aria-label": ariaLabel } });

  let lastValue = null;
  function maybeFire() {
    if (input.value === lastValue) return;
    lastValue = input.value;
    onLink(input.value);
  }

  function fill(text) {
    input.value = text;
    maybeFire();
  }

  let debounceTimer = null;
  input.addEventListener("paste", () => setTimeout(maybeFire, 0));
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(maybeFire, 250);
  });

  const pasteBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Paste" });
  pasteBtn.addEventListener("click", async () => {
    const text = await readClipboardText();
    if (text == null) return;
    fill(text);
  });

  const row = el("div", { className: "input-row" }, [input, pasteBtn]);
  return { row, input, fill };
}

/**
 * Auto-read-on-open (T42 item 4): called once when a paste dialog opens from
 * a button tap. Reads the clipboard itself only when the box is still empty
 * and this isn't an edit — never otherwise, since that would read the
 * clipboard without a tap starting it for this box. Silently does nothing
 * when the clipboard is unreadable or doesn't look like a link.
 */
export async function autoReadLinkOnOpen({ input, fill }, { isEdit = false } = {}) {
  if (isEdit || input.value.trim()) return;
  const text = await readClipboardText();
  if (text != null && looksLikeLink(text)) fill(text);
}

/**
 * Builds and shows a modal <dialog> around a form. `buildForm(finish)` must
 * synchronously return `{ form, focusEl? }`; call `finish(result)` from a
 * submit/cancel handler to resolve. Resolves `null` on cancel (button or Esc).
 */
export function dialogShell(className, buildForm) {
  return new Promise((resolve) => {
    const dialog = el("dialog", { className: `app-dialog app-dialog-form ${className}` });
    const { form, focusEl } = buildForm((result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    });
    dialog.appendChild(form);
    document.body.appendChild(dialog);
    dialog.addEventListener("cancel", () => {
      dialog.remove();
      resolve(null);
    });
    dialog.showModal();
    (focusEl || form).focus();
  });
}

/** Show each person's pick as their initial. */
function rankSummary(votes, usersById) {
  const entries = Object.entries(votes || {});
  if (entries.length === 0) return null;

  const initials = entries.map(([uid]) => {
    const name = (usersById[uid] && usersById[uid].displayName) || "?";
    return name[0].toUpperCase();
  });
  const summaryText = initials.join(" ");
  return el("span", { className: "rank-summary", textContent: summaryText, title: entries.map(([uid, choice]) => {
    const name = (usersById[uid] && usersById[uid].displayName) || "Someone";
    return `${name}: ${choice}`;
  }).join("\n") });
}

// What each rank choice means, shown as a tooltip (wording guide).
const RANK_TOOLTIPS = { love: "Love it", like: "Like it", pass: "Pass" };

/**
 * The Must/Nice/Skip control (§7.3). Pressing the current choice again clears it.
 * `onVote(choice | null)` is called with the new choice; the caller writes votes.<uid>.
 */
export function rankControl({ votes = {}, myUid, usersById = {}, onVote }) {
  const current = votes[myUid] ?? null;
  const buttons = el(
    "div",
    { className: "rank-buttons" },
    ["love", "like", "pass"].map((choice) => {
      const pressed = current === choice;
      const btn = el("button", {
        type: "button",
        className: `btn btn-small rank-btn rank-${choice}${pressed ? " rank-btn-pressed" : ""}`,
        title: RANK_TOOLTIPS[choice],
        attrs: { "aria-pressed": pressed ? "true" : "false" },
      }, [icon(choice, { size: 16 }), el("span", { textContent: choice[0].toUpperCase() + choice.slice(1) })]);
      btn.addEventListener("click", () => onVote(pressed ? null : choice));
      return btn;
    })
  );
  const summary = rankSummary(votes, usersById);
  return el("div", { className: "rank-control" }, summary ? [buttons, summary] : [buttons]);
}

// Fixed list a traveler's avatar color is picked from, by their order in the
// trip's travelers array — stable regardless of who's signed in (R7 §6).
const AVATAR_COLORS = ["var(--forest)", "#2F76A8", "#A8507A", "#B98522", "#5463A6", "#2F8A80"];

/** A 28–32px initial avatar for a traveler, colored stably by their index in the travelers list (R7 §6). */
export function avatar(traveler, index = 0) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initial = ((traveler && traveler.name) || "?")[0].toUpperCase();
  return el("div", {
    className: "avatar avatar-initial",
    style: `background:${color};color:${index % AVATAR_COLORS.length === 0 ? "var(--on-forest)" : "#fff"}`,
    textContent: initial,
  });
}

/**
 * The route ribbon on Overview's summary card (R7 §6): a home dot, one
 * hollow dot per stop labelled "CODE · Nnights" (from `ribbonStops()` in
 * `js/lib/ribbon.js`), a home dot, joined by dotted connectors. `onDark`
 * draws the hollow dots, labels and connectors in `--on-forest` for the
 * forest summary card instead of `--forest`.
 */
export function routeRibbon(stops, { onDark = false } = {}) {
  const list = stops || [];
  const children = [];
  list.forEach((entry, index) => {
    if (index > 0) children.push(el("span", { className: "route-ribbon-connector", attrs: { "aria-hidden": "true" } }));
    children.push(ribbonEntryNode(entry));
  });
  return el("div", { className: `route-ribbon${onDark ? " route-ribbon-on-dark" : ""}` }, children);
}

function ribbonEntryNode(entry) {
  if (entry.home) {
    return el("span", { className: "route-ribbon-stop" }, [
      el("span", { className: "route-ribbon-dot route-ribbon-dot-home", attrs: { "aria-label": "Home" } }),
    ]);
  }
  if (entry.more) {
    return el("span", { className: "route-ribbon-stop" }, [el("span", { className: "route-ribbon-more", textContent: `+${entry.more}` })]);
  }
  return el("span", { className: "route-ribbon-stop" }, [
    el("span", { className: "route-ribbon-dot", attrs: { "aria-hidden": "true" } }),
    el("span", { className: "route-ribbon-label", textContent: `${entry.code || entry.label} · ${entry.nights}` }),
  ]);
}

/**
 * A list row (R7 §6): optional leading content (avatar, number, icon tile), a
 * title + optional muted subtitle, and optional trailing content (a value or
 * a ⋯ button). Renders as a link when `href` is given, a button when
 * `onClick` is given, else a plain div. Styled by `.list-row` (named apart
 * from the pre-existing `.row` flex-utility class to avoid colliding with it).
 */
export function row({ leading, title, subtitle, trailing, href, onClick } = {}) {
  const textBlock = el("div", { className: "list-row-text" }, [
    el("span", { className: "list-row-title", textContent: title }),
    subtitle ? el("span", { className: "list-row-subtitle", textContent: subtitle }) : null,
  ]);
  const children = [leading, textBlock, trailing];
  if (href) return el("a", { className: "list-row", href }, children);
  if (onClick) return el("button", { type: "button", className: "list-row", onclick: onClick }, children);
  return el("div", { className: "list-row" }, children);
}

/** Triggers a browser download of in-memory content, e.g. an export file (§7.10). */
export function downloadFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
