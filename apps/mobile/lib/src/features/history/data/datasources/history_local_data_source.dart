import 'dart:convert';

import 'package:project/src/features/history/data/models/history_entry_model.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HistoryLocalDataSource {
  const HistoryLocalDataSource(this._preferences);

  static const storageKey = 'scan_history_v1';

  final SharedPreferences _preferences;

  List<HistoryEntryModel> readEntries() {
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
            (item) => HistoryEntryModel.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<void> writeEntries(List<HistoryEntryModel> entries) {
    final encoded = jsonEncode(entries.map((entry) => entry.toJson()).toList());

    return _preferences.setString(storageKey, encoded);
  }

  Future<void> clear() {
    return _preferences.remove(storageKey);
  }
}
