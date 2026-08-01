import 'package:project/src/features/product_submission/domain/entities/product_submission_draft.dart';

abstract interface class ProductSubmissionRepository {
  Future<void> submit(ProductSubmissionDraft draft);
}
