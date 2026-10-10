import 'package:flutter/foundation.dart';

/// Why the configured API base URL cannot be used.
enum ApiUrlProblem {
  /// Production build without an explicit `API_BASE_URL`.
  missing,

  /// Not an absolute http(s) URL with a host (or carries user info, query or fragment).
  malformed,

  /// Production build with a non-HTTPS URL.
  notHttps,

  /// Production build pointing at a loopback, emulator-only or link-local host.
  developmentHost,
}

abstract final class ApiConfig {
  static const isProduction = bool.fromEnvironment('TAZASCAN_PRODUCTION');

  /// Explicit opt-in for local-network demo release builds (see docs/aitu-demo-readiness.md).
  static const allowsLocalDemoHttp = bool.fromEnvironment('TAZASCAN_DEMO_HTTP');

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

  /// Production rules apply to production builds and to every release build that did not
  /// explicitly opt into the local demo. Debug and profile builds keep local endpoints.
  static bool get requiresProductionEndpoint =>
      isProduction || (kReleaseMode && !allowsLocalDemoHttp);

  static ApiUrlProblem? get baseUrlProblem => validateBaseUrl(
    configuredBaseUrl: _configuredBaseUrl,
    effectiveBaseUrl: baseUrl,
    requireProductionEndpoint: requiresProductionEndpoint,
  );

  /// True when the app must not start talking to the configured API.
  static bool get isMisconfigured => baseUrlProblem != null;

  /// Validates the API base URL structurally (parsed scheme and host, never substrings).
  /// Every mode requires an absolute http(s) URL with a host. Production mode additionally
  /// requires an explicit HTTPS URL whose host is not loopback, emulator-only or link-local.
  /// Private (RFC 1918) addresses are allowed: internal deployments may use them.
  static ApiUrlProblem? validateBaseUrl({
    required String configuredBaseUrl,
    required String effectiveBaseUrl,
    required bool requireProductionEndpoint,
  }) {
    if (requireProductionEndpoint && configuredBaseUrl.trim().isEmpty) {
      return ApiUrlProblem.missing;
    }

    final uri = Uri.tryParse(effectiveBaseUrl.trim());
    if (uri == null ||
        !(uri.scheme == 'http' || uri.scheme == 'https') ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment) {
      return ApiUrlProblem.malformed;
    }

    if (!requireProductionEndpoint) {
      return null;
    }

    if (uri.scheme != 'https') {
      return ApiUrlProblem.notHttps;
    }

    if (isDevelopmentHost(uri.host)) {
      return ApiUrlProblem.developmentHost;
    }

    return null;
  }

  // Android emulator host aliases: AVD (10.0.2.2) and Genymotion (10.0.3.2).
  static const _emulatorHostAliases = {'10.0.2.2', '10.0.3.2'};

  /// Hosts that can only mean "this device" or "the developer's machine".
  static bool isDevelopmentHost(String host) {
    final normalized = host.toLowerCase().replaceAll(RegExp(r'\.$'), '');

    if (normalized == 'localhost' || normalized.endsWith('.localhost')) {
      return true;
    }

    final ipv4 = _parseIPv4(normalized);
    if (ipv4 != null) {
      return _isDevelopmentIPv4(ipv4) || _emulatorHostAliases.contains(normalized);
    }

    // Shorthand/decimal/hex IPv4 forms (127.1, 2130706433, 0x7f.1) can resolve to loopback;
    // a real deployment uses a domain or a standard dotted address.
    if (RegExp(r'^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+)){0,3}$').hasMatch(normalized)) {
      return true;
    }

    final ipv6 = _parseIPv6(normalized);
    if (ipv6 != null) {
      return _isDevelopmentIPv6(ipv6);
    }

    return false;
  }

  static bool _isDevelopmentIPv4(List<int> bytes) {
    return bytes[0] == 127 || // loopback 127.0.0.0/8
        bytes.every((byte) => byte == 0) || // unspecified 0.0.0.0
        (bytes[0] == 169 && bytes[1] == 254); // link-local 169.254.0.0/16
  }

  static bool _isDevelopmentIPv6(List<int> bytes) {
    final allZeroPrefix = bytes.sublist(0, 15).every((byte) => byte == 0);
    if (allZeroPrefix && (bytes[15] == 0 || bytes[15] == 1)) {
      return true; // :: (unspecified) and ::1 (loopback)
    }

    // IPv4-mapped ::ffff:a.b.c.d follows the IPv4 rules.
    final isMapped =
        bytes.sublist(0, 10).every((byte) => byte == 0) && bytes[10] == 0xff && bytes[11] == 0xff;
    if (isMapped) {
      return _isDevelopmentIPv4(bytes.sublist(12)) ||
          _emulatorHostAliases.contains(bytes.sublist(12).join('.'));
    }

    return bytes[0] == 0xfe && (bytes[1] & 0xc0) == 0x80; // link-local fe80::/10
  }

  static List<int>? _parseIPv4(String host) {
    if (!RegExp(r'^\d{1,3}(\.\d{1,3}){3}$').hasMatch(host)) {
      return null;
    }
    try {
      return Uri.parseIPv4Address(host);
    } on FormatException {
      return null;
    }
  }

  static List<int>? _parseIPv6(String host) {
    if (!host.contains(':')) {
      return null;
    }
    try {
      // Uri.host keeps a zone id (e.g. fe80::1%25wlan0); drop it before parsing.
      return Uri.parseIPv6Address(host.split('%').first);
    } on FormatException {
      return null;
    }
  }
}
