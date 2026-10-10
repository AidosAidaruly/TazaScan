import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/network/api_client.dart';

ApiClient _client(Future<http.Response> Function(http.Request request) handler) =>
    ApiClient(httpClient: MockClient(handler), baseUrl: 'https://api.example.com');

void main() {
  test('decodes a successful JSON response unchanged', () async {
    final client = _client(
      (_) async => http.Response('{"data":{"id":"p1"},"pagination":{"page":1}}', 200),
    );

    expect(await client.getJson('/products/p1'), {
      'data': {'id': 'p1'},
      'pagination': {'page': 1},
    });
  });

  test('an HTML 502 from a proxy is a controlled server error, not a parse error', () async {
    final client = _client(
      (_) async => http.Response('<html><body>502 Bad Gateway</body></html>', 502),
    );

    await expectLater(
      client.getJson('/products'),
      throwsA(
        isA<ServerException>()
            .having((error) => error.kind, 'kind', ApiErrorKind.serverUnavailable)
            .having((error) => error.message, 'message', isNot(contains('<'))),
      ),
    );
  });

  test('an error page with invalid UTF-8 still maps by status, not a decode error', () async {
    final client = _client(
      (_) async => http.Response.bytes(
        [...'<html>502 '.codeUnits, 0xff, 0xfe, 0xc3, ...'</html>'.codeUnits],
        502,
        headers: {'content-type': 'text/html; charset=utf-8'},
      ),
    );

    await expectLater(
      client.getJson('/products'),
      throwsA(
        isA<ServerException>()
            .having((error) => error.kind, 'kind', ApiErrorKind.serverUnavailable)
            .having((error) => error.message, 'message', isNot(contains('<'))),
      ),
    );
  });

  test('UTF-8 JSON with Cyrillic text decodes unchanged', () async {
    final client = _client(
      (_) async => http.Response.bytes(
        utf8.encode('{"data":{"name":"Творог 9%","brand":"Простоквашино"}}'),
        200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      ),
    );

    expect(await client.getJson('/products/p1'), {
      'data': {'name': 'Творог 9%', 'brand': 'Простоквашино'},
    });
  });

  test('404 stays NotFoundException with the product message', () async {
    final client = _client((_) async => http.Response('<html>Not Found</html>', 404));

    await expectLater(
      client.getJson('/products/barcode/123'),
      throwsA(
        isA<NotFoundException>().having((error) => error.message, 'message', 'Продукт не найден.'),
      ),
    );
  });

  test('malformed JSON on success is an invalid response', () async {
    final client = _client((_) async => http.Response('{"data":', 200));

    await expectLater(client.getJson('/products'), throwsA(isA<InvalidResponseException>()));
  });

  test('connection failures are NetworkException, distinct from HTTP failures', () async {
    final socket = _client((_) async => throw const SocketException('refused'));
    final clientError = _client((_) async => throw http.ClientException('closed'));

    await expectLater(socket.getJson('/products'), throwsA(isA<NetworkException>()));
    await expectLater(clientError.getJson('/products'), throwsA(isA<NetworkException>()));
  });

  test('401/403 map to authentication and permission errors', () async {
    for (final (status, kind) in [
      (401, ApiErrorKind.unauthorized),
      (403, ApiErrorKind.forbidden),
    ]) {
      final client = _client(
        (_) async => http.Response('{"error":{"message":"Forbidden"}}', status),
      );

      await expectLater(
        client.getJson('/products'),
        throwsA(isA<ServerException>().having((error) => error.kind, 'kind', kind)),
      );
    }
  });
}
