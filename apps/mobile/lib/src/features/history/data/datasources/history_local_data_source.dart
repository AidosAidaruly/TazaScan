import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:project/src/features/history/data/models/history_entry_model.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists one string value; resolves to false (or throws) when the platform write fails.
typedef HistoryPreferenceWriter =
    Future<bool> Function(String key, String value);

/// The unreadable stored history could not be backed up, so it was not overwritten.
class HistoryBackupException implements Exception {
  const HistoryBackupException([this.cause]);

  final Object? cause;

  @override
  String toString() =>
      'HistoryBackupException: backup of unreadable history failed'
      '${cause == null ? '' : ' ($cause)'}';
}

class HistoryLocalDataSource {
  const HistoryLocalDataSource(
    this._preferences, {
    @visibleForTesting HistoryPreferenceWriter? writeString,
  }) : _writeStringOverride = writeString;

  static const storageKey = 'scan_history_v1';

  /// Unreadable history blob, kept once instead of being silently overwritten.
  static const corruptBackupKey = 'scan_history_v1_corrupt_backup';

  final SharedPreferences _preferences;
  final HistoryPreferenceWriter? _writeStringOverride;

  Future<bool> _writeString(String key, String value) {
    return (_writeStringOverride ?? _preferences.setString)(key, value);
  }

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
    return updateEntries((_) => entries);
  }

  /// Applies [change] to the current entries and saves the result. Updates (and [clear])
  /// run one at a time, each reading the result of the previous one, so concurrent
  /// history operations cannot lose each other's changes. [change] returns null to leave
  /// storage untouched.
  ///
  /// Unreadable stored data is backed up, and the backup confirmed, before it is
  /// overwritten; if that fails, nothing is written and [HistoryBackupException] is thrown.
  Future<void> updateEntries(
    List<HistoryEntryModel>? Function(List<HistoryEntryModel> current) change,
  ) {
    return _serialized(() async {
      final next = change(readEntries());
      if (next == null) {
        return;
      }

      await _backUpUnreadableHistory();
      final encoded = jsonEncode(next.map((entry) => entry.toJson()).toList());
      await _writeString(storageKey, encoded);
    });
  }

  /// Removes the history and its backup, after any update already queued.
  Future<void> clear() {
    return _serialized(() async {
      await _preferences.remove(storageKey);
      await _preferences.remove(corruptBackupKey);
    });
  }

  /// Completion of the latest queued operation, per SharedPreferences instance (data
  /// source instances are created per screen, but all share the app's SharedPreferences).
  static final Expando<Future<void>> _lastOperation = Expando('historyUpdate');

  Future<void> _serialized(Future<void> Function() operation) async {
    final previous = _lastOperation[_preferences];
    final done = Completer<void>();
    _lastOperation[_preferences] = done.future;

    try {
      // Completes normally even when the previous operation failed.
      await previous;
      await operation();
    } finally {
      done.complete();
    }
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
  /// (once) before the next write drops it, instead of discarding it silently. Completes
  /// only once the platform confirmed the backup; otherwise throws, so the caller writes
  /// nothing.
  Future<void> _backUpUnreadableHistory() async {
    final rawValue = _preferences.getString(storageKey);
    if (rawValue == null || _preferences.containsKey(corruptBackupKey)) {
      return;
    }

    final items = _decodedItems();
    final hasUnreadableData =
        items == null || items.any((item) => _parseEntry(item) == null);
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
      // Best effort: the original history is still stored untouched either way.
    }
    throw HistoryBackupException(failure);
  }
}
