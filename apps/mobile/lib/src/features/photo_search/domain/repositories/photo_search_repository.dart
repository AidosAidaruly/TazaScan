import 'package:image_picker/image_picker.dart';
import 'package:project/src/features/photo_search/domain/entities/photo_search_result.dart';

abstract interface class PhotoSearchRepository {
  Future<PhotoSearchResult> searchByImage(XFile image);
}
