import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:project/src/core/errors/app_exception.dart';
import 'package:project/src/core/localization/taza_localizations.dart';
import 'package:project/src/core/network/api_client.dart';
import 'package:project/src/core/router/app_router.dart';
import 'package:project/src/features/product/data/repositories/http_product_repository.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/services/product_service.dart';
import 'package:project/src/features/scanner/domain/barcode_validator.dart';
import 'package:project/src/features/scanner/presentation/widgets/invalid_barcode_banner.dart';
import 'package:project/src/features/scanner/presentation/widgets/scanner_camera_error_view.dart';
import 'package:project/src/features/scanner/presentation/widgets/scanner_loading_overlay.dart';
import 'package:project/src/features/scanner/presentation/widgets/scanner_overlay.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  late final MobileScannerController _controller;
  late final ProductService _productService;
  bool _isProcessing = false;
  String? _invalidBarcodeMessage;

  @override
  void initState() {
    super.initState();
    _controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      formats: const [
        BarcodeFormat.ean13,
        BarcodeFormat.ean8,
        BarcodeFormat.upcA,
        BarcodeFormat.upcE,
      ],
    );
    _productService = ProductService(HttpProductRepository(ApiClient()));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handleDetect(BarcodeCapture capture) async {
    if (_isProcessing) {
      return;
    }

    final detectedBarcode = capture.barcodes.firstOrNull;
    final barcode = detectedBarcode?.rawValue;
    final format = _mapBarcodeFormat(detectedBarcode?.format);

    if (format == null ||
        !BarcodeValidator.isSupportedProductBarcode(barcode, format)) {
      setState(() {
        _invalidBarcodeMessage = context.t.pick(
          ru: 'Этот штрихкод не похож на поддерживаемый код продукта.',
          kk: 'Бұл штрихкод қолдау көрсетілетін өнім коды емес сияқты.',
        );
      });
      return;
    }

    setState(() {
      _isProcessing = true;
      _invalidBarcodeMessage = null;
    });

    await _controller.stop();

    final lookupResult = await _findProduct(barcode!.trim());

    if (!mounted) {
      return;
    }

    switch (lookupResult) {
      case _ProductFound(:final product):
        Navigator.of(
          context,
        ).pushReplacementNamed(AppRoutes.productDetails, arguments: product);
      case _ProductLookupFailed(:final title, :final message):
        Navigator.of(context).pushReplacementNamed(
          AppRoutes.productLookupError,
          arguments: ProductLookupErrorArguments(
            title: title,
            message: message,
            barcode: barcode,
          ),
        );
    }
  }

  Future<_ProductLookupResult> _findProduct(String barcode) async {
    try {
      final product = await _productService.findByBarcode(barcode);
      return _ProductFound(product);
    } on NotFoundException {
      return _ProductLookupFailed(
        title: context.t.productNotFound,
        message: context.t.pick(
          ru: 'Этого штрихкода пока нет в нашей базе.',
          kk: 'Бұл штрихкод біздің базада әзірге жоқ.',
        ),
      );
    } on NetworkException {
      return _ProductLookupFailed(
        title: context.t.pick(
          ru: 'Нет подключения к интернету',
          kk: 'Интернет байланысы жоқ',
        ),
        message: context.t.checkConnectionAndRetry,
      );
    } on RequestTimeoutException {
      return _ProductLookupFailed(
        title: context.t.serverSlow,
        message: context.t.pick(
          ru: 'Сервер не успел ответить вовремя.',
          kk: 'Сервер уақытында жауап бермеді.',
        ),
      );
    } on ServerException {
      return _ProductLookupFailed(
        title: context.t.serverUnavailable,
        message: context.t.pick(
          ru: 'Не удалось связаться с сервисом продуктов. Попробуй позже.',
          kk: 'Өнім сервисімен байланысу мүмкін болмады. Кейінірек көріңіз.',
        ),
      );
    } on AppException {
      return _ProductLookupFailed(
        title: context.t.searchFailed,
        message: context.t.checkConnectionAndRetry,
      );
    }
  }

  ProductBarcodeFormat? _mapBarcodeFormat(BarcodeFormat? format) {
    return switch (format) {
      BarcodeFormat.ean8 => ProductBarcodeFormat.ean8,
      BarcodeFormat.ean13 => ProductBarcodeFormat.ean13,
      BarcodeFormat.upcA => ProductBarcodeFormat.upcA,
      BarcodeFormat.upcE => ProductBarcodeFormat.upcE,
      _ => null,
    };
  }

  void _cancelScan() {
    Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            errorBuilder: (context, error) {
              return ScannerCameraErrorView(error: error, onClose: _cancelScan);
            },
            onDetect: _handleDetect,
          ),
          ScannerOverlay(onCancel: _cancelScan),
          if (_invalidBarcodeMessage != null)
            InvalidBarcodeBanner(message: _invalidBarcodeMessage!),
          if (_isProcessing) const ScannerLoadingOverlay(),
        ],
      ),
    );
  }
}

sealed class _ProductLookupResult {
  const _ProductLookupResult();
}

final class _ProductFound extends _ProductLookupResult {
  const _ProductFound(this.product);

  final Product product;
}

final class _ProductLookupFailed extends _ProductLookupResult {
  const _ProductLookupFailed({required this.title, required this.message});

  final String title;
  final String message;
}
