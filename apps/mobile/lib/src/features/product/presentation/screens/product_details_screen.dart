import 'package:flutter/material.dart';
import 'package:project/src/core/widgets/responsive_page.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/presentation/widgets/health_score_card.dart';
import 'package:project/src/features/product/presentation/widgets/product_hero_card.dart';
import 'package:project/src/features/product/presentation/widgets/product_info_section.dart';
import 'package:project/src/features/product/presentation/widgets/product_nutrition_section.dart';

class ProductDetailsScreen extends StatelessWidget {
  const ProductDetailsScreen({required this.product, super.key});

  final Product product;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Product Details')),
      body: ResponsivePage(
        child: ListView(
          children: [
            ProductHeroCard(product: product),
            const SizedBox(height: 16),
            HealthScoreCard(score: product.healthScore),
            const SizedBox(height: 16),
            ProductInfoSection(product: product),
            const SizedBox(height: 16),
            ProductNutritionSection(product: product),
          ],
        ),
      ),
    );
  }
}
