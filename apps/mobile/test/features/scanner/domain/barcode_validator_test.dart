import 'package:flutter_test/flutter_test.dart';
import 'package:project/src/features/scanner/domain/barcode_validator.dart';

void main() {
  group('BarcodeValidator', () {
    test('accepts supported product barcodes', () {
      expect(
        BarcodeValidator.isSupportedProductBarcode(
          '96385074',
          ProductBarcodeFormat.ean8,
        ),
        isTrue,
      );
      expect(
        BarcodeValidator.isSupportedProductBarcode(
          '036000291452',
          ProductBarcodeFormat.upcA,
        ),
        isTrue,
      );
      expect(
        BarcodeValidator.isSupportedProductBarcode(
          '5901234123457',
          ProductBarcodeFormat.ean13,
        ),
        isTrue,
      );
      expect(
        BarcodeValidator.isSupportedProductBarcode(
          '01234565',
          ProductBarcodeFormat.upcE,
        ),
        isTrue,
      );
    });

    test('rejects unsupported values', () {
      expect(
        BarcodeValidator.isSupportedProductBarcode(
          null,
          ProductBarcodeFormat.ean13,
        ),
        isFalse,
      );
      expect(
        BarcodeValidator.isSupportedProductBarcode(
          '',
          ProductBarcodeFormat.ean13,
        ),
        isFalse,
      );
      expect(
        BarcodeValidator.isSupportedProductBarcode(
          'ABC12345',
          ProductBarcodeFormat.ean8,
        ),
        isFalse,
      );
      expect(
        BarcodeValidator.isSupportedProductBarcode(
          '123456',
          ProductBarcodeFormat.ean8,
        ),
        isFalse,
      );
      expect(
        BarcodeValidator.isSupportedProductBarcode(
          '5901234123458',
          ProductBarcodeFormat.ean13,
        ),
        isFalse,
      );
    });
  });
}
