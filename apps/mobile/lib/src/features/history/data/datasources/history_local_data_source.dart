import 'dart:convert';

import 'package:project/src/features/history/data/models/history_entry_model.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HistoryLocalDataSource {
  const HistoryLocalDataSource(this._preferences);

  static const storageKey = 'scan_history_v1';

  /// Unreadable history blob, kept once instead of being silently overwritten.
  static const corruptBackupKey = 'scan_history_v1_corrupt_backup';

  final SharedPreferences _preferences;

  /// Reads history entries, newest first. Each entry is parsed on its own: a malformed
  /// entry is skipped without discarding the valid ones, and exact duplicates (same product
  /// and view time) are dropped. Never throws.
  List<HistoryEntryModel> readEntries() {
    final items = _decodedItems();
    if (items == null) {
      return const [];
    }

    final entries = <HistoryEntryModel>[];
    final seen = <String>{};
    for (final item in items) {
      final entry = _parseEntry(item);
      if (entry == null) {
        continue;
      }

      final key = '${entry.product.id}|${entry.viewedAt.toIso8601String()}';
      if (seen.add(key)) {
        entries.add(entry);
      }
    }

    return entries;
  }

  Future<void> writeEntries(List<HistoryEntryModel> entries) {
    // No await before the setString calls: SharedPreferences updates its in-memory cache
    // synchronously, so a caller's read-modify-write cannot interleave with another one.
    final backup = _backUpUnreadableHistory();
    final encoded = jsonEncode(entries.map((entry) => entry.toJson()).toList());
    final write = _preferences.setString(storageKey, encoded);

    return Future.wait([backup, write]).then((_) {});
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

  HistoryEntryModel? _parseEntry(Object? item) {
    if (item is! Map) {
      return null;
    }

    try {
      return HistoryEntryModel.fromJson(Map<String, dynamic>.from(item));
    } on Object {
      return null;
    }
  }

  /// When the stored value (or any entry in it) is unreadable, keep a copy of the raw value
  /// (once) before the next write drops it, instead of discarding it silently.
  Future<void> _backUpUnreadableHistory() {
    final rawValue = _preferences.getString(storageKey);
    if (rawValue == null || _preferences.containsKey(corruptBackupKey)) {
      return Future<void>.value();
    }

    final items = _decodedItems();
    final hasUnreadableData =
        items == null || items.any((item) => _parseEntry(item) == null);
    if (!hasUnreadableData) {
      return Future<void>.value();
    }

    return _preferences.setString(corruptBackupKey, rawValue).then((_) {});
  }
}
