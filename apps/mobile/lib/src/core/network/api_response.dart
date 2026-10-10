import 'dart:convert';

import 'package:project/src/core/errors/app_exception.dart';

/// Which backend endpoint family produced the response (affects 503/504 meaning).
enum ApiEndpoint { standard, ocr }

const _invalidResponseMessage = 'Не удалось прочитать ответ сервера.';

/// Decodes an API response, checking the status before trusting the body.
///
/// - 2xx: the body must be a JSON object (an empty body is `{}`); anything else is an
///   [InvalidResponseException].
/// - Any other status becomes an [AppException] chosen by status code alone. Error bodies may
///   be JSON, HTML or empty (e.g. from a reverse proxy); their text is never shown to users.
Map<String, dynamic> decodeApiResponse(
  int statusCode,
  String body, {
  ApiEndpoint endpoint = ApiEndpoint.standard,
  String notFoundMessage = 'Не найдено.',
  String unsupportedMediaMessage =
      'Не удалось открыть изображение. Попробуй выбрать другое фото.',
  String requestFailedMessage = 'Запрос не удался. Попробуй снова.',
}) {
  if (statusCode >= 200 && statusCode < 300) {
    return _decodeJsonObject(body);
  }

  if (statusCode == 404) {
    throw NotFoundException(notFoundMessage);
  }

  final (kind, message) = switch (statusCode) {
    400 || 422 => (
      ApiErrorKind.validation,
      'Проверь введённые данные и попробуй снова.',
    ),
    401 => (
      ApiErrorKind.unauthorized,
      'Требуется авторизация. Попробуй снова позже.',
    ),
    403 => (ApiErrorKind.forbidden, 'Недостаточно прав для этого действия.'),
    409 => (
      ApiErrorKind.conflict,
      'Такие данные уже есть или уже отправлены на проверку.',
    ),
    413 => (ApiErrorKind.payloadTooLarge, 'Фото слишком большое.'),
    415 => (ApiErrorKind.unsupportedMedia, unsupportedMediaMessage),
    429 => (
      ApiErrorKind.rateLimited,
      'Слишком много запросов. Подожди немного и попробуй снова.',
    ),
    // Only the API itself answers "OCR busy" with a JSON error; an HTML/empty 503 comes from
    // a proxy in front of a server that is down.
    503 when endpoint == ApiEndpoint.ocr && _hasJsonError(body) => (
      ApiErrorKind.ocrBusy,
      'Сервис распознавания сейчас занят. Попробуй ещё раз через минуту.',
    ),
    504 when endpoint == ApiEndpoint.ocr => (
      ApiErrorKind.ocrTimeout,
      'Распознавание заняло слишком много времени. Попробуй ещё раз.',
    ),
    >= 500 => (ApiErrorKind.serverUnavailable, 'Сервер недоступен. Попробуй позже.'),
    _ => (ApiErrorKind.requestFailed, requestFailedMessage),
  };

  throw ServerException(message, kind: kind, statusCode: statusCode);
}

Map<String, dynamic> _decodeJsonObject(String body) {
  if (body.trim().isEmpty) {
    return <String, dynamic>{};
  }

  final Object? decoded;
  try {
    decoded = jsonDecode(body);
  } on FormatException {
    throw const InvalidResponseException(_invalidResponseMessage);
  }

  if (decoded is! Map<String, dynamic>) {
    throw const InvalidResponseException(_invalidResponseMessage);
  }

  return decoded;
}

/// True when the body is the API's own JSON error envelope (`{"error": {...}}`).
bool _hasJsonError(String body) {
  try {
    final decoded = jsonDecode(body);
    return decoded is Map<String, dynamic> && decoded['error'] is Map;
  } on FormatException {
    return false;
  }
}
