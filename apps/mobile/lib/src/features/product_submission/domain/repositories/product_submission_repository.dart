import 'package:image_picker/image_picker.dart';
import 'package:project/src/features/product_submission/domain/entities/product_submission_draft.dart';
import 'package:project/src/features/product_submission/domain/entities/submission_ocr_candidate.dart';

abstract interface class ProductSubmissionRepository {
  Future<void> submit(ProductSubmissionDraft draft);

  Future<NutritionOcrCandidate> recognizeNutrition(XFile image);

  Future<IngredientsOcrCandidate> recognizeIngredients(XFile image);
}
