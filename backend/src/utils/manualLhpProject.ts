import type { Prisma } from "@prisma/client";

export const MANUAL_LHP_PROJECT_ID = "PRJ-STOCK-UMUM";
export const MANUAL_LHP_PROJECT_CODE = "STOK-UMUM";
export const MANUAL_LHP_PROJECT_NAME = "STOK UMUM INTERNAL";
export const MANUAL_LHP_PROJECT_CUSTOMER = "INTERNAL WAREHOUSE";

type ProjectRecordHost = {
  projectRecord: {
    upsert: (args: Prisma.ProjectRecordUpsertArgs) => Promise<unknown>;
  };
};

export function buildManualLhpProjectPayload() {
  return {
    id: MANUAL_LHP_PROJECT_ID,
    kodeProject: MANUAL_LHP_PROJECT_CODE,
    namaProject: MANUAL_LHP_PROJECT_NAME,
    customerName: MANUAL_LHP_PROJECT_CUSTOMER,
    status: "Active",
    approvalStatus: "Approved",
    nilaiKontrak: 0,
    progress: 0,
    isSystemGenerated: true,
    internalOnly: true,
    purpose: "manual-lhp-stock",
  };
}

export async function ensureManualLhpProject(db: ProjectRecordHost) {
  const payload = buildManualLhpProjectPayload();
  await db.projectRecord.upsert({
    where: { id: MANUAL_LHP_PROJECT_ID },
    update: {
      kodeProject: MANUAL_LHP_PROJECT_CODE,
      namaProject: MANUAL_LHP_PROJECT_NAME,
      customerName: MANUAL_LHP_PROJECT_CUSTOMER,
      status: "Active",
      approvalStatus: "Approved",
      nilaiKontrak: 0,
      progress: 0,
      payload: payload as Prisma.InputJsonValue,
    },
    create: {
      id: MANUAL_LHP_PROJECT_ID,
      kodeProject: MANUAL_LHP_PROJECT_CODE,
      namaProject: MANUAL_LHP_PROJECT_NAME,
      customerName: MANUAL_LHP_PROJECT_CUSTOMER,
      status: "Active",
      approvalStatus: "Approved",
      nilaiKontrak: 0,
      progress: 0,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}
