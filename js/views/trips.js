import { watchTrips, createTrip, deleteTrip } from "../store.js";
import { el, setPending, confirmDialog, promptDialog, friendlyError } from "../ui.js";
import { relativeTime } from "../lib/dates.js";

/** Renders the trips list (§7.2) into `container` and returns an unsubscribe function. */
export function renderTripsView(container, user) {
  const newTripBtn = el("button", { className: "btn btn-primary", textContent: "New trip" });
  const errorHolder = el("div", { className: "field-error-holder" });
  const list = el("div", { className: "trips-list" });

  newTripBtn.addEventListener("click", async () => {
    const name = await promptDialog("Name this trip");
    if (name === null) return;
    const trimmed = name.trim();
    errorHolder.replaceChildren();
    if (!trimmed) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Trip name can't be blank." }));
      return;
    }
    setPending(newTripBtn, true, "Creating…");
    try {
      const tripRef = await createTrip(trimmed, user);
      location.hash = `#/trip/${tripRef.id}`;
    } catch (err) {
      errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
    } finally {
      setPending(newTripBtn, false);
    }
  });

  function renderCard(trip) {
    const destinationLabel = trip.destination ? trip.destination.city : "Still exploring";
    const dateLabel = trip.startDate && trip.endDate ? `${trip.startDate} – ${trip.endDate}` : "Dates not set";
    const travelerNames = (trip.travelers || []).map((t) => t.name).filter(Boolean).join(", ");
    const updatedLabel = trip.updatedAt && trip.updatedAt.toDate ? `Updated ${relativeTime(trip.updatedAt.toDate())}` : "";

    const card = el("article", { className: "card trip-card" }, [
      el("h2", { className: "trip-card-title" }, [
        el("a", { className: "trip-card-link", href: `#/trip/${trip.id}`, textContent: trip.name }),
      ]),
      el("p", { className: "trip-card-meta", textContent: `${trip.status} · ${destinationLabel}` }),
      el("p", { className: "trip-card-meta", textContent: dateLabel }),
      el("p", { className: "trip-card-meta", textContent: travelerNames }),
      el("p", { className: "trip-card-updated", textContent: updatedLabel }),
    ]);

    if (trip.createdBy === user.uid) {
      const deleteBtn = el("button", { className: "btn btn-danger btn-small", textContent: "Delete" });
      deleteBtn.addEventListener("click", async () => {
        const confirmed = await confirmDialog(`Delete "${trip.name}"? This can't be undone.`);
        if (!confirmed) return;
        setPending(deleteBtn, true, "Deleting…");
        try {
          await deleteTrip(trip.id);
        } catch (err) {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
          setPending(deleteBtn, false);
        }
      });
      card.appendChild(deleteBtn);
    }

    return card;
  }

  const unsubscribe = watchTrips(
    (trips) => {
      if (trips.length === 0) {
        list.replaceChildren(el("p", { className: "empty-state", textContent: "No trips yet. Start one!" }));
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
