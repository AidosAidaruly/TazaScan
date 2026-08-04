import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
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
    final errorContent = switch (error.errorCode) {
      MobileScannerErrorCode.permissionDenied => (
        icon: Icons.no_photography_rounded,
        title: 'Нет доступа к камере',
        message: 'Разреши доступ к камере в настройках системы.',
      ),
      MobileScannerErrorCode.controllerUninitialized ||
      MobileScannerErrorCode.genericError ||
      MobileScannerErrorCode.unsupported => (
        icon: Icons.videocam_off_rounded,
        title: 'Камера недоступна',
        message: 'Не удалось запустить камеру на этом устройстве.',
      ),
      _ => (
        icon: Icons.error_outline_rounded,
        title: 'Ошибка сканера',
        message: 'Что-то пошло не так при открытии сканера.',
      ),
    };

    return ColoredBox(
      color: Theme.of(context).colorScheme.surface,
      child: ScannerErrorView(
        icon: errorContent.icon,
        title: errorContent.title,
        message: errorContent.message,
        actionLabel: 'Закрыть',
        onActionPressed: onClose,
      ),
    );
  }
}
