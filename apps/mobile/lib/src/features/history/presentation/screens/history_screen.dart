import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/features/history/data/datasources/history_local_data_source.dart';
import 'package:project/src/features/history/data/repositories/local_history_repository.dart';
import 'package:project/src/features/history/domain/entities/history_entry.dart';
import 'package:project/src/features/product/domain/entities/product_details_args.dart';
import 'package:project/src/features/product/presentation/widgets/consumer_product_card.dart';
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
        title: Text(context.t.clearHistoryQuestion),
        content: Text(context.t.clearHistoryMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(context.t.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(context.t.pick(ru: 'Очистить', kk: 'Тазалау')),
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

  void _openScanner() {
    Navigator.of(context).pushNamed(AppRoutes.scanner);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.t.history),
        actions: [
          if (_entries.isNotEmpty)
            IconButton(
              tooltip: context.t.clearHistory,
              onPressed: _clear,
              icon: const Icon(Icons.delete_sweep_rounded),
            ),
        ],
      ),
      body: ResponsivePage(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _HistoryList(
                entries: _entries,
                onTap: _open,
                onDelete: _delete,
                onScan: _openScanner,
              ),
      ),
    );
  }
}

class _HistoryList extends StatelessWidget {
  const _HistoryList({
    required this.entries,
    required this.onTap,
    required this.onDelete,
    required this.onScan,
  });

  final List<HistoryEntry> entries;
  final ValueChanged<HistoryEntry> onTap;
  final ValueChanged<HistoryEntry> onDelete;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return _EmptyState(
        icon: Icons.history_rounded,
        title: context.t.historyEmpty,
        message: context.t.pick(
          ru: 'Здесь появятся продукты, которые вы открывали или сканировали.',
          kk: 'Сіз ашқан немесе сканерлеген өнімдер осы жерде пайда болады.',
        ),
        actionLabel: context.t.scanProduct,
        onActionTap: onScan,
      );
    }

    String? lastDate;

    return ListView(
      children: [
        for (final entry in entries) ...[
          if (_dateLabel(context, entry.viewedAt) != lastDate)
            Padding(
              padding: const EdgeInsets.only(top: 16, bottom: 8),
              child: Text(
                lastDate = _dateLabel(context, entry.viewedAt),
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
          ConsumerProductCard.fromCached(
            product: entry.product,
            onTap: () => onTap(entry),
            trailing: IconButton(
              tooltip: context.t.pick(ru: 'Удалить', kk: 'Өшіру'),
              onPressed: () => onDelete(entry),
              icon: const Icon(Icons.delete_outline_rounded),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }

  String _dateLabel(BuildContext context, DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final value = DateTime(date.year, date.month, date.day);

    if (value == today) return context.t.pick(ru: 'Сегодня', kk: 'Бүгін');
    if (value == today.subtract(const Duration(days: 1))) {
      return context.t.pick(ru: 'Вчера', kk: 'Кеше');
    }

    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onActionTap,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onActionTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 72, horizontal: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colorScheme.primary, size: 38),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: onActionTap, child: Text(actionLabel)),
          ],
        ),
      ),
    );
  }
}
