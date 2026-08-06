const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 5 * 1024 * 1024;

export function validateProductImageFile(file: File) {
  if (!allowedImageTypes.has(file.type)) {
    return "Use JPEG, PNG, or WebP image.";
  }

  if (file.size > maxImageSize) {
    return "Image must be 5 MB or smaller.";
  }

  return "";
}
