type AssetStatus = "Available" | "Under Maintenance" | "In Use" | "Scrapped";
type WorkOrderStatus = "Draft" | "In Progress" | "QC" | "Completed";
type DeliveryStatus = "Pending" | "On Delivery" | "Delivered" | "In Transit" | "Returned";
type MaintenanceStatus = "Scheduled" | "In Progress" | "Completed";

type AssetLike = {
  id: string;
  assetCode: string;
  name: string;
  status: AssetStatus;
};

type WorkOrderLike = {
  status?: WorkOrderStatus;
  machineId?: string;
};

type SuratJalanLike = {
  assetId?: string;
  noPolisi?: string;
  deliveryStatus?: DeliveryStatus;
};

type MaintenanceLike = {
  status?: MaintenanceStatus;
  assetCode: string;
  equipmentName: string;
};

const normalizeRef = (value?: string | null) => String(value || "").trim().toLowerCase();

export const isActiveWorkOrderStatus = (status?: WorkOrderStatus) =>
  status === "Draft" || status === "In Progress" || status === "QC";

export const isActiveDeliveryStatus = (status?: DeliveryStatus) =>
  status === "Pending" || status === "On Delivery" || status === "In Transit";

export const isActiveMaintenanceStatus = (status?: MaintenanceStatus) =>
  status === "Scheduled" || status === "In Progress";

export const isAssetMatchedByMachineRef = (asset: AssetLike, machineRef?: string) => {
  const ref = normalizeRef(machineRef);
  if (!ref) return false;
  return (
    normalizeRef(asset.id) === ref ||
    normalizeRef(asset.assetCode) === ref ||
    normalizeRef(asset.name) === ref
  );
};

export const isAssetMatchedByPlateRef = (asset: AssetLike, plateRef?: string) => {
  const ref = normalizeRef(plateRef);
  if (!ref) return false;
  return normalizeRef(asset.assetCode) === ref || normalizeRef(asset.name) === ref;
};

export const findAssetByMachineRefInList = <T extends AssetLike>(assets: T[], machineRef?: string) =>
  assets.find((asset) => isAssetMatchedByMachineRef(asset, machineRef));

export const findAssetByPlateRefInList = <T extends AssetLike>(assets: T[], plateRef?: string) =>
  assets.find((asset) => isAssetMatchedByPlateRef(asset, plateRef));

export const findAssetByPlateOrNameRefInList = <T extends AssetLike>(assets: T[], rawRef?: string) =>
  assets.find((asset) => isAssetMatchedByPlateRef(asset, rawRef) || normalizeRef(asset.name) === normalizeRef(rawRef));

export const findAssetBySuratJalanRefInList = <T extends AssetLike, S extends SuratJalanLike>(
  assets: T[],
  sj?: Partial<S> | null
) => {
  const assetIdRef = normalizeRef(sj?.assetId);
  if (assetIdRef) {
    const byId = assets.find((asset) => normalizeRef(asset.id) === assetIdRef);
    if (byId) return byId;
  }
  return findAssetByPlateRefInList(assets, sj?.noPolisi);
};

export const hasActiveWorkOrderForAsset = <A extends AssetLike, W extends WorkOrderLike>(
  asset: A,
  workOrders: W[]
) => workOrders.some((wo) => isActiveWorkOrderStatus(wo.status) && isAssetMatchedByMachineRef(asset, wo.machineId));

export const hasActiveDeliveryForAsset = <A extends AssetLike, S extends SuratJalanLike>(
  asset: A,
  suratJalans: S[]
) =>
  suratJalans.some((sj) => {
    if (!isActiveDeliveryStatus(sj.deliveryStatus ?? "Pending")) return false;
    return normalizeRef(sj.assetId) === normalizeRef(asset.id) || isAssetMatchedByPlateRef(asset, sj.noPolisi);
  });

export const hasActiveMaintenanceForAsset = <A extends AssetLike, M extends MaintenanceLike>(
  asset: A,
  maintenances: M[]
) =>
  maintenances.some(
    (record) =>
      isActiveMaintenanceStatus(record.status) &&
      (normalizeRef(record.assetCode) === normalizeRef(asset.assetCode) ||
        normalizeRef(record.equipmentName) === normalizeRef(asset.name))
  );

export const getIdleAssetStatus = <
  A extends AssetLike,
  W extends WorkOrderLike,
  S extends SuratJalanLike,
  M extends MaintenanceLike,
>(
  asset: A,
  workOrders: W[],
  suratJalans: S[],
  maintenances: M[]
): AssetStatus => {
  if (hasActiveMaintenanceForAsset(asset, maintenances)) return "Under Maintenance";
  if (hasActiveWorkOrderForAsset(asset, workOrders)) return "In Use";
  if (hasActiveDeliveryForAsset(asset, suratJalans)) return "In Use";
  return "Available";
};
