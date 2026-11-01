import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:project/src/features/product/data/models/cached_product_summary_model.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists one string value; resolves to false (or throws) when the platform write fails.
typedef PreferenceStringWriter =
    Future<bool> Function(String key, String value);

/// The unreadable stored favorites could not be backed up, so they were not overwritten.
class FavoritesBackupException implements Exception {
  const FavoritesBackupException([this.cause]);

  final Object? cause;

  @override
  String toString() =>
      'FavoritesBackupException: backup of unreadable favorites failed'
      '${cause == null ? '' : ' ($cause)'}';
}

class FavoritesLocalDataSource {
  const FavoritesLocalDataSource(
    this._preferences, {
    @visibleForTesting PreferenceStringWriter? writeString,
  }) : _writeStringOverride = writeString;

  static const storageKey = 'favorites_v1';

  /// Unreadable favorites blob, kept once instead of being silently overwritten.
  static const corruptBackupKey = 'favorites_v1_corrupt_backup';

  final SharedPreferences _preferences;
  final PreferenceStringWriter? _writeStringOverride;

  Future<bool> _writeString(String key, String value) {
    return (_writeStringOverride ?? _preferences.setString)(key, value);
  }

  /// Reads favorites in stored order. Each entry is parsed on its own: a malformed entry
  /// is skipped without discarding the valid ones. Never throws.
  List<CachedProductSummaryModel> readProducts() {
    final items = _decodedItems();
    if (items == null) {
      return const [];
    }

    final products = <CachedProductSummaryModel>[];
    for (final item in items) {
      final product = _parseProduct(item);
      if (product != null) {
        products.add(product);
      }
    }

    return products;
  }

  Future<void> writeProducts(List<CachedProductSummaryModel> products) {
    return updateProducts((_) => products);
  }

  /// Completion of the latest queued update, per SharedPreferences instance (data source
  /// instances are created per screen, but all share the app's SharedPreferences).
  static final Expando<Future<void>> _lastUpdate = Expando('favoritesUpdate');

  /// Applies [change] to the current favorites and saves the result. Updates run one at a
  /// time, each reading the result of the previous one, so concurrent add/remove calls
  /// cannot lose each other's changes. [change] returns null to leave storage untouched.
  ///
  /// Unreadable stored data is backed up, and the backup confirmed, before it is
  /// overwritten; if that fails, nothing is written and [FavoritesBackupException] is thrown.
  Future<void> updateProducts(
    List<CachedProductSummaryModel>? Function(
      List<CachedProductSummaryModel> current,
    )
    change,
  ) async {
    final previous = _lastUpdate[_preferences];
    final done = Completer<void>();
    _lastUpdate[_preferences] = done.future;

    try {
      // Completes normally even when the previous update failed.
      await previous;

      final next = change(readProducts());
      if (next == null) {
        return;
      }

      await _backUpUnreadableFavorites();
      final encoded = jsonEncode(
        next.map((product) => product.toJson()).toList(),
      );
      await _writeString(storageKey, encoded);
    } finally {
      done.complete();
    }
  }

  Future<void> clear() async {
    await _preferences.remove(storageKey);
    await _preferences.remove(corruptBackupKey);
  }

  /// The stored list, or null when nothing (or nothing list-shaped) is stored.
  List<Object?>? _decodedItems() {
    final rawValue = _preferences.getString(storageKey);
    if (rawValue == null) {
      return null;
    }

    try {
      final decoded = jsonDecode(rawValue);
      return decoded is List ? decoded : null;
    } on FormatException {
      return null;
    }
  }

  CachedProductSummaryModel? _parseProduct(Object? item) {
    if (item is! Map) {
      return null;
    }

    try {
      return CachedProductSummaryModel.fromJson(
        Map<String, dynamic>.from(item),
      );
    } on Object {
      return null;
    }
  }

  /// When the stored value (or any entry in it) is unreadable, keep a copy of the raw value
  /// (once) before the next write drops it, instead of discarding it silently. Completes
  /// only once the platform confirmed the backup; otherwise throws, so the caller writes
  /// nothing.
  Future<void> _backUpUnreadableFavorites() async {
    final rawValue = _preferences.getString(storageKey);
    if (rawValue == null || _preferences.containsKey(corruptBackupKey)) {
      return;
    }

    final items = _decodedItems();
    final hasUnreadableData =
        items == null || items.any((item) => _parseProduct(item) == null);
    if (!hasUnreadableData) {
      return;
    }

    Object? failure;
    try {
      if (await _writeString(corruptBackupKey, rawValue)) {
        return;
      }
    } catch (error) {
      failure = error;
    }

    // SharedPreferences caches the value before the platform write, so a failed write
    // still looks present; drop it so the next update retries the backup.
    try {
      await _preferences.remove(corruptBackupKey);
    } catch (_) {
      // Best effort: the original favorites are still stored untouched either way.
    }
    throw FavoritesBackupException(failure);
  }
}
