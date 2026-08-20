CREATE TABLE "canonical_product_families" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "brand" TEXT,
    "variant" TEXT,
    "canonicalProductId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canonical_product_families_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "products"
ADD COLUMN "canonicalProductFamilyId" TEXT;

CREATE INDEX "canonical_product_families_canonicalProductId_idx" ON "canonical_product_families"("canonicalProductId");
CREATE INDEX "canonical_product_families_brand_idx" ON "canonical_product_families"("brand");
CREATE INDEX "canonical_product_families_canonicalName_idx" ON "canonical_product_families"("canonicalName");
CREATE INDEX "products_canonicalProductFamilyId_idx" ON "products"("canonicalProductFamilyId");

ALTER TABLE "canonical_product_families"
ADD CONSTRAINT "canonical_product_families_canonicalProductId_fkey"
FOREIGN KEY ("canonicalProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
ADD CONSTRAINT "products_canonicalProductFamilyId_fkey"
FOREIGN KEY ("canonicalProductFamilyId") REFERENCES "canonical_product_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
