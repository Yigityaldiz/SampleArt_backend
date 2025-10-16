-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('INCOMPLETE', 'COMPLETE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "profileStatus" "ProfileStatus" NOT NULL DEFAULT 'INCOMPLETE';

-- Backfill profile status and normalized names for existing users
UPDATE "users"
SET "profileStatus" = CASE
  WHEN "name" IS NULL THEN 'INCOMPLETE'::"ProfileStatus"
  ELSE CASE
    WHEN LENGTH(BTRIM(REGEXP_REPLACE("name", E'\\s+', ' ', 'g'))) >= 2 THEN 'COMPLETE'::"ProfileStatus"
    ELSE 'INCOMPLETE'::"ProfileStatus"
  END
END,
    "name" = CASE
      WHEN "name" IS NULL THEN NULL
      ELSE NULLIF(BTRIM(REGEXP_REPLACE("name", E'\\s+', ' ', 'g')), '')
    END;
