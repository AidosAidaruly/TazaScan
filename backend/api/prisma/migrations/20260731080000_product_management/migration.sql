CREATE TYPE "ServingType" AS ENUM ('per100g', 'per100ml');

CREATE TYPE "ProductDataStatus" AS ENUM ('unverified', 'community', 'verified');

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT NOT NULL,
    "ingredients" TEXT[] NOT NULL,
    "servingType" "ServingType" NOT NULL,
    "energyKcal" DOUBLE PRECISION,
    "protein" DOUBLE PRECISION,
    "carbohydrates" DOUBLE PRECISION,
    "sugars" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "saturatedFat" DOUBLE PRECISION,
    "fiber" DOUBLE PRECISION,
    "salt" DOUBLE PRECISION,
    "healthScore" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "dataStatus" "ProductDataStatus" NOT NULL DEFAULT 'unverified',
    "source" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");
CREATE INDEX "products_barcode_idx" ON "products"("barcode");
CREATE INDEX "products_name_idx" ON "products"("name");
CREATE INDEX "products_brand_idx" ON "products"("brand");
CREATE INDEX "products_category_idx" ON "products"("category");
