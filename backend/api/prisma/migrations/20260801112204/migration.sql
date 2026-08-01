-- AlterTable
ALTER TABLE "product_submissions" ALTER COLUMN "ingredients" DROP DEFAULT;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "healthScore" SET DEFAULT 0;
