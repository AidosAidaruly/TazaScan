import 'package:project/src/features/product/domain/entities/cached_product_summary.dart';
import 'package:project/src/features/product/domain/entities/product.dart';

class CachedProductSummaryModel extends CachedProductSummary {
  const CachedProductSummaryModel({
    required super.id,
    required super.barcode,
    required super.name,
    required super.calculatedScore,
    required super.createdAt,
    required super.updatedAt,
    super.brand,
    super.category,
    super.imageUrl,
    super.grade,
    super.scoreLabel,
  });

  factory CachedProductSummaryModel.fromProduct(Product product) {
    final summary = CachedProductSummary.fromProduct(product);

    return CachedProductSummaryModel.fromEntity(summary);
  }

  factory CachedProductSummaryModel.fromEntity(CachedProductSummary summary) {
    return CachedProductSummaryModel(
      id: summary.id,
      barcode: summary.barcode,
      name: summary.name,
      brand: summary.brand,
      category: summary.category,
      imageUrl: summary.imageUrl,
      calculatedScore: summary.calculatedScore,
      grade: summary.grade,
      scoreLabel: summary.scoreLabel,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    );
  }

  factory CachedProductSummaryModel.fromJson(Map<String, dynamic> json) {
    return CachedProductSummaryModel(
      id: json['id'] as String,
      barcode: json['barcode'] as String,
      name: json['name'] as String,
      brand: json['brand'] as String?,
      category: json['category'] as String?,
      imageUrl: json['imageUrl'] as String?,
      calculatedScore: json['calculatedScore'] as int,
      grade: json['grade'] as String?,
      scoreLabel: json['scoreLabel'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'barcode': barcode,
      'name': name,
      'brand': brand,
      'category': category,
      'imageUrl': imageUrl,
      'calculatedScore': calculatedScore,
      'grade': grade,
      'scoreLabel': scoreLabel,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}
