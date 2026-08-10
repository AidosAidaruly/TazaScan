const nonSugarSweetenerPatterns = [
  /\baspartame\b/i,
  /\bacesulfame[\s-]?k\b/i,
  /\bacesulfame potassium\b/i,
  /\bsucralose\b/i,
  /\bsaccharin\b/i,
  /\bcyclamate\b/i,
  /\bsteviol glycosides?\b/i,
  /\bstevia\b/i,
  /\bneotame\b/i,
  /\badvantame\b/i,
  /\bthaumatin\b/i,
  /\bаспартам\b/i,
  /\bсукралоз/i,
  /\bсахарин\b/i,
  /\bцикламат\b/i,
  /\bстеви/i
] as const;

export function detectNonSugarSweeteners(ingredients: string[]) {
  return ingredients.some((ingredient) =>
    nonSugarSweetenerPatterns.some((pattern) => pattern.test(ingredient))
  );
}
