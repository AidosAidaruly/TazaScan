import 'package:project/src/features/product/domain/entities/nutrition_score.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/entities/halal_check.dart';
import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/data/models/product_score_preview_model.dart';

class ProductModel extends Product {
  const ProductModel({
    required super.id,
    required super.barcode,
    required super.name,
    required super.ingredients,
    required super.nutritionFacts,
    required super.healthScore,
    required super.nutritionScore,
    required super.createdAt,
    required super.updatedAt,
    required super.dataStatus,
    super.source,
    super.scoreSource,
    super.ingredientsIsTranslated,
    super.halalCheck,
    super.tazaScore,
    super.brand,
    super.category,
    super.imageUrl,
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      id: json['id'] as String,
      barcode: json['barcode'] as String,
      name: json['name'] as String,
      brand: json['brand'] as String?,
      category: json['category'] as String?,
      imageUrl: json['imageUrl'] as String?,
      ingredients: List<String>.from(json['ingredients'] as List),
      nutritionFacts: Map<String, dynamic>.from(json['nutritionFacts'] as Map),
      healthScore: json['healthScore'] as int,
      nutritionScore: NutritionScoreModel.fromJson(
        Map<String, dynamic>.from(json['nutritionScore'] as Map? ?? {}),
        fallbackScore: json['healthScore'] as int,
        fallbackDate: json['updatedAt'] as String,
      ),
      tazaScore: _parseTazaScore(json['tazaScore']),
      halalCheck: _parseHalalCheck(json['halalCheck']),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      dataStatus: json['dataStatus'] as String? ?? 'unverified',
      source: json['source'] as String?,
      scoreSource: json['scoreSource'] as String? ?? 'product_record',
      ingredientsIsTranslated: json['ingredientsIsTranslated'] as bool? ?? false,
    );
  }

  static TazaScorePreviewData? _parseTazaScore(Object? value) {
    if (value is! Map<String, dynamic>) {
      return null;
    }

    final officialNutriScore = value['officialNutriScore'];
    final nutriScore = officialNutriScore is Map<String, dynamic>
        ? officialNutriScore
        : const <String, dynamic>{};

    return ProductScorePreviewModel.fromJson({
      'tazaScore': value,
      'nutriScore': nutriScore,
    }).tazaScore;
  }

  static HalalCheck? _parseHalalCheck(Object? value) {
    if (value is! Map<String, dynamic>) {
      return null;
    }

    final signalsJson = value['matchedSignals'];
    final certificationJson = value['certification'];
    final ingredientScreeningJson = value['ingredientScreening'];

    return HalalCheck(
      status: _parseHalalStatus(value['status']),
      ingredientScreeningStatus: _parseIngredientScreeningStatus(
        ingredientScreeningJson is Map
            ? ingredientScreeningJson['status']
            : value['ingredientScreeningStatus'],
      ),
      reasons: NutritionScoreModel._stringList(value['reasons']),
      matchedSignals: signalsJson is List
          ? signalsJson
              .whereType<Map>()
              .map(
                (signal) => HalalMatchedSignal(
                  reasonCode: signal['reasonCode']?.toString() ?? '',
                  severity: signal['severity']?.toString() ?? '',
                  matchedText: signal['matchedText']?.toString() ?? '',
                ),
              )
              .where((signal) => signal.reasonCode.isNotEmpty)
              .toList()
          : const [],
      certificationStatus: certificationJson is Map
          ? certificationJson['status']?.toString() ?? 'not_verified'
          : 'not_verified',
      methodology: value['methodology']?.toString() ?? 'halal-check-v1.2',
    );
  }

  static HalalCheckStatus _parseHalalStatus(Object? value) {
    return switch (value?.toString()) {
      'halal_confirmed' => HalalCheckStatus.halalConfirmed,
      'screening_clear' => HalalCheckStatus.screeningClear,
      'non_halal' => HalalCheckStatus.nonHalal,
      'review_required' => HalalCheckStatus.reviewRequired,
      _ => HalalCheckStatus.insufficientData,
    };
  }

  static HalalIngredientScreeningStatus _parseIngredientScreeningStatus(
    Object? value,
  ) {
    return switch (value?.toString()) {
      'clear' => HalalIngredientScreeningStatus.clear,
      'review_required' => HalalIngredientScreeningStatus.reviewRequired,
      'non_halal_detected' =>
        HalalIngredientScreeningStatus.nonHalalDetected,
      _ => HalalIngredientScreeningStatus.insufficientData,
    };
  }
}

class NutritionScoreModel extends NutritionScore {
  NutritionScoreModel.fromJson(
    Map<String, dynamic> json, {
    required int fallbackScore,
    required String fallbackDate,
  }) : super(
         score: json['score'] as int? ?? fallbackScore,
         grade: json['grade'] as String?,
         status: json['status'] as String? ?? 'insufficient_data',
         positiveReasons: _stringList(json['positiveReasons']),
         negativeReasons: _stringList(json['negativeReasons']),
         warnings: _stringList(json['warnings']),
         missingFields: _stringList(json['missingFields']),
         algorithm: json['algorithm'] as String? ?? 'unknown',
         algorithmVersion: json['algorithmVersion'] as String? ?? 'unknown',
         calculatedAt: DateTime.parse(
           json['calculatedAt'] as String? ?? fallbackDate,
         ),
       );

  static List<String> _stringList(Object? value) {
    if (value is List) {
      return value.map((item) => item.toString()).toList();
    }

    return const [];
  }
}
