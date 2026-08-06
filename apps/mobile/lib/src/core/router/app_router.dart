import 'package:flutter/material.dart';
import 'package:project/src/features/home/presentation/screens/home_screen.dart';
import 'package:project/src/features/photo_search/presentation/screens/photo_search_screen.dart';
import 'package:project/src/features/favorites/presentation/screens/favorites_screen.dart';
import 'package:project/src/features/history/presentation/screens/history_screen.dart';
import 'package:project/src/features/product/domain/entities/product.dart';
import 'package:project/src/features/product/domain/entities/product_details_args.dart';
import 'package:project/src/features/product/presentation/screens/product_details_screen.dart';
import 'package:project/src/features/product/presentation/screens/product_lookup_error_screen.dart';
import 'package:project/src/features/product_submission/presentation/screens/product_submission_screen.dart';
import 'package:project/src/features/profile/domain/legal_texts.dart';
import 'package:project/src/features/profile/presentation/screens/profile_screen.dart';
import 'package:project/src/features/profile/presentation/screens/about_screen.dart';
import 'package:project/src/features/profile/presentation/screens/legal_document_screen.dart';
import 'package:project/src/features/scanner/presentation/screens/scanner_screen.dart';
import 'package:project/src/features/splash/presentation/screens/splash_screen.dart';

abstract final class AppRoutes {
  static const splash = '/splash';
  static const home = '/';
  static const scanner = '/scanner';
  static const photoSearch = '/photo-search';
  static const favorites = '/favorites';
  static const history = '/history';
  static const profile = '/profile';
  static const about = '/about';
  static const privacy = '/privacy';
  static const terms = '/terms';
  static const productDetails = '/product-details';
  static const productLookupError = '/product-lookup-error';
  static const productSubmission = '/product-submission';
}

abstract final class AppRouter {
  static Route<void> onGenerateRoute(RouteSettings settings) {
    return switch (settings.name) {
      AppRoutes.splash => MaterialPageRoute(
        builder: (_) => const SplashScreen(),
        settings: settings,
      ),
      AppRoutes.home => MaterialPageRoute(
        builder: (_) => const HomeScreen(),
        settings: settings,
      ),
      AppRoutes.scanner => MaterialPageRoute(
        builder: (_) => const ScannerScreen(),
        settings: settings,
      ),
      AppRoutes.photoSearch => MaterialPageRoute(
        builder: (_) => const PhotoSearchScreen(),
        settings: settings,
      ),
      AppRoutes.favorites => MaterialPageRoute(
        builder: (_) => const FavoritesScreen(),
        settings: settings,
      ),
      AppRoutes.history => MaterialPageRoute(
        builder: (_) => const HistoryScreen(),
        settings: settings,
      ),
      AppRoutes.profile => MaterialPageRoute(
        builder: (_) => const ProfileScreen(),
        settings: settings,
      ),
      AppRoutes.about => MaterialPageRoute(
        builder: (_) => const AboutScreen(),
        settings: settings,
      ),
      AppRoutes.privacy => MaterialPageRoute(
        builder: (_) => const LegalDocumentScreen(
          title: 'Политика конфиденциальности',
          body: privacyPolicyText,
        ),
        settings: settings,
      ),
      AppRoutes.terms => MaterialPageRoute(
        builder: (_) => const LegalDocumentScreen(
          title: 'Условия использования',
          body: termsOfUseText,
        ),
        settings: settings,
      ),
      AppRoutes.productDetails => MaterialPageRoute(
        builder: (_) {
          final args = _readRequiredProductArgument(settings);

          return ProductDetailsScreen(
            product: args.product,
            refreshFromNetwork: args.refreshFromNetwork,
          );
        },
        settings: settings,
      ),
      AppRoutes.productLookupError => MaterialPageRoute(
        builder: (_) {
          final error = _readRequiredLookupErrorArgument(settings);

          return ProductLookupErrorScreen(
            title: error.title,
            message: error.message,
            barcode: error.barcode,
          );
        },
        settings: settings,
      ),
      AppRoutes.productSubmission => MaterialPageRoute(
        builder: (_) => ProductSubmissionScreen(
          initialBarcode: settings.arguments is String
              ? settings.arguments! as String
              : null,
        ),
        settings: settings,
      ),
      _ => MaterialPageRoute(
        builder: (_) => const HomeScreen(),
        settings: settings,
      ),
    };
  }

  static ProductDetailsArgs _readRequiredProductArgument(
    RouteSettings settings,
  ) {
    final argument = settings.arguments;

    if (argument is ProductDetailsArgs) {
      return argument;
    }

    if (argument is Product) {
      return ProductDetailsArgs(product: argument);
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
    this.barcode,
  });

  final String title;
  final String message;
  final String? barcode;
}
