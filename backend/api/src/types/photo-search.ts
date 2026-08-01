import type { ProductDto } from './product';

export type PhotoSearchMatchDto = ProductDto & {
  matchScore: number;
};

export type PhotoSearchResponseDto = {
  query: string | null;
  message: string | null;
  matches: PhotoSearchMatchDto[];
};
