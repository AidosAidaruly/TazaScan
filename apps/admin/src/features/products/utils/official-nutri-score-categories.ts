// Options for the Nutri-Score category select, shared by the product form and the
// submission approval form. "" means unknown and is sent as null.
export const officialNutriScoreCategories = [
  ["", "Unknown"],
  ["general_food", "General food"],
  ["beverage", "Beverage"],
  ["water", "Water"],
  ["cheese", "Cheese"],
  ["fats_oils_nuts_seeds", "Fats, oils, nuts, seeds"],
  ["red_meat", "Red meat"],
] as const;
