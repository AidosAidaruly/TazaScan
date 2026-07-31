import 'package:flutter/material.dart';
import 'package:project/src/features/home/presentation/screens/home_screen.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/presentation/screens/product_details_screen.dart';
import 'package:project/src/features/product/presentation/screens/product_lookup_error_screen.dart';
import 'package:project/src/features/scanner/presentation/screens/scanner_screen.dart';

abstract final class AppRoutes {
  static const home = '/';
  static const scanner = '/scanner';
  static const productDetails = '/product-details';
  static const productLookupError = '/product-lookup-error';
}

abstract final class AppRouter {
  static Route<void> onGenerateRoute(RouteSettings settings) {
    return switch (settings.name) {
      AppRoutes.home => MaterialPageRoute(
        builder: (_) => const HomeScreen(),
        settings: settings,
      ),
      AppRoutes.scanner => MaterialPageRoute(
        builder: (_) => const ScannerScreen(),
        settings: settings,
      ),
      AppRoutes.productDetails => MaterialPageRoute(
        builder: (_) => ProductDetailsScreen(
          product: _readRequiredProductArgument(settings),
        ),
        settings: settings,
      ),
      AppRoutes.productLookupError => MaterialPageRoute(
        builder: (_) {
          final error = _readRequiredLookupErrorArgument(settings);

          return ProductLookupErrorScreen(
            title: error.title,
            message: error.message,
          );
        },
        settings: settings,
      ),
      _ => MaterialPageRoute(
        builder: (_) => const HomeScreen(),
        settings: settings,
      ),
    };
  }

  static Product _readRequiredProductArgument(RouteSettings settings) {
    final argument = settings.arguments;

    if (argument is Product) {
      return argument;
    }

    throw ArgumentError('Route ${settings.name} requires a Product argument.');
  }

  static ProductLookupErrorArguments _readRequiredLookupErrorArgument(
    RouteSettings settings,
  ) {
    final argument = settings.arguments;

    if (argument is ProductLookupErrorArguments) {
      return argument;
    }

    throw ArgumentError('Route ${settings.name} requires error arguments.');
  }
}

class ProductLookupErrorArguments {
  const ProductLookupErrorArguments({
    required this.title,
    required this.message,
  });

  final String title;
  final String message;
}
