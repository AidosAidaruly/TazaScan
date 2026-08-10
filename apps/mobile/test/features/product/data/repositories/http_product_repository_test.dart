import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/network/api_client.dart';
import 'package:project/src/features/product/data/repositories/http_product_repository.dart';

void main() {
  test('parses valid paginated response with products', () async {
    final repository = _repositoryFor(
      (_) async => http.Response(
        jsonEncode({
          'data': [_productJson(name: 'Pepsi')],
          'pagination': {
            'page': 1,
            'pageSize': 20,
            'total': 1,
            'totalPages': 1,
          },
        }),
        200,
      ),
    );

    final products = await repository.search(name: 'Pepsi');

    expect(products, hasLength(1));
    expect(products.single.name, 'Pepsi');
  });

  test('parses valid empty paginated response as no results', () async {
    final repository = _repositoryFor(
      (_) async => http.Response(
        jsonEncode({
          'data': [],
          'pagination': {
            'page': 1,
            'pageSize': 20,
            'total': 0,
            'totalPages': 0,
          },
        }),
        200,
      ),
    );

    final products = await repository.search(name: 'Pepsi');

    expect(products, isEmpty);
  });

  test('maps malformed response shape to invalid response error', () async {
    final repository = _repositoryFor(
      (_) async => http.Response(
        jsonEncode({
          'items': [],
          'pagination': {
            'page': 1,
            'pageSize': 20,
            'total': 0,
            'totalPages': 0,
          },
        }),
        200,
      ),
    );

    expect(
      repository.search(name: 'Pepsi'),
      throwsA(isA<InvalidResponseException>()),
    );
  });

  test('maps HTTP 500 to server error', () async {
    final repository = _repositoryFor(
      (_) async => http.Response(
        jsonEncode({
          'error': {'message': 'Internal Server Error'},
        }),
        500,
      ),
    );

    expect(repository.search(name: 'Pepsi'), throwsA(isA<ServerException>()));
  });

  test('maps real timeout to timeout error only', () async {
    final repository = _repositoryFor((_) async {
      await Future<void>.delayed(const Duration(milliseconds: 50));
      return http.Response('{}', 200);
    }, timeout: const Duration(milliseconds: 5));

    expect(
      repository.search(name: 'Pepsi'),
      throwsA(isA<RequestTimeoutException>()),
    );
  });

  test('parses valid score preview response', () async {
    final repository = _repositoryFor(
      (_) async =>
          http.Response(jsonEncode({'data': _scorePreviewJson()}), 200),
    );

    final preview = await repository.previewScore(
      '11111111-1111-4111-8111-111111111111',
    );

    expect(preview.score, 27);
    expect(preview.nutriScoreGrade, 'E');
    expect(preview.nutritionComponent, 17);
    expect(preview.ingredientComponent, 10);
    expect(preview.reasonLabels, contains('Высокое содержание сахара'));
  });

  test(
    'prioritizes consumer score reason codes before generic details',
    () async {
      final repository = _repositoryFor(
        (_) async => http.Response(
          jsonEncode({
            'data': _scorePreviewJson(
              reasonCodes: [
                'CONSERVATIVE_ADDITIVE_ASSESSMENT',
                'HIGH_ENERGY',
                'OFFICIAL_NUTRI_SCORE_FOUNDATION',
                'HIGH_SUGAR',
                'HIGH_SALT',
                'HIGH_SATURATED_FAT',
              ],
            ),
          }),
          200,
        ),
      );

      final preview = await repository.previewScore(
        '11111111-1111-4111-8111-111111111111',
      );

      expect(preview.reasonLabels, [
        'Высокое содержание сахара',
        'Высокое содержание соли',
        'Высокое содержание насыщенных жиров',
      ]);
      expect(preview.technicalReasonLabels, [
        'Добавки учтены информационно',
        'Оценка основана на методике Nutri-Score',
      ]);
    },
  );

  test('unknown reason codes fall back to no consumer reasons', () async {
    final repository = _repositoryFor(
      (_) async => http.Response(
        jsonEncode({
          'data': _scorePreviewJson(reasonCodes: ['UNKNOWN_INTERNAL_CODE']),
        }),
        200,
      ),
    );

    final preview = await repository.previewScore(
      '11111111-1111-4111-8111-111111111111',
    );

    expect(preview.reasonLabels, isEmpty);
    expect(preview.technicalReasonLabels, [
      'Оценка рассчитана на основе доступных данных продукта.',
    ]);
  });

  test(
    'parses insufficient score preview response without fake score',
    () async {
      final repository = _repositoryFor(
        (_) async => http.Response(
          jsonEncode({
            'data': _scorePreviewJson(
              status: 'insufficient_data',
              score: null,
              grade: null,
              missingFields: ['energyKcalOrEnergyKj', 'sugars'],
            ),
          }),
          200,
        ),
      );

      final preview = await repository.previewScore(
        '11111111-1111-4111-8111-111111111111',
      );

      expect(preview.score, isNull);
      expect(preview.missingFields, contains('Сахар'));
    },
  );

  test('maps malformed score preview response to invalid response', () async {
    final repository = _repositoryFor(
      (_) async => http.Response(jsonEncode({'data': []}), 200),
    );

    expect(
      repository.previewScore('11111111-1111-4111-8111-111111111111'),
      throwsA(isA<InvalidResponseException>()),
    );
  });
}

HttpProductRepository _repositoryFor(
  Future<http.Response> Function(http.Request request) handler, {
  Duration timeout = const Duration(seconds: 8),
}) {
  return HttpProductRepository(
    ApiClient(
      httpClient: MockClient(handler),
      baseUrl: 'http://localhost:4000',
      timeout: timeout,
    ),
  );
}

Map<String, dynamic> _productJson({required String name}) {
  return {
    'id': 'product-id',
    'barcode': '5449000000996',
    'name': name,
    'brand': 'PepsiCo',
    'category': 'Drinks',
    'imageUrl': null,
    'ingredients': ['Carbonated water', 'Sugar'],
    'nutritionFacts': {'energyKcal': 42, 'sugars': 10.6},
    'healthScore': 64,
    'nutritionScore': {
      'score': 64,
      'grade': 'C',
      'status': 'calculated',
      'positiveReasons': [],
      'negativeReasons': ['Sugar'],
      'warnings': [],
      'missingFields': [],
      'algorithm': 'Nutri-Score nutritional foundation',
      'algorithmVersion': 'nutri-score-foundation-2025-01',
      'calculatedAt': '2026-08-01T00:00:00.000Z',
    },
    'createdAt': '2026-08-01T00:00:00.000Z',
    'updatedAt': '2026-08-01T00:00:00.000Z',
    'dataStatus': 'verified',
  };
}

Map<String, dynamic> _scorePreviewJson({
  String status = 'calculated',
  int? score = 27,
  String? grade = 'E',
  List<String> reasonCodes = const ['HIGH_SUGAR'],
  List<String> missingFields = const [],
}) {
  return {
    'tazaScore': {
      'score': score,
      'status': status,
      'nutritionComponent': {
        'score': status == 'calculated' ? 17 : null,
        'maxScore': 90,
      },
      'ingredientComponent': {
        'score': status == 'calculated' ? 10 : null,
        'maxScore': 10,
      },
      'confidence': {'level': 'high'},
      'reasonCodes': reasonCodes,
      'positiveReasons': [],
      'negativeReasons': [],
      'warnings': [],
      'missingFields': missingFields,
      'methodologyVersion': 'taza-score-v1',
    },
    'nutriScore': {
      'status': status,
      'rawScore': status == 'calculated' ? 13 : null,
      'grade': grade,
    },
  };
}
