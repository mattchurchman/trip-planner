// Pure: the place categories and their colors (§4). No DOM, no Firebase.

// The category list, colors, and icon names from SPEC.md §4.
export const CATEGORIES = [
  { label: "Food & Dining", color: "#C2602F", icon: "food" },
  { label: "Coffee & Cafés", color: "#8B6B4E", icon: "coffee" },
  { label: "Bars & Nightlife", color: "#7E5AA2", icon: "drinks" },
  { label: "Neighborhoods & Walks", color: "#2F8A80", icon: "walk" },
  { label: "Sights & Landmarks", color: "#2F76A8", icon: "sight" },
  { label: "Arts, Museums & Culture", color: "#8A7A33", icon: "museum" },
  { label: "Events & Seasonal", color: "#B8483F", icon: "event" },
  { label: "Sports & Recreation", color: "#6E8E2A", icon: "sports" },
  { label: "Nature & Outdoors", color: "#4F8A4E", icon: "nature" },
  { label: "Adventure & Experiences", color: "#B98522", icon: "adventure" },
  { label: "Day Trips", color: "#5463A6", icon: "daytrip" },
  { label: "Shopping & Markets", color: "#A8507A", icon: "shopping" },
  { label: "Other", color: "#6E7470", icon: "place" },
];

/** Returns the color for a category label, or the "Other" color for unknown labels. */
export function categoryColor(label) {
  const category = CATEGORIES.find((c) => c.label === label);
  return category ? category.color : CATEGORIES[CATEGORIES.length - 1].color;
}

/** Returns a category's icon name, or the generic place icon for old labels. */
export function categoryIcon(label) {
  const category = CATEGORIES.find((c) => c.label === label);
  return category ? category.icon : "place";
}
