-- CreateTable
CREATE TABLE "WorkingExpenseSheetRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkingExpenseSheetRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrShiftRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrShiftRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrShiftScheduleRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrShiftScheduleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrAttendanceSummaryRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrAttendanceSummaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrPerformanceReviewRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPerformanceReviewRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrThlContractRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrThlContractRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrResignationRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrResignationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrLeaveRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrLeaveRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrOnlineStatusRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrOnlineStatusRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBpjsPaymentRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBpjsPaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePph21FilingRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePph21FilingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceThrDisbursementRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceThrDisbursementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEmployeeAllowanceRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEmployeeAllowanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePoPaymentRecord" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePoPaymentRecord_pkey" PRIMARY KEY ("id")
);
