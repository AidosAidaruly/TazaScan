import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/config/api_config.dart';
import 'package:project/src/features/splash/presentation/screens/splash_screen.dart';

ApiUrlProblem? production(String url) => ApiConfig.validateBaseUrl(
  configuredBaseUrl: url,
  effectiveBaseUrl: url,
  requireProductionEndpoint: true,
);

ApiUrlProblem? development(String url, {String? configured}) =>
    ApiConfig.validateBaseUrl(
      configuredBaseUrl: configured ?? url,
      effectiveBaseUrl: url,
      requireProductionEndpoint: false,
    );

void main() {
  group('production (release) endpoint validation', () {
    test('accepts real HTTPS endpoints', () {
      for (final url in [
        'https://api.tazascan.kz',
        'https://api.example.com:8443',
        'https://api.example.com/v1',
        'https://api.example.com/',
        'https://203.0.113.10',
      ]) {
        expect(production(url), isNull, reason: url);
      }
    });

    test('rejects localhost in any form', () {
      for (final url in [
        'https://localhost',
        'https://localhost:4000',
        'https://LOCALHOST',
        'https://localhost.',
        'https://api.localhost',
      ]) {
        expect(production(url), ApiUrlProblem.developmentHost, reason: url);
      }
    });

    test('rejects IPv4 loopback, unspecified and link-local hosts', () {
      for (final url in [
        'https://127.0.0.1',
        'https://127.0.0.1:4000',
        'https://127.8.9.10',
        'https://0.0.0.0',
        'https://169.254.1.1',
      ]) {
        expect(production(url), ApiUrlProblem.developmentHost, reason: url);
      }
    });

    test('rejects numeric shorthands that can resolve to loopback', () {
      for (final url in ['https://127.1', 'https://2130706433', 'https://0x7f.1']) {
        expect(production(url), ApiUrlProblem.developmentHost, reason: url);
      }
    });

    test('rejects IPv6 loopback, unspecified, mapped and link-local hosts', () {
      for (final url in [
        'https://[::1]',
        'https://[::1]:4000',
        'https://[0:0:0:0:0:0:0:1]',
        'https://[::]',
        'https://[::ffff:127.0.0.1]',
        'https://[fe80::1]',
      ]) {
        expect(production(url), ApiUrlProblem.developmentHost, reason: url);
      }
    });

    test('rejects Android emulator host aliases', () {
      for (final url in [
        'https://10.0.2.2',
        'https://10.0.2.2:4000',
        'https://10.0.3.2:8080',
        'https://[::ffff:10.0.2.2]',
      ]) {
        expect(production(url), ApiUrlProblem.developmentHost, reason: url);
      }
    });

    test('treats look-alike hostnames as ordinary domains', () {
      for (final url in [
        'https://localhost.example.com',
        'https://mylocalhost.com',
        'https://127-0-0-1.example.com',
        'https://api10.0.2.2.example.com',
      ]) {
        expect(production(url), isNull, reason: url);
      }
    });

    test('allows private network addresses (internal deployments)', () {
      for (final url in ['https://10.1.2.3', 'https://192.168.1.20', 'https://172.16.0.5']) {
        expect(production(url), isNull, reason: url);
      }
    });

    test('requires HTTPS', () {
      expect(production('http://api.example.com'), ApiUrlProblem.notHttps);
    });

    test('requires an explicit API_BASE_URL instead of a local fallback', () {
      expect(
        ApiConfig.validateBaseUrl(
          configuredBaseUrl: '',
          effectiveBaseUrl: 'http://10.0.2.2:4000',
          requireProductionEndpoint: true,
        ),
        ApiUrlProblem.missing,
      );
    });
  });

  group('debug/development validation', () {
    test('keeps local development endpoints working', () {
      for (final url in [
        'http://10.0.2.2:4000',
        'http://localhost:4000',
        'http://127.0.0.1:4000',
        'http://[::1]:4000',
        'http://192.168.1.20:4000',
        'https://api.example.com',
      ]) {
        expect(development(url), isNull, reason: url);
      }
    });

    test('accepts the built-in fallback when API_BASE_URL is not set', () {
      expect(development('http://10.0.2.2:4000', configured: ''), isNull);
      expect(development('http://localhost:4000', configured: ''), isNull);
    });
  });

  group('malformed URLs fail clearly in every mode', () {
    const malformed = [
      'not a url',
      'api.example.com',
      '//api.example.com',
      'ftp://api.example.com',
      'https://',
      'https://user:secret@api.example.com',
      'https://api.example.com?debug=1',
      'https://api.example.com#x',
      'https://[::1',
    ];

    for (final url in malformed) {
      test(url, () {
        expect(development(url), ApiUrlProblem.malformed);
        expect(production(url), ApiUrlProblem.malformed);
      });
    }
  });

  test('test builds are not production builds and use a valid default', () {
    expect(ApiConfig.requiresProductionEndpoint, isFalse);
    expect(ApiConfig.isMisconfigured, isFalse);
  });

  test('every problem has a clear startup message that never shows the URL', () {
    for (final problem in ApiUrlProblem.values) {
      final message = apiUrlProblemMessage(problem);
      expect(message, isNotEmpty);
      expect(message, isNot(contains('http')));
    }
  });
}
