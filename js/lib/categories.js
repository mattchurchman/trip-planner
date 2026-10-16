// Pure: the place categories and their colors (§4). No DOM, no Firebase.

// Colors are R7's muted set (docs/R7.md §2): one family, toned down to sit
// under the brand instead of louder than it.
export const CATEGORIES = [
  { label: "Food", color: "#C2602F" },
  { label: "Coffee & cafés", color: "#8B6B4E" },
  { label: "Drinks & nightlife", color: "#7E5AA2" },
  { label: "Neighborhood walk", color: "#4F8A4E" },
  { label: "Sight", color: "#2F76A8" },
  { label: "Museum & history", color: "#8A7A33" },
  { label: "Walking tour", color: "#2F8A80" },
  { label: "Event & seasonal", color: "#B8483F" },
  { label: "Adventure", color: "#B98522" },
  { label: "Day trip", color: "#5463A6" },
  { label: "Shopping", color: "#A8507A" },
  { label: "Other", color: "#6E7470" },
];

/** Returns the color for a category label, or the "Other" color for unknown labels. */
export function categoryColor(label) {
  const category = CATEGORIES.find((c) => c.label === label);
  return category ? category.color : CATEGORIES[CATEGORIES.length - 1].color;
}
