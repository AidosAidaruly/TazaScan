import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:project/src/core/config/api_config.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/network/api_response.dart';

class ApiClient {
  ApiClient({
    http.Client? httpClient,
    String? baseUrl,
    this.timeout = ApiConfig.timeout,
  }) : _httpClient = httpClient ?? http.Client(),
       _baseUri = Uri.parse(baseUrl ?? ApiConfig.baseUrl);

  final http.Client _httpClient;
  final Uri _baseUri;
  final Duration timeout;

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, String>? queryParameters,
  }) async {
    try {
      final uri = _baseUri.replace(
        path: path,
        queryParameters: queryParameters,
      );
      final response = await _httpClient
          .get(
            uri,
            headers: const {HttpHeaders.acceptHeader: 'application/json'},
          )
          .timeout(timeout);

      // Lenient decoding: an error page with invalid UTF-8 must still reach the status
      // check. Valid UTF-8 (all API JSON) decodes identically.
      final body = utf8.decode(response.bodyBytes, allowMalformed: true);

      _debugLog('GET $path status=${response.statusCode}');
      _debugLog('GET $path bodyShape=${_bodyShape(body)}');

      return _handleResponse(response.statusCode, body);
    } on TimeoutException catch (error) {
      _debugLog('GET $path exception=${error.runtimeType}');
      throw const RequestTimeoutException(
        'Запрос выполнялся слишком долго. Попробуй снова.',
      );
    } on SocketException catch (error) {
      // No HTTP response at all: a connection problem, not a server error.
      _debugLog('GET $path exception=${error.runtimeType}');
      throw const NetworkException('Не удалось подключиться к серверу.');
    } on http.ClientException catch (error) {
      _debugLog('GET $path exception=${error.runtimeType}');
      throw const NetworkException('Не удалось подключиться к серверу.');
    } on AppException catch (error) {
      _debugLog('GET $path exception=${error.runtimeType}');
      rethrow;
    } catch (error) {
      _debugLog('GET $path exception=${error.runtimeType}');
      throw const UnknownAppException('Что-то пошло не так. Попробуй снова.');
    }
  }

  Map<String, dynamic> _handleResponse(int statusCode, String responseBody) {
    return decodeApiResponse(
      statusCode,
      responseBody,
      notFoundMessage: 'Продукт не найден.',
    );
  }

  String _bodyShape(String responseBody) {
    if (responseBody.isEmpty) {
      return 'empty';
    }

    try {
      final decoded = jsonDecode(responseBody);
      if (decoded is Map) {
        final data = decoded['data'];
        final pagination = decoded['pagination'];

        return 'object keys=${decoded.keys.join(',')} '
            'data=${data is List ? 'list(${data.length})' : data.runtimeType} '
            'pagination=${pagination.runtimeType}';
      }

      return decoded.runtimeType.toString();
    } catch (error) {
      return 'invalid-json ${error.runtimeType}';
    }
  }

  void _debugLog(String message) {
    if (kDebugMode) {
      debugPrint('[ApiClient] $message');
    }
  }
}
