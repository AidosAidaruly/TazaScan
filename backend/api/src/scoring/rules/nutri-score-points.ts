export function pointsFromThresholds(value: number, thresholds: number[]) {
  return thresholds.reduce((points, threshold) => (value > threshold ? points + 1 : points), 0);
}

export function gradeFood(score: number) {
  if (score <= -1) return 'A';
  if (score <= 2) return 'B';
  if (score <= 10) return 'C';
  if (score <= 18) return 'D';
  return 'E';
}

export function gradeBeverage(score: number) {
  if (score <= 1) return 'B';
  if (score <= 5) return 'C';
  if (score <= 9) return 'D';
  return 'E';
}
