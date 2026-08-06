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
