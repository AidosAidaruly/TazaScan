-- Moved from 20260801112204, which sorted before the migration that creates
-- "product_submissions" and broke replay on fresh databases.
-- DROP DEFAULT is a no-op where the default was already removed, so this is
-- safe on databases that applied the original 20260801112204.
-- AlterTable
ALTER TABLE "product_submissions" ALTER COLUMN "ingredients" DROP DEFAULT;
