import 'dart:convert';

import 'package:project/src/features/product/data/models/cached_product_summary_model.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FavoritesLocalDataSource {
  const FavoritesLocalDataSource(this._preferences);

  static const storageKey = 'favorites_v1';

  final SharedPreferences _preferences;

  List<CachedProductSummaryModel> readProducts() {
    final rawValue = _preferences.getString(storageKey);
    if (rawValue == null) {
      return const [];
    }

    try {
      final decoded = jsonDecode(rawValue);
      if (decoded is! List) {
        return const [];
      }

      return decoded
          .map(
            (item) => CachedProductSummaryModel.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<void> writeProducts(List<CachedProductSummaryModel> products) {
    final encoded = jsonEncode(
      products.map((product) => product.toJson()).toList(),
    );

    return _preferences.setString(storageKey, encoded);
  }

  Future<void> clear() {
    return _preferences.remove(storageKey);
  }
}
