sealed class AppException implements Exception {
  const AppException(this.message);

  final String message;
}

/// What an unsuccessful HTTP response means for the user. Decided from the status code
/// (and endpoint), never from backend message text.
enum ApiErrorKind {
  validation,
  unauthorized,
  forbidden,
  conflict,
  payloadTooLarge,
  unsupportedMedia,
  rateLimited,
  ocrBusy,
  ocrTimeout,
  serverUnavailable,
  requestFailed,
}

final class NotFoundException extends AppException {
  const NotFoundException(super.message);
}

/// The request never got an HTTP response (offline, DNS, refused connection).
final class NetworkException extends AppException {
  const NetworkException(super.message);
}

/// The server answered with an unsuccessful HTTP status.
final class ServerException extends AppException {
  const ServerException(
    super.message, {
    this.kind = ApiErrorKind.serverUnavailable,
    this.statusCode,
  });

  final ApiErrorKind kind;
  final int? statusCode;
}

final class RequestTimeoutException extends AppException {
  const RequestTimeoutException(super.message);
}

final class InvalidResponseException extends AppException {
  const InvalidResponseException(super.message);
}

final class UnknownAppException extends AppException {
  const UnknownAppException(super.message);
}
