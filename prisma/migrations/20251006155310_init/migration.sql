CREATE EXTENSION IF NOT EXISTS citext;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" CITEXT,
    "name" TEXT,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "samples" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "applicationArea" TEXT,
    "surface" TEXT,
    "colorHex" CHAR(7),
    "colorName" TEXT,
    "companyName" TEXT,
    "priceMinor" INTEGER,
    "priceCurrency" CHAR(3),
    "quantityValue" DECIMAL(10,2),
    "quantityUnit" TEXT,
    "sizeText" TEXT,
    "locationLat" DECIMAL(9,6),
    "locationLng" DECIMAL(9,6),
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_images" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurhash" TEXT,
    "exif" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sample_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_samples" (
    "collectionId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_samples_pkey" PRIMARY KEY ("collectionId","sampleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "collections_userId_updatedAt_idx" ON "collections"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "collections_userId_name_key" ON "collections"("userId", "name");

-- CreateIndex
CREATE INDEX "samples_userId_updatedAt_idx" ON "samples"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "samples_isDeleted_idx" ON "samples"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "sample_images_sampleId_key" ON "sample_images"("sampleId");

-- CreateIndex
CREATE INDEX "collection_samples_collectionId_position_idx" ON "collection_samples"("collectionId", "position");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_images" ADD CONSTRAINT "sample_images_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_samples" ADD CONSTRAINT "collection_samples_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_samples" ADD CONSTRAINT "collection_samples_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;
