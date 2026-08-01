import 'package:project/src/features/photo_search/domain/entities/photo_search_result.dart';
import 'package:project/src/features/product/data/models/product_model.dart';

class PhotoSearchResultModel extends PhotoSearchResult {
  const PhotoSearchResultModel({
    required super.matches,
    super.query,
    super.message,
  });

  factory PhotoSearchResultModel.fromJson(Map<String, dynamic> json) {
    final data = json['data'];

    return PhotoSearchResultModel(
      query: json['query'] as String?,
      message: json['message'] as String?,
      matches: data is List
          ? data
                .map(
                  (item) => ProductModel.fromJson(
                    Map<String, dynamic>.from(item as Map),
                  ),
                )
                .toList()
          : const [],
    );
  }
}
