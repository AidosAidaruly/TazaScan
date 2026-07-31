const productBarcodePattern = /^\d{8}$|^\d{12}$|^\d{13}$/

export function isValidBarcode(value: string) {
  return productBarcodePattern.test(value.trim())
}
