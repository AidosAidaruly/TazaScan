import 'package:image_picker/image_picker.dart';
import 'package:project/src/features/photo_search/domain/entities/photo_search_result.dart';
import 'package:project/src/features/photo_search/domain/repositories/photo_search_repository.dart';

class PhotoSearchService {
  const PhotoSearchService(this._repository);

  final PhotoSearchRepository _repository;

  Future<PhotoSearchResult> searchByImage(XFile image) {
    return _repository.searchByImage(image);
  }
}
