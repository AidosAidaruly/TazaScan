abstract final class ApiConfig {
  static const isProduction = bool.fromEnvironment('TAZASCAN_PRODUCTION');

  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000',
  );

  static const timeout = Duration(seconds: 8);

  static bool get isProductionMisconfigured {
    return isProduction && baseUrl == 'http://10.0.2.2:4000';
  }
}
