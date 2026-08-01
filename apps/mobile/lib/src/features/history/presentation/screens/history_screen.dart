import 'package:flutter/material.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/features/history/data/datasources/history_local_data_source.dart';
import 'package:project/src/features/history/data/repositories/local_history_repository.dart';
import 'package:project/src/features/history/domain/entities/history_entry.dart';
import 'package:project/src/features/product/domain/entities/product_details_args.dart';
import 'package:project/src/features/product/presentation/widgets/cached_product_card.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  LocalHistoryRepository? _repository;
  List<HistoryEntry> _entries = const [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final preferences = await SharedPreferences.getInstance();
    final repository = LocalHistoryRepository(
      HistoryLocalDataSource(preferences),
    );
    final entries = await repository.list();

    if (!mounted) return;
    setState(() {
      _repository = repository;
      _entries = entries;
      _isLoading = false;
    });
  }

  Future<void> _delete(HistoryEntry entry) async {
    await _repository?.delete(entry.product.id, entry.viewedAt);
    await _load();
  }

  Future<void> _clear() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear history?'),
        content: const Text('This removes all local scan history.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Clear'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _repository?.clear();
      await _load();
    }
  }

  void _open(HistoryEntry entry) {
    Navigator.of(context).pushNamed(
      AppRoutes.productDetails,
      arguments: ProductDetailsArgs(
        product: entry.product.toCachedProduct(),
        refreshFromNetwork: true,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('History'),
        actions: [
          if (_entries.isNotEmpty)
            IconButton(
              tooltip: 'Clear history',
              onPressed: _clear,
              icon: const Icon(Icons.delete_sweep_rounded),
            ),
        ],
      ),
      body: ResponsivePage(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _HistoryList(entries: _entries, onTap: _open, onDelete: _delete),
      ),
    );
  }
}

class _HistoryList extends StatelessWidget {
  const _HistoryList({
    required this.entries,
    required this.onTap,
    required this.onDelete,
  });

  final List<HistoryEntry> entries;
  final ValueChanged<HistoryEntry> onTap;
  final ValueChanged<HistoryEntry> onDelete;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return const Center(child: Text('No history yet.'));
    }

    String? lastDate;

    return ListView(
      children: [
        for (final entry in entries) ...[
          if (_dateLabel(entry.viewedAt) != lastDate)
            Padding(
              padding: const EdgeInsets.only(top: 16, bottom: 8),
              child: Text(
                lastDate = _dateLabel(entry.viewedAt),
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
          CachedProductCard(
            product: entry.product,
            onTap: () => onTap(entry),
            trailing: IconButton(
              tooltip: 'Delete',
              onPressed: () => onDelete(entry),
              icon: const Icon(Icons.delete_outline_rounded),
            ),
          ),
        ],
      ],
    );
  }

  String _dateLabel(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final value = DateTime(date.year, date.month, date.day);

    if (value == today) return 'Today';
    if (value == today.subtract(const Duration(days: 1))) return 'Yesterday';

    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}
