import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:project/src/core/config/api_config.dart';
import 'package:project/src/core/errors/app_exception.dart';

class ApiClient {
  ApiClient({
    HttpClient? httpClient,
    String baseUrl = ApiConfig.baseUrl,
    this.timeout = ApiConfig.timeout,
  }) : _httpClient = httpClient ?? HttpClient(),
       _baseUri = Uri.parse(baseUrl);

  final HttpClient _httpClient;
  final Uri _baseUri;
  final Duration timeout;

  Future<Map<String, dynamic>> getJson(String path) async {
    try {
      final request = await _httpClient
          .getUrl(_baseUri.replace(path: path))
          .timeout(timeout);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');

      final response = await request.close().timeout(timeout);
      final responseBody = await response.transform(utf8.decoder).join();

      return _handleResponse(response.statusCode, responseBody);
    } on TimeoutException {
      throw const RequestTimeoutException(
        'The request took too long. Try again.',
      );
    } on SocketException {
      throw const NetworkException('No internet connection.');
    } on HttpException {
      throw const ServerException('Could not reach the server.');
    } on AppException {
      rethrow;
    } catch (_) {
      throw const UnknownAppException('Something went wrong. Try again.');
    }
  }

  Map<String, dynamic> _handleResponse(int statusCode, String responseBody) {
    final json = responseBody.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(responseBody) as Map<String, dynamic>;

    if (statusCode == HttpStatus.notFound) {
      throw const NotFoundException('Product not found.');
    }

    if (statusCode >= 500) {
      throw const ServerException('Server is unavailable. Try again later.');
    }

    if (statusCode < 200 || statusCode >= 300) {
      throw ServerException(_readErrorMessage(json));
    }

    return json;
  }

  String _readErrorMessage(Map<String, dynamic> json) {
    final error = json['error'];

    if (error is Map<String, dynamic> && error['message'] is String) {
      return error['message'] as String;
    }

    return 'Request failed. Try again.';
  }
}
