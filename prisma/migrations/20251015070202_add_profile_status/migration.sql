-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('INCOMPLETE', 'COMPLETE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "profileStatus" "ProfileStatus" NOT NULL DEFAULT 'INCOMPLETE';

-- Backfill profile status based on existing name values
UPDATE "users"
SET "profileStatus" = CASE
  WHEN "name" IS NULL THEN 'INCOMPLETE'::"ProfileStatus"
  ELSE CASE
    WHEN LENGTH(BTRIM(REGEXP_REPLACE("name", '\s+', ' ', 'g'))) >= 2 THEN 'COMPLETE'::"ProfileStatus"
    ELSE 'INCOMPLETE'::"ProfileStatus"
  END
END,
    "name" = CASE
      WHEN "name" IS NULL THEN NULL
      ELSE NULLIF(BTRIM(REGEXP_REPLACE("name", '\s+', ' ', 'g')), '')
    END;
