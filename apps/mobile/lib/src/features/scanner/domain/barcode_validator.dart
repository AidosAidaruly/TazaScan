enum ProductBarcodeFormat { ean8, ean13, upcA, upcE }

abstract final class BarcodeValidator {
  static final _digitsOnlyPattern = RegExp(r'^\d+$');

  static bool isSupportedProductBarcode(
    String? value,
    ProductBarcodeFormat format,
  ) {
    if (value == null) {
      return false;
    }

    final barcode = value.trim();

    if (!_digitsOnlyPattern.hasMatch(barcode)) {
      return false;
    }

    return switch (format) {
      ProductBarcodeFormat.ean8 =>
        barcode.length == 8 && _hasValidGs1CheckDigit(barcode),
      ProductBarcodeFormat.ean13 =>
        barcode.length == 13 && _hasValidGs1CheckDigit(barcode),
      ProductBarcodeFormat.upcA =>
        barcode.length == 12 && _hasValidGs1CheckDigit(barcode),
      ProductBarcodeFormat.upcE => barcode.length == 8,
    };
  }

  /// Validates a manually typed barcode against every supported product
  /// barcode format, since manual entry has no scanner-reported format to
  /// check against (unlike [isSupportedProductBarcode], used after a camera
  /// detection).
  static bool isValidManualBarcode(String? value) {
    return ProductBarcodeFormat.values.any(
      (format) => isSupportedProductBarcode(value, format),
    );
  }

  static bool _hasValidGs1CheckDigit(String barcode) {
    final expected = int.parse(barcode[barcode.length - 1]);
    final digits = barcode
        .substring(0, barcode.length - 1)
        .split('')
        .map(int.parse)
        .toList();

    var sum = 0;
    var weight = 3;

    for (var index = digits.length - 1; index >= 0; index -= 1) {
      sum += digits[index] * weight;
      weight = weight == 3 ? 1 : 3;
    }

    final calculated = (10 - (sum % 10)) % 10;
    return calculated == expected;
  }
}
