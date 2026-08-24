CREATE TYPE "HalalCertificationStatus" AS ENUM ('verified', 'unverified', 'expired');

CREATE TABLE "product_halal_certifications" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "HalalCertificationStatus" NOT NULL,
    "issuer" TEXT NOT NULL,
    "certificateNumber" TEXT,
    "validUntil" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_halal_certifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_halal_certifications_productId_idx" ON "product_halal_certifications"("productId");
CREATE INDEX "product_halal_certifications_status_idx" ON "product_halal_certifications"("status");
CREATE INDEX "product_halal_certifications_validUntil_idx" ON "product_halal_certifications"("validUntil");

ALTER TABLE "product_halal_certifications"
ADD CONSTRAINT "product_halal_certifications_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
