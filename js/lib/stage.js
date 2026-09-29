// Pure: compute a trip's stage (exploring/planning/upcoming/now/done) from
// its dates, never by reading the current time. No DOM, no Firebase.

/** Returns { key, label, shortLabel } based on destination and dates. */
export function tripStage(trip, today) {
  if (!trip.destinationId) {
    return {
      key: "exploring",
      label: "Exploring",
      shortLabel: "Exploring",
    };
  }
  if (!trip.startDate) {
    return {
      key: "planning",
      label: "Planning",
      shortLabel: "Planning",
    };
  }

  const todayDate = new Date(`${today}T00:00:00Z`);
  const startDate = new Date(`${trip.startDate}T00:00:00Z`);
  const endDate = trip.endDate ? new Date(`${trip.endDate}T00:00:00Z`) : null;

  if (todayDate < startDate) {
    // Days until start (whole days).
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntil = Math.floor((startDate - todayDate) / msPerDay);
    const label = daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`;
    return {
      key: "upcoming",
      label,
      shortLabel: label,
    };
  }

  // Today is from startDate through endDate (or just startDate if no end).
  const untilDate = endDate || startDate;
  if (todayDate <= untilDate) {
    return {
      key: "now",
      label: "Happening now",
      shortLabel: "Happening now",
    };
  }

  // Today is after the trip.
  return {
    key: "done",
    label: "Trip's over — add your recap",
    shortLabel: "Trip's over",
  };
}
