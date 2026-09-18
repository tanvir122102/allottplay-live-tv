-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StreamHealth" AS ENUM ('UNKNOWN', 'CHECKING', 'ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "m3uUrl" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "streamUrl" TEXT NOT NULL,
    "streamUrlOverride" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'hls',
    "logoUrl" TEXT,
    "groupTitle" TEXT,
    "tvgId" TEXT,
    "tvgName" TEXT,
    "healthStatus" "StreamHealth" NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" TIMESTAMP(3),
    "lastOnlineAt" TIMESTAMP(3),
    "healthError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "websiteName" TEXT NOT NULL DEFAULT 'LIVE TV',
    "websiteUrl" TEXT,
    "websiteLogoUrl" TEXT,
    "showPlayerBrand" BOOLEAN NOT NULL DEFAULT true,
    "playerBrandPosition" TEXT NOT NULL DEFAULT 'bottom',
    "brandTextSize" INTEGER NOT NULL DEFAULT 9,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "maxDevices" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccessLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessDeviceSession" (
    "id" TEXT NOT NULL,
    "accessLinkId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessDeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Playlist_name_idx" ON "Playlist"("name");

-- CreateIndex
CREATE INDEX "Channel_playlistId_idx" ON "Channel"("playlistId");

-- CreateIndex
CREATE INDEX "Channel_groupTitle_idx" ON "Channel"("groupTitle");

-- CreateIndex
CREATE INDEX "Channel_healthStatus_idx" ON "Channel"("healthStatus");

-- CreateIndex
CREATE INDEX "Channel_lastCheckedAt_idx" ON "Channel"("lastCheckedAt");

-- CreateIndex
CREATE INDEX "Channel_healthStatus_groupTitle_idx" ON "Channel"("healthStatus", "groupTitle");

-- CreateIndex
CREATE INDEX "Channel_playlistId_healthStatus_idx" ON "Channel"("playlistId", "healthStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_playlistId_sourceKey_key" ON "Channel"("playlistId", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "AccessLink_token_key" ON "AccessLink"("token");

-- CreateIndex
CREATE INDEX "AccessLink_token_idx" ON "AccessLink"("token");

-- CreateIndex
CREATE INDEX "AccessLink_expiresAt_idx" ON "AccessLink"("expiresAt");

-- CreateIndex
CREATE INDEX "AccessDeviceSession_accessLinkId_idx" ON "AccessDeviceSession"("accessLinkId");

-- CreateIndex
CREATE INDEX "AccessDeviceSession_lastSeenAt_idx" ON "AccessDeviceSession"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccessDeviceSession_accessLinkId_deviceId_key" ON "AccessDeviceSession"("accessLinkId", "deviceId");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessDeviceSession" ADD CONSTRAINT "AccessDeviceSession_accessLinkId_fkey" FOREIGN KEY ("accessLinkId") REFERENCES "AccessLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

