import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../auth/session_store.dart';

/// Typed client error mirroring the platform error envelope
/// (`{error:{code,message,requestId}}`, spec §9).
class ApiException implements Exception {
  const ApiException({
    required this.code,
    required this.message,
    this.statusCode,
    this.requestId,
  });

  final String code;
  final String message;
  final int? statusCode;
  final String? requestId;

  @override
  String toString() => 'ApiException($code): $message';
}

/// Repository/service abstraction for API access (spec §31).
abstract class ApiClient {
  Future<dynamic> get(String path, {Map<String, dynamic>? query});
  Future<dynamic> post(String path, {Object? body});
  Future<dynamic> put(String path, {Object? body});
  Future<dynamic> delete(String path);
}

/// Dio-backed implementation with bearer-token injection and envelope
/// error mapping. All feature repositories go through this client.
class DioApiClient implements ApiClient {
  DioApiClient({
    required AppConfig config,
    required SessionStore session,
    Dio? dio,
  }) : _dio = dio ??
           Dio(
             BaseOptions(
               baseUrl: config.apiBaseUrl,
               connectTimeout: config.connectTimeout,
               receiveTimeout: config.receiveTimeout,
               headers: <String, String>{'content-type': 'application/json'},
             ),
           ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final String? token = await session.readAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _wrap(_dio.get<dynamic>(path, queryParameters: query));

  @override
  Future<dynamic> post(String path, {Object? body}) =>
      _wrap(_dio.post<dynamic>(path, data: body));

  @override
  Future<dynamic> put(String path, {Object? body}) =>
      _wrap(_dio.put<dynamic>(path, data: body));

  @override
  Future<dynamic> delete(String path) => _wrap(_dio.delete<dynamic>(path));

  Future<dynamic> _wrap(Future<Response<dynamic>> request) async {
    try {
      final Response<dynamic> response = await request;
      return response.data;
    } on DioException catch (error) {
      throw _map(error);
    }
  }

  ApiException _map(DioException error) {
    switch (error.type) {
      case DioExceptionType.transformTimeout:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiException(
          code: 'NETWORK_TIMEOUT',
          message: 'The request timed out. Please try again.',
        );
      case DioExceptionType.connectionError:
        return const ApiException(
          code: 'NETWORK_UNAVAILABLE',
          message: 'No connection. Check your network and try again.',
        );
      case DioExceptionType.badResponse:
        final Response<dynamic>? response = error.response;
        final int? status = response?.statusCode;
        final Object? data = response?.data;
        if (data is Map<String, dynamic>) {
          final Object? envelope = data['error'];
          if (envelope is Map<String, dynamic>) {
            return ApiException(
              code: envelope['code'] as String? ?? 'UNKNOWN_ERROR',
              message: envelope['message'] as String? ?? 'Unexpected error.',
              statusCode: status,
              requestId: envelope['requestId'] as String?,
            );
          }
        }
        return ApiException(
          code: 'HTTP_$status',
          message: 'Request failed ($status).',
          statusCode: status,
        );
      case DioExceptionType.cancel:
        return const ApiException(
          code: 'REQUEST_CANCELLED',
          message: 'Request cancelled.',
        );
      case DioExceptionType.badCertificate:
        return const ApiException(
          code: 'TLS_ERROR',
          message: 'Secure connection failed.',
        );
      case DioExceptionType.unknown:
        return const ApiException(
          code: 'NETWORK_ERROR',
          message: 'Something went wrong. Please try again.',
        );
    }
  }
}
