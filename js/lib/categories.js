// Pure: the place categories and their colors (§4). No DOM, no Firebase.

export const CATEGORIES = [
  { label: "Food", color: "#e8710a" },
  { label: "Coffee & cafés", color: "#795548" },
  { label: "Drinks & nightlife", color: "#9334e6" },
  { label: "Neighborhood walk", color: "#188038" },
  { label: "Sight", color: "#1a73e8" },
  { label: "Museum & history", color: "#827717" },
  { label: "Walking tour", color: "#00897b" },
  { label: "Event & seasonal", color: "#d93025" },
  { label: "Adventure", color: "#f9ab00" },
  { label: "Day trip", color: "#3949ab" },
  { label: "Shopping", color: "#c2185b" },
  { label: "Other", color: "#5f6368" },
];

/** Returns the color for a category label, or the "Other" color for unknown labels. */
export function categoryColor(label) {
  const category = CATEGORIES.find((c) => c.label === label);
  return category ? category.color : CATEGORIES[CATEGORIES.length - 1].color;
}
