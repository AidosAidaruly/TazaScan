import 'package:project/src/features/product_submission/domain/entities/submission_ocr_candidate.dart';

class NutritionOcrCandidateModel {
  static NutritionOcrCandidate fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    final nutritionJson = data['nutrition'] as Map<String, dynamic>? ?? {};

    return NutritionOcrCandidate(
      nutrition: nutritionJson.map(
        (key, value) => MapEntry(
          key,
          _numberCandidate(value as Map<String, dynamic>?),
        ),
      ),
      detectedBasis: data['detectedBasis'] as String? ?? 'unknown',
      warnings: _stringList(data['warnings']),
    );
  }
}

class IngredientsOcrCandidateModel {
  static IngredientsOcrCandidate fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    final ingredientsJson =
        data['ingredientsText'] as Map<String, dynamic>? ?? {};

    return IngredientsOcrCandidate(
      value: ingredientsJson['value'] as String?,
      confidence: ingredientsJson['confidence'] as String? ?? 'not_detected',
      detectedLanguage:
          ingredientsJson['detectedLanguage'] as String? ?? 'unknown',
      warnings: _stringList(data['warnings']),
    );
  }
}

OcrNumberCandidate _numberCandidate(Map<String, dynamic>? json) {
  final rawValue = json?['value'];

  return OcrNumberCandidate(
    value: rawValue is num ? rawValue.toDouble() : null,
    confidence: json?['confidence'] as String? ?? 'not_detected',
  );
}

List<String> _stringList(Object? value) {
  if (value is! List) {
    return const [];
  }

  return value.whereType<String>().toList(growable: false);
}
