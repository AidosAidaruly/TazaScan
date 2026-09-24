import 'package:flutter/material.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/features/favorites/data/datasources/favorites_local_data_source.dart';
import 'package:project/src/features/favorites/data/repositories/local_favorites_repository.dart';
import 'package:project/src/features/history/data/datasources/history_local_data_source.dart';
import 'package:project/src/features/history/data/repositories/local_history_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  int? _scanCount;
  int? _favoritesCount;

  @override
  void initState() {
    super.initState();
    _loadCounts();
  }

  Future<void> _loadCounts() async {
    final preferences = await SharedPreferences.getInstance();
    final historyRepository = LocalHistoryRepository(
      HistoryLocalDataSource(preferences),
    );
    final favoritesRepository = LocalFavoritesRepository(
      FavoritesLocalDataSource(preferences),
    );
    final history = await historyRepository.list();
    final favorites = await favoritesRepository.list();

    if (!mounted) return;
    setState(() {
      _scanCount = history.length;
      _favoritesCount = favorites.length;
    });
  }

  Future<void> _chooseLanguage(BuildContext context) async {
    final controller = context.tazaLocaleController;
    final selected = await showModalBottomSheet<TazaLocale>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        final t = context.t;

        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                title: Text(t.russian),
                trailing: controller.locale == TazaLocale.ru
                    ? const Icon(Icons.check_rounded)
                    : null,
                onTap: () => Navigator.of(context).pop(TazaLocale.ru),
              ),
              ListTile(
                title: Text(t.kazakh),
                trailing: controller.locale == TazaLocale.kk
                    ? const Icon(Icons.check_rounded)
                    : null,
                onTap: () => Navigator.of(context).pop(TazaLocale.kk),
              ),
            ],
          ),
        );
      },
    );

    if (selected != null) {
      await controller.setLocale(selected);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    final currentLanguage =
        context.tazaLocaleController.locale == TazaLocale.kk
            ? t.kazakh
            : t.russian;

    return Scaffold(
      body: ResponsivePage(
        child: ListView(
          children: [
            Text(
              t.profile,
              style: textTheme.headlineLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 18),
            const _DeviceInfoCard(),
            const SizedBox(height: 14),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _StatCard(
                      value: _scanCount,
                      label: t.pick(ru: 'сканов', kk: 'сканерлеу'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      value: _favoritesCount,
                      label: t.pick(ru: 'в избранном', kk: 'таңдаулыда'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            _GroupCard(
              children: [
                _ProfileRow(
                  icon: Icons.history_rounded,
                  title: t.pick(ru: 'История сканов', kk: 'Сканерлеу тарихы'),
                  onTap: () =>
                      Navigator.of(context).pushNamed(AppRoutes.history),
                ),
                const _RowDivider(),
                _ProfileRow(
                  icon: Icons.language_rounded,
                  title: t.language,
                  trailingText: currentLanguage,
                  onTap: () => _chooseLanguage(context),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _GroupCard(
              children: [
                _ProfileRow(
                  icon: Icons.info_outline_rounded,
                  title: t.pick(ru: 'О TazaScan', kk: 'TazaScan туралы'),
                  onTap: () =>
                      Navigator.of(context).pushNamed(AppRoutes.about),
                ),
                const _RowDivider(),
                _ProfileRow(
                  icon: Icons.privacy_tip_outlined,
                  title: t.pick(
                    ru: 'Политика конфиденциальности',
                    kk: 'Құпиялық саясаты',
                  ),
                  onTap: () =>
                      Navigator.of(context).pushNamed(AppRoutes.privacy),
                ),
                const _RowDivider(),
                _ProfileRow(
                  icon: Icons.description_outlined,
                  title: t.pick(
                    ru: 'Условия использования',
                    kk: 'Пайдалану шарттары',
                  ),
                  onTap: () =>
                      Navigator.of(context).pushNamed(AppRoutes.terms),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Center(
              child: Text(
                t.pick(
                  ru: 'TazaScan · версия 1.0',
                  kk: 'TazaScan · 1.0 нұсқасы',
                ),
                style: textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Dark-green "data lives on this device" banner near the top of the
/// profile screen.
class _DeviceInfoCard extends StatelessWidget {
  const _DeviceInfoCard();

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final t = context.t;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.primary,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(13),
              ),
              child: const Icon(
                Icons.smartphone_rounded,
                color: Colors.white,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t.pick(
                      ru: 'Данные на этом устройстве',
                      kk: 'Осы құрылғыдағы деректер',
                    ),
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    t.pick(
                      ru:
                          'Аккаунты пока недоступны. История и избранное хранятся локально.',
                      kk:
                          'Аккаунттар әзірге қолжетімсіз. Тарих пен таңдаулылар жергілікті сақталады.',
                    ),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontSize: 13,
                      height: 1.3,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.value, required this.label});

  final int? value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              value?.toString() ?? '—',
              style: textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Rounded white grouped-list container: rows are clipped to its corners so
/// their ink ripples never bleed past the rounded edges.
class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Column(children: children),
      ),
    );
  }
}

class _ProfileRow extends StatelessWidget {
  const _ProfileRow({
    required this.icon,
    required this.title,
    required this.onTap,
    this.trailingText,
  });

  final IconData icon;
  final String title;
  final String? trailingText;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 17, color: colorScheme.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (trailingText != null) ...[
                Text(
                  trailingText!,
                  style: textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: 2),
              ],
              Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RowDivider extends StatelessWidget {
  const _RowDivider();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 60),
      child: Divider(
        height: 1,
        thickness: 1,
        color: Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.5),
      ),
    );
  }
}
