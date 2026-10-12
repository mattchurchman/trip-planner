// The "Import from My Maps" dialog (T26, V4 §6): pick a KML file exported
// from Google My Maps, review a per-layer summary with a category for each
// layer, and add the pins that aren't already in the trip.
import { el, field, dialogShell } from "../ui.js";
import { parseKml, findDuplicates } from "../lib/kmlimport.js";
import { CATEGORIES } from "../lib/categories.js";

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function layerRow(layer, duplicateCount) {
  const categorySelect = el(
    "select",
    { attrs: { "aria-label": `Category for ${layer.name || "Unfiled"}` } },
    CATEGORIES.map((c) => el("option", { value: c.label, textContent: c.label }))
  );
  categorySelect.value = "Other";
  const countText =
    duplicateCount > 0
      ? `${layer.pins.length} pin${layer.pins.length === 1 ? "" : "s"} (${duplicateCount} already here)`
      : `${layer.pins.length} pin${layer.pins.length === 1 ? "" : "s"}`;
  const row = el("div", { className: "kml-import-layer-row" }, [
    el("div", {}, [el("strong", { textContent: layer.name || "Unfiled" }), el("p", { className: "muted", textContent: countText })]),
    field("Category", categorySelect),
  ]);
  return { row, categorySelect };
}

/**
 * Shows the import dialog. `places` is the trip's current places, used to
 * skip duplicates (same name, within 50m). Resolves `null` on cancel, or
 * `{ toAdd, duplicateCount }` — `toAdd` is `[{ name, lat, lng, note, layer, category }]`
 * ready for `addPlacesBatch`, already excluding duplicates.
 */
export function importFromMyMapsDialog({ places }) {
  return dialogShell("kml-import-dialog", (finish) => {
    const title = el("h2", { textContent: "Import from My Maps" });
    const fileInput = el("input", { type: "file", accept: ".kml", attrs: { "aria-label": "KML file" } });
    const errorEl = el("p", { className: "field-error", hidden: true });
    const summaryEl = el("div", { className: "kml-import-summary", hidden: true });
    const cancelBtn = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    const okBtn = el("button", { type: "submit", className: "btn btn-primary", textContent: "Add places", disabled: true });

    let parsedLayers = []; // [{ layer, duplicateFlags, categorySelect }]

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      summaryEl.hidden = true;
      okBtn.disabled = true;
      parsedLayers = [];
    }

    function updateOkLabel() {
      const totalPins = parsedLayers.reduce((sum, l) => sum + l.layer.pins.length, 0);
      const duplicateCount = parsedLayers.reduce((sum, l) => sum + l.duplicateFlags.filter(Boolean).length, 0);
      const toAddCount = totalPins - duplicateCount;
      okBtn.textContent = duplicateCount > 0 ? `Add ${toAddCount} places (${duplicateCount} already here)` : `Add ${toAddCount} places`;
      okBtn.disabled = toAddCount === 0;
    }

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      errorEl.hidden = true;
      let text;
      try {
        text = await readFileAsText(file);
      } catch {
        showError("Couldn't read that file. Try again.");
        return;
      }
      const { layers, error } = parseKml(text);
      if (error) {
        showError(error);
        return;
      }
      if (layers.every((l) => l.pins.length === 0)) {
        showError("No pins found in that file.");
        return;
      }
      parsedLayers = layers
        .filter((l) => l.pins.length > 0)
        .map((layer) => ({ layer, duplicateFlags: findDuplicates(layer.pins, places), categorySelect: null }));
      const rows = parsedLayers.map((entry) => {
        const duplicateCount = entry.duplicateFlags.filter(Boolean).length;
        const { row, categorySelect } = layerRow(entry.layer, duplicateCount);
        entry.categorySelect = categorySelect;
        return row;
      });
      summaryEl.replaceChildren(...rows);
      summaryEl.hidden = false;
      updateOkLabel();
    });

    const form = el(
      "form",
      {
        method: "dialog",
        onsubmit: (event) => {
          event.preventDefault();
          const toAdd = [];
          for (const { layer, duplicateFlags, categorySelect } of parsedLayers) {
            layer.pins.forEach((pin, i) => {
              if (duplicateFlags[i]) return;
              toAdd.push({ name: pin.name, lat: pin.lat, lng: pin.lng, note: pin.note, layer: layer.name, category: categorySelect.value });
            });
          }
          const duplicateCount = parsedLayers.reduce((sum, l) => sum + l.duplicateFlags.filter(Boolean).length, 0);
          finish({ toAdd, duplicateCount });
        },
      },
      [
        title,
        el("p", { className: "muted", textContent: 'Export your map from My Maps: ⋮ → Export to KML/KMZ, tick "Export as KML instead of KMZ".' }),
        field("KML file", fileInput),
        errorEl,
        summaryEl,
        el("div", { className: "dialog-actions" }, [cancelBtn, okBtn]),
      ]
    );
    cancelBtn.addEventListener("click", () => finish(null));
    return { form, focusEl: fileInput };
  });
}
