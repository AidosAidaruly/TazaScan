class OcrNumberCandidate {
  const OcrNumberCandidate({
    required this.value,
    required this.confidence,
  });

  final double? value;
  final String confidence;

  bool get detected => value != null && confidence == 'detected';
}

class NutritionOcrCandidate {
  const NutritionOcrCandidate({
    required this.nutrition,
    required this.detectedBasis,
    required this.warnings,
  });

  final Map<String, OcrNumberCandidate> nutrition;
  final String detectedBasis;
  final List<String> warnings;
}

class IngredientsOcrCandidate {
  const IngredientsOcrCandidate({
    required this.value,
    required this.confidence,
    required this.detectedLanguage,
    required this.warnings,
  });

  final String? value;
  final String confidence;
  final String detectedLanguage;
  final List<String> warnings;
}
