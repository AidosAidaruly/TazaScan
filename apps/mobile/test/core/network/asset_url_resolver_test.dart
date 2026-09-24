import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/core/config/api_config.dart';
import 'package:project/src/core/network/asset_url_resolver.dart';

void main() {
  test('resolves relative upload URL against API base URL', () {
    expect(
      resolveApiAssetUrl('/uploads/products/image.webp'),
      '${ApiConfig.baseUrl}/uploads/products/image.webp',
    );
  });

  test('keeps absolute URL unchanged', () {
    expect(
      resolveApiAssetUrl('https://cdn.example.com/image.webp'),
      'https://cdn.example.com/image.webp',
    );
  });

  test('returns null for missing URL', () {
    expect(resolveApiAssetUrl(null), isNull);
    expect(resolveApiAssetUrl('   '), isNull);
  });
}
