import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:project/src/core/config/api_config.dart';
import 'package:project/src/core/errors/app_exception.dart';

class ApiClient {
  ApiClient({
    http.Client? httpClient,
    String baseUrl = ApiConfig.baseUrl,
    this.timeout = ApiConfig.timeout,
  }) : _httpClient = httpClient ?? http.Client(),
       _baseUri = Uri.parse(baseUrl);

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

      _debugLog('GET $path status=${response.statusCode}');
      _debugLog('GET $path bodyShape=${_bodyShape(response.body)}');

      return _handleResponse(response.statusCode, response.body);
    } on TimeoutException catch (error) {
      _debugLog('GET $path exception=${error.runtimeType}');
      throw const RequestTimeoutException(
        'Запрос выполнялся слишком долго. Попробуй снова.',
      );
    } on SocketException catch (error) {
      _debugLog('GET $path exception=${error.runtimeType}');
      throw const ServerException('Не удалось подключиться к серверу.');
    } on http.ClientException catch (error) {
      _debugLog('GET $path exception=${error.runtimeType}');
      throw const ServerException('Не удалось подключиться к серверу.');
    } on FormatException catch (error) {
      _debugLog('GET $path exception=${error.runtimeType}');
      throw const InvalidResponseException(
        'Не удалось прочитать ответ сервера.',
      );
    } on AppException catch (error) {
      _debugLog('GET $path exception=${error.runtimeType}');
      rethrow;
    } catch (error) {
      _debugLog('GET $path exception=${error.runtimeType}');
      throw const UnknownAppException('Что-то пошло не так. Попробуй снова.');
    }
  }

  Map<String, dynamic> _handleResponse(int statusCode, String responseBody) {
    final decoded = responseBody.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(responseBody);

    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Expected root JSON object.');
    }

    if (statusCode == HttpStatus.notFound) {
      throw const NotFoundException('Продукт не найден.');
    }

    if (statusCode >= 500) {
      throw const ServerException('Сервер недоступен. Попробуй позже.');
    }

    if (statusCode < 200 || statusCode >= 300) {
      throw ServerException(_readErrorMessage(decoded));
    }

    return decoded;
  }

  String _readErrorMessage(Map<String, dynamic> json) {
    final error = json['error'];

    if (error is Map<String, dynamic> && error['message'] is String) {
      return error['message'] as String;
    }

    return 'Запрос не удался. Попробуй снова.';
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
