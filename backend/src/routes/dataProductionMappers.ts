import { projectNameFromPayload } from "./dataPayloadUtils";

export function mapProductionWorkOrderToLegacyPayload(row: {
  id: string;
  number: string;
  projectId: string;
  projectName: string;
  itemToProduce: string;
  targetQty: number;
  completedQty: number;
  status: string;
  priority: string;
  deadline: Date | null;
  leadTechnician: string;
  machineId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  workflowStatus: string | null;
  bomItems: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    qty: number;
    completedQty: number;
    unit: string;
  }>;
}) {
  return {
    id: row.id,
    woNumber: row.number,
    number: row.number,
    projectId: row.projectId,
    projectName: row.projectName,
    itemToProduce: row.itemToProduce,
    targetQty: row.targetQty,
    completedQty: row.completedQty,
    status: row.status,
    priority: row.priority,
    deadline: row.deadline ? row.deadline.toISOString().slice(0, 10) : "",
    leadTechnician: row.leadTechnician,
    machineId: row.machineId ?? undefined,
    startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : undefined,
    endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : undefined,
    workflowStatus: row.workflowStatus ?? undefined,
    bom: row.bomItems.map((item) => ({
      id: item.id,
      kode: item.itemCode ?? undefined,
      itemKode: item.itemCode ?? undefined,
      nama: item.itemName,
      materialName: item.itemName,
      qty: item.qty,
      completedQty: item.completedQty,
      unit: item.unit,
    })),
  };
}

export function mapProductionExecutionReportToLegacyPayload(row: {
  id: string;
  projectId: string;
  workOrderId: string | null;
  photoAssetId: string | null;
  tanggal: Date;
  shift: string | null;
  outputQty: number;
  rejectQty: number;
  notes: string | null;
  workerName: string | null;
  activity: string | null;
  machineNo: string | null;
  startTime: string | null;
  endTime: string | null;
  unit: string | null;
  photoUrl: string | null;
  photoAsset?: { id: string; publicUrl: string; originalName: string | null } | null;
  project: { payload: unknown } | null;
  workOrder: { number: string } | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: projectNameFromPayload(row.project),
    workOrderId: row.workOrderId ?? undefined,
    woId: row.workOrderId ?? undefined,
    woNumber: row.workOrder?.number ?? undefined,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    shift: row.shift ?? "",
    workshop: projectNameFromPayload(row.project) ?? "",
    workerName: row.workerName ?? "",
    activity: row.activity ?? "",
    machineNo: row.machineNo ?? undefined,
    startTime: row.startTime ?? "",
    endTime: row.endTime ?? "",
    outputQty: row.outputQty,
    rejectQty: row.rejectQty,
    unit: row.unit ?? "",
    remarks: row.notes ?? undefined,
    notes: row.notes ?? undefined,
    photoUrl: row.photoAsset?.publicUrl ?? row.photoUrl ?? undefined,
    photoAssetId: row.photoAssetId ?? row.photoAsset?.id ?? undefined,
  };
}

export function mapProductionTrackerEntryToLegacyPayload(row: {
  id: string;
  projectId: string;
  workOrderId: string | null;
  customer: string | null;
  itemType: string;
  qty: number;
  startDate: Date | null;
  finishDate: Date | null;
  status: string;
  machineId: string | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    workOrderId: row.workOrderId ?? undefined,
    customer: row.customer ?? "",
    itemType: row.itemType,
    qty: row.qty,
    startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : "",
    finishDate: row.finishDate ? row.finishDate.toISOString().slice(0, 10) : "",
    status: row.status,
    machineId: row.machineId ?? undefined,
  };
}

export function mapProductionQcInspectionToLegacyPayload(row: {
  id: string;
  projectId: string;
  workOrderId?: string | null;
  drawingAssetId?: string | null;
  tanggal: Date;
  batchNo?: string | null;
  itemName: string;
  qtyInspected: number;
  qtyPassed: number;
  qtyRejected: number;
  inspectorName: string;
  status: string;
  notes?: string | null;
  visualCheck: boolean;
  dimensionCheck: boolean;
  materialCheck: boolean;
  photoUrl?: string | null;
  customerName?: string | null;
  drawingUrl?: string | null;
  remark?: string | null;
  drawingAsset?: { id: string; publicUrl: string; originalName: string | null } | null;
  dimensions?: Array<{
    parameter: string;
    specification: string;
    sample1: string;
    sample2: string;
    sample3: string;
    sample4: string;
    result: string;
  }>;
  workOrder?: { number: string } | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    workOrderId: row.workOrderId ?? undefined,
    woId: row.workOrderId ?? undefined,
    woNumber: row.workOrder?.number ?? undefined,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    batchNo: row.batchNo ?? "",
    itemNama: row.itemName,
    qtyInspected: row.qtyInspected,
    qtyPassed: row.qtyPassed,
    qtyRejected: row.qtyRejected,
    inspectorName: row.inspectorName,
    status: row.status,
    notes: row.notes ?? undefined,
    visualCheck: row.visualCheck,
    dimensionCheck: row.dimensionCheck,
    materialCheck: row.materialCheck,
    photoUrl: row.photoUrl ?? undefined,
    customerName: row.customerName ?? undefined,
    drawingUrl: row.drawingAsset?.publicUrl ?? row.drawingUrl ?? undefined,
    drawingAssetId: row.drawingAssetId ?? row.drawingAsset?.id ?? undefined,
    remark: row.remark ?? undefined,
    dimensions: (row.dimensions || []).map((item) => ({
      parameter: item.parameter,
      specification: item.specification,
      sample1: item.sample1,
      sample2: item.sample2,
      sample3: item.sample3,
      sample4: item.sample4,
      result: item.result,
    })),
  };
}

export function mapProductionMaterialRequestToLegacyPayload(row: {
  id: string;
  number: string;
  projectId: string;
  projectName: string;
  requestedBy: string;
  requestedAt: Date;
  status: string;
  items: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    qty: number;
    unit: string;
  }>;
}) {
  return {
    id: row.id,
    noRequest: row.number,
    requestNo: row.number,
    projectId: row.projectId,
    projectName: row.projectName,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt.toISOString(),
    status: row.status,
    items: row.items.map((item) => ({
      id: item.id,
      itemKode: item.itemCode ?? "",
      itemNama: item.itemName,
      qty: item.qty,
      unit: item.unit,
    })),
  };
}
