import 'package:image_picker/image_picker.dart';

class ProductSubmissionDraft {
  const ProductSubmissionDraft({
    this.barcode = '',
    this.name = '',
    this.brand = '',
    this.category = '',
    this.ingredients = '',
    this.servingType = 'per100g',
    this.energyKcal = '',
    this.protein = '',
    this.carbohydrates = '',
    this.sugars = '',
    this.fat = '',
    this.saturatedFat = '',
    this.fiber = '',
    this.salt = '',
    this.frontImage,
    this.ingredientsImage,
    this.nutritionImage,
    this.barcodeImage,
  });

  final String barcode;
  final String name;
  final String brand;
  final String category;
  final String ingredients;
  final String servingType;
  final String energyKcal;
  final String protein;
  final String carbohydrates;
  final String sugars;
  final String fat;
  final String saturatedFat;
  final String fiber;
  final String salt;
  final XFile? frontImage;
  final XFile? ingredientsImage;
  final XFile? nutritionImage;
  final XFile? barcodeImage;

  bool get hasIdentifyingData =>
      barcode.trim().isNotEmpty || name.trim().isNotEmpty || frontImage != null;
}
