-- Create role enum for collection memberships
CREATE TYPE "CollectionRole" AS ENUM ('OWNER', 'EDITOR', 'VIEW_ONLY');

-- Create collection_members table
CREATE TABLE "collection_members" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CollectionRole" NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "collection_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "collection_members_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "collection_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique membership per user per collection
CREATE UNIQUE INDEX "collection_members_collection_id_user_id_key"
    ON "collection_members" ("collectionId", "userId");

-- Index for querying by user
CREATE INDEX "collection_members_user_id_idx"
    ON "collection_members" ("userId");

-- Index for membership role lookups
CREATE INDEX "collection_members_collection_id_role_idx"
    ON "collection_members" ("collectionId", "role");

-- Ensure a single owner per collection
CREATE UNIQUE INDEX "collection_members_single_owner_per_collection"
    ON "collection_members" ("collectionId")
    WHERE "role" = 'OWNER';

-- Backfill existing collections with owner membership records
INSERT INTO "collection_members" ("id", "collectionId", "userId", "role")
SELECT
    'cm_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20) AS id,
    c."id",
    c."userId",
    'OWNER'::"CollectionRole"
FROM "collections" c
WHERE NOT EXISTS (
    SELECT 1
    FROM "collection_members" m
    WHERE m."collectionId" = c."id"
      AND m."role" = 'OWNER'
);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION set_collection_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_collection_members_updated_at
BEFORE UPDATE ON "collection_members"
FOR EACH ROW
EXECUTE PROCEDURE set_collection_members_updated_at();
