-- CreateTable
CREATE TABLE "StockOpnameRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockOpnameRecord_pkey" PRIMARY KEY ("id")
);
