CREATE TYPE "ProductSubmissionStatus" AS ENUM ('pending', 'approved', 'rejected', 'needs_correction');

CREATE TABLE "product_submissions" (
  "id" TEXT NOT NULL,
  "barcode" TEXT,
  "name" TEXT,
  "brand" TEXT,
  "category" TEXT,
  "ingredients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "servingType" "ServingType",
  "energyKcal" DOUBLE PRECISION,
  "protein" DOUBLE PRECISION,
  "carbohydrates" DOUBLE PRECISION,
  "sugars" DOUBLE PRECISION,
  "fat" DOUBLE PRECISION,
  "saturatedFat" DOUBLE PRECISION,
  "fiber" DOUBLE PRECISION,
  "salt" DOUBLE PRECISION,
  "frontImageUrl" TEXT,
  "ingredientsImageUrl" TEXT,
  "nutritionImageUrl" TEXT,
  "barcodeImageUrl" TEXT,
  "status" "ProductSubmissionStatus" NOT NULL DEFAULT 'pending',
  "moderationNote" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "createdProductId" TEXT,
  "anonymousDeviceId" TEXT,

  CONSTRAINT "product_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_submissions_status_idx" ON "product_submissions"("status");
CREATE INDEX "product_submissions_barcode_idx" ON "product_submissions"("barcode");
CREATE INDEX "product_submissions_submittedAt_idx" ON "product_submissions"("submittedAt");

ALTER TABLE "product_submissions"
ADD CONSTRAINT "product_submissions_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "product_submissions"
ADD CONSTRAINT "product_submissions_createdProductId_fkey"
FOREIGN KEY ("createdProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
