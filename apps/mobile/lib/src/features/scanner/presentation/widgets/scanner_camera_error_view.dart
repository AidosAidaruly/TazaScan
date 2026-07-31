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
        title: 'Camera permission denied',
        message: 'Allow camera access in system settings to scan products.',
      ),
      MobileScannerErrorCode.controllerUninitialized ||
      MobileScannerErrorCode.genericError ||
      MobileScannerErrorCode.unsupported => (
        icon: Icons.videocam_off_rounded,
        title: 'Camera unavailable',
        message: 'The camera could not be started on this device.',
      ),
      _ => (
        icon: Icons.error_outline_rounded,
        title: 'Scanner error',
        message: 'Something went wrong while opening the scanner.',
      ),
    };

    return ColoredBox(
      color: Theme.of(context).colorScheme.surface,
      child: ScannerErrorView(
        icon: errorContent.icon,
        title: errorContent.title,
        message: errorContent.message,
        actionLabel: 'Close',
        onActionPressed: onClose,
      ),
    );
  }
}
