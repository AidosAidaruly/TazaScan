CREATE TYPE "ScoreGrade" AS ENUM ('A', 'B', 'C', 'D', 'E');

CREATE TYPE "ScoreStatus" AS ENUM ('calculated', 'insufficient_data', 'requires_review');

ALTER TABLE "products"
ADD COLUMN "calculatedScore" INTEGER,
ADD COLUMN "calculatedGrade" "ScoreGrade",
ADD COLUMN "scoreStatus" "ScoreStatus" NOT NULL DEFAULT 'insufficient_data',
ADD COLUMN "scoreAlgorithm" TEXT,
ADD COLUMN "scoreVersion" TEXT,
ADD COLUMN "scoreCalculatedAt" TIMESTAMP(3),
ADD COLUMN "scoreDetails" JSONB,
ADD COLUMN "manualScoreOverride" INTEGER,
ADD COLUMN "manualOverrideReason" TEXT,
ADD COLUMN "manualOverrideAt" TIMESTAMP(3);
