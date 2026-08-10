import type {
  OfficialNutriScoreCategory,
  OfficialNutriScoreGrade
} from '../types/official-nutri-score-result';

export function pointsFromThresholds(value: number, thresholds: readonly number[]) {
  return thresholds.reduce((points, threshold) => (value > threshold ? points + 1 : points), 0);
}

export function generalEnergyPoints(energyKj: number) {
  return pointsFromThresholds(energyKj, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]);
}

export function beverageEnergyPoints(energyKj: number) {
  return pointsFromThresholds(energyKj, [30, 90, 150, 210, 240, 270, 300, 330, 360, 390]);
}

export function fatsOilsEnergyPoints(saturatedFat: number) {
  return pointsFromThresholds(saturatedFat * 37, [120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200]);
}

export function generalSugarPoints(sugars: number) {
  return pointsFromThresholds(sugars, [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51]);
}

export function beverageSugarPoints(sugars: number) {
  return pointsFromThresholds(sugars, [0.5, 2, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5]);
}

export function saturatedFatPoints(saturatedFat: number) {
  return pointsFromThresholds(saturatedFat, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
}

export function fatsOilsSaturatedFatRatioPoints(saturatedFat: number, fat: number) {
  if (fat <= 0) return 0;
  const ratio = (saturatedFat / fat) * 100;
  return pointsFromThresholds(ratio, [10, 16, 22, 28, 34, 40, 46, 52, 58, 64]);
}

export function saltPoints(salt: number) {
  return pointsFromThresholds(
    salt,
    [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4]
  );
}

export function fiberPoints(fiber: number) {
  return pointsFromThresholds(fiber, [3, 4.1, 5.2, 6.3, 7.4]);
}

export function generalProteinPoints(protein: number) {
  return pointsFromThresholds(protein, [2.4, 4.8, 7.2, 9.6, 12, 14, 17]);
}

export function beverageProteinPoints(protein: number) {
  return pointsFromThresholds(protein, [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3]);
}

export function generalFruitVegetableLegumePoints(percent: number) {
  if (percent > 80) return 5;
  if (percent > 60) return 2;
  if (percent > 40) return 1;
  return 0;
}

export function beverageFruitVegetableLegumePoints(percent: number) {
  if (percent > 80) return 6;
  if (percent > 60) return 4;
  if (percent > 40) return 2;
  return 0;
}

export function gradeOfficialNutriScore(
  category: OfficialNutriScoreCategory,
  rawScore: number
): OfficialNutriScoreGrade {
  if (category === 'water') return 'A';

  if (category === 'beverage') {
    if (rawScore <= 2) return 'B';
    if (rawScore <= 6) return 'C';
    if (rawScore <= 9) return 'D';
    return 'E';
  }

  if (category === 'fats_oils_nuts_seeds') {
    if (rawScore <= -6) return 'A';
    if (rawScore <= 2) return 'B';
    if (rawScore <= 10) return 'C';
    if (rawScore <= 18) return 'D';
    return 'E';
  }

  if (rawScore <= 0) return 'A';
  if (rawScore <= 2) return 'B';
  if (rawScore <= 10) return 'C';
  if (rawScore <= 18) return 'D';
  return 'E';
}
