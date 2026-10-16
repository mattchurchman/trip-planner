import { watchTrips, createTrip, deleteTrip } from "../store.js";
import { el, icon, confirmDialog, promptDialog, friendlyError, menuButton, avatar } from "../ui.js";
import { formatDateRange, nightsBetween } from "../lib/dates.js";
import { tripStage } from "../lib/stage.js";

function todayString() {
  const today = new Date();
  return today.toISOString().slice(0, 10);
}

/** "Apr 10 – 22, 2027 · 12 nights", or "Dates not set" (R7 §7). */
function dateLine(trip) {
  const range = formatDateRange(trip.startDate, trip.endDate);
  if (range === "Dates not set") return range;
  const nights = nightsBetween(trip.startDate, trip.endDate);
  return nights ? `${range} · ${nights} night${nights === 1 ? "" : "s"}` : range;
}

/** Renders the trips list (§7.2) into `container` and returns an unsubscribe function. */
export function renderTripsView(container, user) {
  const newTripLabel = el("span", { textContent: "New trip" });
  const newTripBtn = el("button", { className: "btn btn-primary" }, [icon("plus", { size: 16 }), newTripLabel]);
  const errorHolder = el("div", { className: "field-error-holder" });
  const list = el("div", { className: "trips-list" });

  async function createTripFlow() {
    const name = await promptDialog("Name this trip");
    if (name === null) return;
    const trimmed = name.trim();
    errorHolder.replaceChildren();
    if (!trimmed) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Trip name can't be blank." }));
      return;
    }
    newTripBtn.disabled = true;
    newTripLabel.textContent = "Creating…";
    try {
      const tripRef = await createTrip(trimmed, user);
      location.hash = `#/trip/${tripRef.id}`;
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      newTripBtn.disabled = false;
      newTripLabel.textContent = "New trip";
    }
  }
  newTripBtn.addEventListener("click", createTripFlow);

  function renderCard(trip) {
    const travelers = trip.travelers || [];
    const stage = tripStage(trip, todayString());
    const stageBadge = el("span", { className: `stage-badge stage-${stage.key}`, textContent: stage.shortLabel });
    const isFuture = Boolean(trip.startDate) && trip.startDate > todayString();

    const header = el("div", { className: `trip-card-header ${isFuture ? "trip-card-header-forest" : "trip-card-header-paper"}` }, [
      stageBadge,
    ]);

    const avatars = el(
      "div",
      { className: "trip-card-avatars" },
      travelers.map((traveler, index) => avatar(traveler, index))
    );

    const body = el("div", { className: "trip-card-body" }, [
      el("h2", { className: "trip-card-title" }, [
        el("a", { className: "trip-card-link", href: `#/trip/${trip.id}`, textContent: trip.name }),
      ]),
      el("p", { className: "trip-card-meta", textContent: dateLine(trip) }),
      el("div", { className: "trip-card-footer" }, [avatars]),
    ]);

    // Not an <a>: a stretched ::after on .trip-card-link (R7 §7 "whole card is
    // one link") covers the card, but a button can't nest inside that <a>, so
    // ⋯ stays a sibling, raised above it with z-index (see css).
    const card = el("article", { className: "card trip-card" }, [header, body]);

    if (trip.createdBy === user.uid) {
      async function handleDelete() {
        const confirmed = await confirmDialog(`Delete "${trip.name}"? This can't be undone.`, "Delete");
        if (!confirmed) return;
        try {
          await deleteTrip(trip.id);
        } catch (err) {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
        }
      }
      card.querySelector(".trip-card-footer").appendChild(
        menuButton([{ label: "Delete", icon: "trash", onSelect: handleDelete, danger: true }], { label: `More actions for ${trip.name}` })
      );
    }

    return card;
  }

  const unsubscribe = watchTrips(
    (trips) => {
      if (trips.length === 0) {
        list.replaceChildren(
          el("div", { className: "empty-state trips-empty" }, [
            icon("map", { size: 32 }),
            el("p", { textContent: "No trips yet." }),
            el("button", { className: "btn btn-primary", textContent: "New trip", onclick: createTripFlow }),
          ])
        );
        return;
      }
      list.replaceChildren(...trips.map(renderCard));
    },
    (err) => list.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );

  container.replaceChildren(
    el("div", { className: "trips-header" }, [el("h1", { textContent: "Your trips" }), newTripBtn]),
    errorHolder,
    list
  );

  return unsubscribe;
}
