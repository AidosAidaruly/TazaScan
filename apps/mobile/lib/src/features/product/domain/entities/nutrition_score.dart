class NutritionScore {
  const NutritionScore({
    required this.status,
    required this.positiveReasons,
    required this.negativeReasons,
    required this.warnings,
    required this.missingFields,
    required this.algorithm,
    required this.algorithmVersion,
    required this.calculatedAt,
    this.score,
    this.grade,
  });

  final int? score;
  final String? grade;
  final String status;
  final List<String> positiveReasons;
  final List<String> negativeReasons;
  final List<String> warnings;
  final List<String> missingFields;
  final String algorithm;
  final String algorithmVersion;
  final DateTime calculatedAt;
}
