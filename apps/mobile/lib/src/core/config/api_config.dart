import 'package:flutter/foundation.dart';

abstract final class ApiConfig {
  static const isProduction = bool.fromEnvironment('TAZASCAN_PRODUCTION');

  static const _configuredBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static String get baseUrl {
    if (_configuredBaseUrl.isNotEmpty) {
      return _configuredBaseUrl;
    }

    if (!kIsWeb &&
        (defaultTargetPlatform == TargetPlatform.windows ||
            defaultTargetPlatform == TargetPlatform.linux ||
            defaultTargetPlatform == TargetPlatform.macOS)) {
      return 'http://localhost:4000';
    }

    return 'http://10.0.2.2:4000';
  }

  static const timeout = Duration(seconds: 8);

  static bool get isProductionMisconfigured {
    return isProduction && baseUrl == 'http://10.0.2.2:4000';
  }
}
