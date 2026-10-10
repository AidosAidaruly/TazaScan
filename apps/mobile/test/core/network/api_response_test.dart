import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/network/api_response.dart';

const _htmlPage =
    '<html><head><title>502 Bad Gateway</title></head><body><center>nginx/1.25.3</center></body></html>';
const _backendInternals = [
  '<html',
  'nginx',
  'Bad Gateway',
  'Validation failed',
  'OCR service is busy',
  'OCR timed out',
  'A similar pending submission',
  'Too many',
  'Internal server error',
];

Object _failure(
  int status,
  String body, {
  ApiEndpoint endpoint = ApiEndpoint.standard,
}) {
  try {
    decodeApiResponse(status, body, endpoint: endpoint);
  } on Object catch (error) {
    return error;
  }
  fail('expected $status to fail');
}

Matcher _server(ApiErrorKind kind, int status) => isA<ServerException>()
    .having((error) => error.kind, 'kind', kind)
    .having((error) => error.statusCode, 'statusCode', status);

void _expectNoInternals(String message) {
  for (final fragment in _backendInternals) {
    expect(message, isNot(contains(fragment)), reason: message);
  }
}

void main() {
  group('successful responses decode exactly as before', () {
    test('returns the JSON object', () {
      expect(
        decodeApiResponse(200, '{"data":{"id":"p1","score":27},"pagination":null}'),
        {
          'data': {'id': 'p1', 'score': 27},
          'pagination': null,
        },
      );
      expect(decodeApiResponse(201, '{"data":[]}'), {'data': <Object?>[]});
    });

    test('treats an empty success body as an empty object', () {
      expect(decodeApiResponse(204, ''), <String, dynamic>{});
    });

    test('malformed or non-object success bodies become InvalidResponseException', () {
      for (final body in ['{"data":', '<html></html>', '[1,2]', '"text"']) {
        expect(_failure(200, body), isA<InvalidResponseException>(), reason: body);
      }
    });
  });

  group('status is checked before the body is trusted', () {
    test('HTML 502/503 pages become controlled server errors', () {
      expect(_failure(502, _htmlPage), _server(ApiErrorKind.serverUnavailable, 502));
      expect(_failure(503, _htmlPage), _server(ApiErrorKind.serverUnavailable, 503));
      expect(_failure(500, 'Internal Server Error'), _server(ApiErrorKind.serverUnavailable, 500));
    });

    test('HTML 413 from a proxy becomes file-too-large', () {
      final error = _failure(413, '<html><body>413 Request Entity Too Large</body></html>');
      expect(error, _server(ApiErrorKind.payloadTooLarge, 413));
      expect((error as ServerException).message, 'Фото слишком большое.');
    });

    test('malformed JSON and empty error bodies do not crash', () {
      expect(_failure(400, '{"error":'), _server(ApiErrorKind.validation, 400));
      expect(_failure(500, '{"error":'), _server(ApiErrorKind.serverUnavailable, 500));
      expect(_failure(429, ''), _server(ApiErrorKind.rateLimited, 429));
    });
  });

  group('status mapping', () {
    test('JSON 400 validation becomes a localized validation error', () {
      final error = _failure(
        400,
        '{"error":{"message":"Validation failed","details":{"fieldErrors":{"name":["Required"]}}}}',
      );
      expect(error, _server(ApiErrorKind.validation, 400));
      expect((error as ServerException).message, 'Проверь введённые данные и попробуй снова.');
    });

    test('401 and 403 are authentication/permission errors', () {
      expect(_failure(401, '{"error":{"message":"Authentication required"}}'),
          _server(ApiErrorKind.unauthorized, 401));
      expect(_failure(403, '{"error":{"message":"Origin not allowed"}}'),
          _server(ApiErrorKind.forbidden, 403));
    });

    test('404 is not-found, never a server or offline error', () {
      expect(_failure(404, '{"error":{"message":"Product not found"}}'), isA<NotFoundException>());
      expect(_failure(404, '<html>Not Found</html>'), isA<NotFoundException>());
    });

    test('409 and 429 have their own kinds', () {
      expect(_failure(409, '{"error":{"message":"A similar pending submission already exists"}}'),
          _server(ApiErrorKind.conflict, 409));
      expect(_failure(429, '{"error":{"message":"Too many photo searches. Try again later."}}'),
          _server(ApiErrorKind.rateLimited, 429));
    });

    test('OCR 503 (busy) and 504 (timeout) are distinct', () {
      final busy = _failure(
        503,
        '{"error":{"message":"OCR service is busy. Try again later."}}',
        endpoint: ApiEndpoint.ocr,
      );
      final timeout = _failure(
        504,
        '{"error":{"message":"OCR timed out"}}',
        endpoint: ApiEndpoint.ocr,
      );

      expect(busy, _server(ApiErrorKind.ocrBusy, 503));
      expect(timeout, _server(ApiErrorKind.ocrTimeout, 504));
      expect((busy as ServerException).message, isNot((timeout as ServerException).message));
    });

    test('an HTML 503 on an OCR endpoint means the server is down, not OCR busy', () {
      expect(_failure(503, _htmlPage, endpoint: ApiEndpoint.ocr),
          _server(ApiErrorKind.serverUnavailable, 503));
      expect(_failure(504, _htmlPage, endpoint: ApiEndpoint.ocr),
          _server(ApiErrorKind.ocrTimeout, 504));
    });

    test('503/504 on non-OCR endpoints stay generic server errors', () {
      expect(_failure(503, '{"error":{"message":"OCR service is busy."}}'),
          _server(ApiErrorKind.serverUnavailable, 503));
      expect(_failure(504, ''), _server(ApiErrorKind.serverUnavailable, 504));
    });
  });

  test('exception messages never contain HTML, proxy text or backend wording', () {
    final bodies = [
      _htmlPage,
      '{"error":{"message":"Validation failed"}}',
      '{"error":{"message":"OCR service is busy. Try again later."}}',
      '{"error":{"message":"Internal server error"}}',
      'Too many requests',
    ];
    for (final status in [400, 401, 403, 404, 409, 413, 415, 418, 429, 500, 502, 503, 504]) {
      for (final body in bodies) {
        for (final endpoint in ApiEndpoint.values) {
          final error = _failure(status, body, endpoint: endpoint) as AppException;
          _expectNoInternals(error.message);
        }
      }
    }
  });

  test('every error kind has RU and KK UI text without backend wording', () {
    for (final locale in TazaLocale.values) {
      final strings = TazaStrings.forLocale(locale);
      for (final kind in ApiErrorKind.values) {
        final message = strings.apiErrorMessage(kind);
        expect(message, isNotEmpty);
        _expectNoInternals(message);
      }
    }
    final ru = TazaStrings.forLocale(TazaLocale.ru);
    expect(ru.apiErrorMessage(ApiErrorKind.ocrBusy), isNot(ru.apiErrorMessage(ApiErrorKind.ocrTimeout)));
    expect(ru.apiErrorMessage(ApiErrorKind.validation), isNot(contains('Validation')));
  });
}
