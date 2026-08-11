import 'package:project/src/features/product/domain/entities/taza_score_preview.dart';
import 'package:project/src/features/product/presentation/widgets/product_presentation_localization.dart';

class ProductScorePreviewModel {
  const ProductScorePreviewModel({
    required this.tazaScore,
    required this.nutriScore,
  });

  final TazaScorePreviewData tazaScore;
  final NutriScorePreviewModel nutriScore;

  factory ProductScorePreviewModel.fromJson(Map<String, dynamic> json) {
    final tazaScoreJson = _readObject(json, 'tazaScore');
    final nutriScoreJson = _readObject(json, 'nutriScore');
    final confidenceJson = _readObject(tazaScoreJson, 'confidence');
    final nutritionJson = _readObject(tazaScoreJson, 'nutritionComponent');
    final ingredientJson = _readObject(tazaScoreJson, 'ingredientComponent');
    final nutriScore = NutriScorePreviewModel.fromJson(nutriScoreJson);
    final status = _status(tazaScoreJson['status']);

    return ProductScorePreviewModel(
      nutriScore: nutriScore,
      tazaScore: TazaScorePreviewData(
        status: status,
        score: _readInt(tazaScoreJson['score']),
        maxScore: 100,
        nutritionComponent: _readInt(nutritionJson['score']),
        nutritionMax: _readInt(nutritionJson['maxScore']) ?? 90,
        ingredientComponent: _readInt(ingredientJson['score']),
        ingredientMax: _readInt(ingredientJson['maxScore']) ?? 10,
        nutriScoreGrade: nutriScore.grade,
        confidence: _confidence(confidenceJson['level']),
        reasonLabels: _consumerReasonLabels(tazaScoreJson),
        technicalReasonLabels: _technicalReasonLabels(tazaScoreJson),
        missingFields: _localizedFields(tazaScoreJson['missingFields']),
        missingCriticalFields: _localizedFields(
          tazaScoreJson['missingCriticalFields'],
        ),
        nutritionCoverage: _readDouble(tazaScoreJson['nutritionCoverage']),
        scoreBeforeSafeguard: _readInt(tazaScoreJson['scoreBeforeSafeguard']),
        scoreCap: _readInt(tazaScoreJson['scoreCap']),
        safeguardsApplied: _stringList(tazaScoreJson['safeguardsApplied']),
        methodologyVersion: _methodologyVersion(
          tazaScoreJson['methodologyVersion'],
        ),
        ingredientAnalysisLabel: 'Информационный анализ',
        processingLabel: 'Пока не учитывается в TazaScore',
      ),
    );
  }

  static Map<String, dynamic> _readObject(
    Map<String, dynamic> json,
    String key,
  ) {
    final value = json[key];
    if (value is Map<String, dynamic>) {
      return value;
    }

    throw FormatException('Expected $key object.');
  }

  static int? _readInt(Object? value) {
    if (value is int) return value;
    if (value is num) return value.round();
    return null;
  }

  static double? _readDouble(Object? value) {
    if (value is num) return value.toDouble();
    return null;
  }

  static TazaScorePreviewStatus _status(Object? value) {
    return switch (value) {
      'calculated' => TazaScorePreviewStatus.calculated,
      _ => TazaScorePreviewStatus.insufficientData,
    };
  }

  static TazaScoreConfidence _confidence(Object? value) {
    return switch (value) {
      'high' => TazaScoreConfidence.high,
      'medium' => TazaScoreConfidence.medium,
      _ => TazaScoreConfidence.low,
    };
  }

  static List<String> _consumerReasonLabels(
    Map<String, dynamic> tazaScoreJson,
  ) {
    final values = [
      ..._sortConsumerCodes(
        _stringList(tazaScoreJson['reasonCodes']).where(_isConsumerReasonCode),
      ),
      ..._stringList(
        tazaScoreJson['negativeReasons'],
      ).where(_isSpecificReadableReason),
      ..._stringList(
        tazaScoreJson['warnings'],
      ).where(_isSpecificReadableReason),
      ..._stringList(
        tazaScoreJson['positiveReasons'],
      ).where(_isSpecificReadableReason),
    ];
    final labels = <String>[];

    for (final value in values) {
      final label = ProductPresentationLocalization.insight(value);
      if (!labels.contains(label)) {
        labels.add(label);
      }
    }

    return labels.take(3).toList();
  }

  static List<String> _technicalReasonLabels(
    Map<String, dynamic> tazaScoreJson,
  ) {
    final values = [
      ..._stringList(
        tazaScoreJson['reasonCodes'],
      ).where((value) => !_isConsumerReasonCode(value)),
      ..._stringList(
        tazaScoreJson['negativeReasons'],
      ).where((value) => !_isSpecificReadableReason(value)),
      ..._stringList(
        tazaScoreJson['warnings'],
      ).where((value) => !_isSpecificReadableReason(value)),
    ];
    final labels = <String>[];

    for (final value in values) {
      final label = ProductPresentationLocalization.insight(value);
      if (!labels.contains(label)) {
        labels.add(label);
      }
    }

    return labels;
  }

  static List<String> _sortConsumerCodes(Iterable<String> codes) {
    final values = codes.toList();
    values.sort(
      (left, right) =>
          _consumerPriority(left).compareTo(_consumerPriority(right)),
    );
    return values;
  }

  static bool _isConsumerReasonCode(String value) {
    return _consumerPriority(value) < 100;
  }

  static int _consumerPriority(String value) {
    return switch (value.trim().toUpperCase()) {
      'HIGH_SUGAR' => 0,
      'HIGH_SALT' => 1,
      'HIGH_SATURATED_FAT' => 2,
      'HIGH_ENERGY' => 3,
      'CONTAINS_NON_SUGAR_SWEETENERS' || 'NON_SUGAR_SWEETENERS' => 4,
      'LOW_FAVORABLE_COMPONENTS' || 'LOW_FAVORABLE_NUTRITIONAL_COMPONENTS' => 5,
      'HIGH_FIBER' => 20,
      'HIGH_PROTEIN' => 21,
      'FRUIT_VEGETABLE_LEGUME_CONTENT' => 22,
      _ => 100,
    };
  }

  static bool _isSpecificReadableReason(String value) {
    final normalized = value.trim().toLowerCase();
    return normalized.contains('sugar') ||
        normalized.contains('salt') ||
        normalized.contains('saturated fat') ||
        normalized.contains('energy') ||
        normalized.contains('sweetener') ||
        normalized.contains('fiber') ||
        normalized.contains('protein');
  }

  static List<String> _localizedFields(Object? value) {
    return _stringList(
      value,
    ).map(ProductPresentationLocalization.missingField).toList();
  }

  static List<String> _stringList(Object? value) {
    if (value is List) {
      return value.whereType<String>().toList();
    }

    return const [];
  }

  static String _methodologyVersion(Object? value) {
    if (value is String && value.trim().isNotEmpty) {
      return value;
    }

    return 'taza-score-v1';
  }
}

class NutriScorePreviewModel {
  const NutriScorePreviewModel({
    required this.status,
    required this.rawScore,
    required this.grade,
  });

  final String status;
  final int? rawScore;
  final String? grade;

  factory NutriScorePreviewModel.fromJson(Map<String, dynamic> json) {
    return NutriScorePreviewModel(
      status: json['status'] is String
          ? json['status'] as String
          : 'insufficient_data',
      rawScore: ProductScorePreviewModel._readInt(json['rawScore']),
      grade: json['grade'] is String ? json['grade'] as String : null,
    );
  }
}
