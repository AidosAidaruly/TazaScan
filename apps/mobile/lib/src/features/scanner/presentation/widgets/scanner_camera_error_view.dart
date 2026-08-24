import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/features/scanner/presentation/widgets/scanner_error_view.dart';

class ScannerCameraErrorView extends StatelessWidget {
  const ScannerCameraErrorView({
    required this.error,
    required this.onClose,
    super.key,
  });

  final MobileScannerException error;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final t = context.t;
    final errorContent = switch (error.errorCode) {
      MobileScannerErrorCode.permissionDenied => (
        icon: Icons.no_photography_rounded,
        title: t.pick(ru: 'Нет доступа к камере', kk: 'Камераға рұқсат жоқ'),
        message: t.pick(
          ru: 'Разреши доступ к камере в настройках системы.',
          kk: 'Жүйе баптауларында камераға рұқсат беріңіз.',
        ),
      ),
      MobileScannerErrorCode.controllerUninitialized ||
      MobileScannerErrorCode.genericError ||
      MobileScannerErrorCode.unsupported => (
        icon: Icons.videocam_off_rounded,
        title: t.pick(ru: 'Камера недоступна', kk: 'Камера қолжетімсіз'),
        message: t.pick(
          ru: 'Не удалось запустить камеру на этом устройстве.',
          kk: 'Бұл құрылғыда камераны іске қосу мүмкін болмады.',
        ),
      ),
      _ => (
        icon: Icons.error_outline_rounded,
        title: t.pick(ru: 'Ошибка сканера', kk: 'Сканер қатесі'),
        message: t.pick(
          ru: 'Что-то пошло не так при открытии сканера.',
          kk: 'Сканерді ашу кезінде қате пайда болды.',
        ),
      ),
    };

    return ColoredBox(
      color: Theme.of(context).colorScheme.surface,
      child: ScannerErrorView(
        icon: errorContent.icon,
        title: errorContent.title,
        message: errorContent.message,
        actionLabel: t.pick(ru: 'Закрыть', kk: 'Жабу'),
        onActionPressed: onClose,
      ),
    );
  }
}
