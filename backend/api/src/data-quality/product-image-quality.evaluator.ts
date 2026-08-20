import type { Product } from '../generated/prisma/client';

export type ProductImageQualityStatus =
  | 'usable_primary'
  | 'review_needed'
  | 'unsuitable';

export type ProductImageQualityResult = {
  status: ProductImageQualityStatus;
  usableAsPrimary: boolean;
  reasons: string[];
};

export type ProductImageQualityInput = Pick<
  Product,
  'imageUrl' | 'source' | 'dataStatus'
>;

const lowQualityPathMarkers = [
  'ingredients',
  'nutrition',
  'packaging',
  'other',
  'small',
  'thumb'
];

export class ProductImageQualityEvaluator {
  evaluate(input: ProductImageQualityInput): ProductImageQualityResult {
    const imageUrl = input.imageUrl?.trim() ?? '';

    if (!imageUrl) {
      return {
        status: 'unsuitable',
        usableAsPrimary: false,
        reasons: ['missing_image']
      };
    }

    if (this.isManualOrVerifiedImage(input)) {
      return {
        status: 'usable_primary',
        usableAsPrimary: true,
        reasons: ['manual_or_verified_image']
      };
    }

    if (this.isApprovedUserSubmissionFrontImage(input)) {
      return {
        status: 'usable_primary',
        usableAsPrimary: true,
        reasons: ['approved_user_submission_front_image']
      };
    }

    if (!this.isExternalCommunityImage(input)) {
      return {
        status: 'review_needed',
        usableAsPrimary: false,
        reasons: ['unverified_external_image_source']
      };
    }

    return this.evaluateExternalCommunityImage(imageUrl);
  }

  selectPrimaryImageUrl(input: ProductImageQualityInput) {
    return this.evaluate(input).usableAsPrimary ? input.imageUrl : null;
  }

  private evaluateExternalCommunityImage(imageUrl: string): ProductImageQualityResult {
    const url = this.parseUrl(imageUrl);

    if (!url) {
      return {
        status: 'unsuitable',
        usableAsPrimary: false,
        reasons: ['invalid_image_url']
      };
    }

    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    const reasons: string[] = [];

    if (!host.endsWith('openfoodfacts.org')) {
      return {
        status: 'review_needed',
        usableAsPrimary: false,
        reasons: ['unknown_external_image_host']
      };
    }

    if (lowQualityPathMarkers.some((marker) => path.includes(marker))) {
      reasons.push('not_front_packshot_candidate');
    }

    if (!path.includes('front')) {
      reasons.push('not_front_packshot_candidate');
    }

    if (!this.hasSufficientResolution(path)) {
      reasons.push('insufficient_resolution_hint');
    }

    if (reasons.length > 0) {
      return {
        status: 'review_needed',
        usableAsPrimary: false,
        reasons: [...new Set(reasons)]
      };
    }

    return {
      status: 'usable_primary',
      usableAsPrimary: true,
      reasons: ['open_food_facts_front_image']
    };
  }

  private isManualOrVerifiedImage(input: ProductImageQualityInput) {
    return input.dataStatus === 'verified' || input.imageUrl?.startsWith('/uploads/products/');
  }

  private isApprovedUserSubmissionFrontImage(input: ProductImageQualityInput) {
    return (
      input.dataStatus === 'community' &&
      input.source?.trim().toLowerCase() === 'user_submission' &&
      input.imageUrl?.startsWith('/product-submissions/uploads/')
    );
  }

  private isExternalCommunityImage(input: ProductImageQualityInput) {
    return (
      input.dataStatus === 'community' ||
      input.source?.trim().toLowerCase() === 'open food facts'
    );
  }

  private hasSufficientResolution(path: string) {
    if (/\.(100|200)\.(jpg|png)$/.test(path)) {
      return false;
    }

    return (
      path.endsWith('.400.jpg') ||
      path.endsWith('.400.png') ||
      path.endsWith('.full.jpg') ||
      path.endsWith('.full.png') ||
      path.endsWith('.jpg') ||
      path.endsWith('.png')
    );
  }

  private parseUrl(imageUrl: string) {
    try {
      return new URL(imageUrl);
    } catch {
      return null;
    }
  }
}

export const productImageQualityEvaluator = new ProductImageQualityEvaluator();
