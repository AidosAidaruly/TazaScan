import 'package:project/src/core/config/api_config.dart';

String? resolveApiAssetUrl(String? url) {
  if (url == null || url.trim().isEmpty) {
    return null;
  }

  final trimmed = url.trim();
  final parsed = Uri.tryParse(trimmed);

  if (parsed != null && parsed.hasScheme) {
    return trimmed;
  }

  final baseUri = Uri.parse(ApiConfig.baseUrl);
  return baseUri.resolve(trimmed).toString();
}
