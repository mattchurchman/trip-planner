// Shared DOM helpers. No Firebase imports here.

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

/** Translates a Firestore/auth error into a message the owner's friends can act on. */
export function friendlyError(err) {
  if (err && err.code === "permission-denied") {
    return "You don't have access. Are you signed in with the approved account?";
  }
  return (err && err.message) || "Something went wrong.";
}

/** Shows a native, accessible confirm dialog. Resolves true/false. */
export function confirmDialog(message) {
  return new Promise((resolve) => {
    const dialog = el("dialog", { className: "app-dialog" });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "button", className: "btn btn-danger", textContent: "Confirm" });
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
