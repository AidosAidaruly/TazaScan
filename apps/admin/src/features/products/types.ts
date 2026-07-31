export type ServingType = 'per100g' | 'per100ml'
export type ProductDataStatus = 'unverified' | 'community' | 'verified'

export type NutritionFactsDto = {
  servingType: ServingType
  energyKcal: number | null
  protein: number | null
  carbohydrates: number | null
  sugars: number | null
  fat: number | null
  saturatedFat: number | null
  fiber: number | null
  salt: number | null
}

export type ProductDto = {
  id: string
  barcode: string
  name: string
  brand: string | null
  category: string
  ingredients: string[]
  nutritionFacts: NutritionFactsDto
  healthScore: number
  imageUrl: string | null
  dataStatus: ProductDataStatus
  source: string | null
  lastVerifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ProductListResponse = {
  data: ProductDto[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export type ProductResponse = {
  data: ProductDto
}

export type ProductPayload = {
  barcode: string
  name: string
  brand?: string | null
  category: string
  ingredients: string[]
  nutritionFacts: NutritionFactsDto
  healthScore: number
  imageUrl?: string | null
  dataStatus: ProductDataStatus
  source?: string | null
  lastVerifiedAt?: string | null
}
