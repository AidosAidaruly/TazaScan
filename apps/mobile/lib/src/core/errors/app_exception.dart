sealed class AppException implements Exception {
  const AppException(this.message);

  final String message;
}

final class NotFoundException extends AppException {
  const NotFoundException(super.message);
}

final class NetworkException extends AppException {
  const NetworkException(super.message);
}

final class ServerException extends AppException {
  const ServerException(super.message);
}

final class RequestTimeoutException extends AppException {
  const RequestTimeoutException(super.message);
}

final class UnknownAppException extends AppException {
  const UnknownAppException(super.message);
}
