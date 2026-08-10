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
  final String methodologyVersion;
  final String ingredientAnalysisLabel;
  final String processingLabel;
}
