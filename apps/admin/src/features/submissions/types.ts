import type { NutritionFactsDto, ProductDto, ServingType } from '../products/types'

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'needs_correction'

export type ProductSubmissionDto = {
  id: string
  barcode: string | null
  name: string | null
  brand: string | null
  category: string | null
  ingredients: string[]
  nutritionFacts: NutritionFactsDto & { servingType: ServingType | null }
  images: {
    frontImageUrl: string | null
    ingredientsImageUrl: string | null
    nutritionImageUrl: string | null
    barcodeImageUrl: string | null
  }
  status: SubmissionStatus
  moderationNote: string | null
  submittedAt: string
  reviewedAt: string | null
  reviewedByUserId: string | null
  createdProductId: string | null
  anonymousDeviceId: string | null
  createdProduct?: ProductDto | null
}

export type SubmissionListResponse = {
  data: ProductSubmissionDto[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export type SubmissionResponse = {
  data: ProductSubmissionDto
}

export type ApproveSubmissionPayload = {
  barcode: string
  name: string
  brand?: string | null
  category: string
  ingredients: string[]
  servingType: ServingType
  energyKcal?: number | null
  protein?: number | null
  carbohydrates?: number | null
  sugars?: number | null
  fat?: number | null
  saturatedFat?: number | null
  fiber?: number | null
  salt?: number | null
  moderationNote?: string | null
}
