class Product {
  const Product({
    required this.id,
    required this.barcode,
    required this.name,
    required this.ingredients,
    required this.nutritionFacts,
    required this.healthScore,
    required this.createdAt,
    required this.updatedAt,
    this.brand,
    this.category,
  });

  final String id;
  final String barcode;
  final String name;
  final String? brand;
  final String? category;
  final List<String> ingredients;
  final Map<String, dynamic> nutritionFacts;
  final int healthScore;
  final DateTime createdAt;
  final DateTime updatedAt;
}
