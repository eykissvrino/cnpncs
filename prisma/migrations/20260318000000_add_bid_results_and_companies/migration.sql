-- CreateTable BidResult
CREATE TABLE "BidResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bidNtceNo" TEXT NOT NULL,
    "bidNtceOrd" TEXT,
    "bidNtceNm" TEXT NOT NULL,
    "opengDt" TEXT,
    "sucsfbidMthdNm" TEXT,
    "companyName" TEXT,
    "companyBizno" TEXT,
    "bidAmount" TEXT,
    "sucsfbidAmt" TEXT,
    "ranking" INTEGER,
    "resultType" TEXT NOT NULL DEFAULT 'completed',
    "agency" TEXT,
    "rawData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex (unique constraint on BidResult)
CREATE UNIQUE INDEX "BidResult_bidNtceNo_bidNtceOrd_companyBizno_key" ON "BidResult"("bidNtceNo", "bidNtceOrd", "companyBizno");

-- CreateTable Company
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bizno" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalBids" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" TEXT,
    "lastBidDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex (unique constraint on Company)
CREATE UNIQUE INDEX "Company_bizno_key" ON "Company"("bizno");
