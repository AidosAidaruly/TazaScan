enum TazaScorePreviewStatus { calculated, insufficientData }

enum TazaScoreConfidence { high, medium, low }

class TazaScorePreviewData {
  const TazaScorePreviewData({
    required this.status,
    required this.methodologyVersion,
    required this.confidence,
    required this.ingredientAnalysisLabel,
    required this.processingLabel,
    this.score,
    this.maxScore = 100,
    this.nutritionComponent,
    this.nutritionMax = 90,
    this.ingredientComponent,
    this.ingredientMax = 10,
    this.nutriScoreGrade,
    this.reasonLabels = const [],
    this.technicalReasonLabels = const [],
    this.missingFields = const [],
    this.missingCriticalFields = const [],
    this.nutritionCoverage,
    this.scoreBeforeSafeguard,
    this.scoreCap,
    this.safeguardsApplied = const [],
  });

  final TazaScorePreviewStatus status;
  final int? score;
  final int maxScore;
  final int? nutritionComponent;
  final int nutritionMax;
  final int? ingredientComponent;
  final int ingredientMax;
  final String? nutriScoreGrade;
  final TazaScoreConfidence confidence;
  final List<String> reasonLabels;
  final List<String> technicalReasonLabels;
  final List<String> missingFields;
  final List<String> missingCriticalFields;
  final double? nutritionCoverage;
  final int? scoreBeforeSafeguard;
  final int? scoreCap;
  final List<String> safeguardsApplied;
  final String methodologyVersion;
  final String ingredientAnalysisLabel;
  final String processingLabel;

  bool get isPartialData =>
      status == TazaScorePreviewStatus.calculated &&
      (nutritionCoverage != null && nutritionCoverage! < 1);

  bool get hasSafeguardApplied => safeguardsApplied.isNotEmpty;
}
