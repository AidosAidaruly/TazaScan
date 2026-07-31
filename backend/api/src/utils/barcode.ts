const productBarcodePattern = /^\d{8}$|^\d{12}$|^\d{13}$/;

export function isSupportedProductBarcode(barcode: string) {
  return productBarcodePattern.test(barcode);
}
