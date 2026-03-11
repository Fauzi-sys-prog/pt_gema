import api from "./api";

export type AppSettingScope =
  | "GLOBAL"
  | "PROJECT"
  | "PRODUCTION"
  | "SUPPLY_CHAIN"
  | "FINANCE"
  | "HR"
  | "LOGISTICS"
  | "CORRESPONDENCE"
  | "ASSET";

export type AppSetting = {
  id: string;
  key: string;
  label?: string;
  description?: string;
  scope: AppSettingScope;
  value: unknown;
  isActive: boolean;
  updatedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type RowShape = Partial<AppSetting> & {
  createdAt?: string;
  updatedAt?: string;
};

function normalizeRow(row: RowShape): AppSetting {
  const payload = row ?? {};
  return {
    id: String(payload.id ?? `SET-${Date.now()}`),
    key: String(payload.key ?? ""),
    label: typeof payload.label === "string" ? payload.label : undefined,
    description: typeof payload.description === "string" ? payload.description : undefined,
    scope: (typeof payload.scope === "string" ? payload.scope : "GLOBAL") as AppSettingScope,
    value: Object.prototype.hasOwnProperty.call(payload, "value") ? payload.value : null,
    isActive: payload.isActive !== false,
    updatedByUserId: typeof payload.updatedByUserId === "string" ? payload.updatedByUserId : undefined,
    createdAt: row?.createdAt,
    updatedAt: row?.updatedAt,
  };
}

export async function fetchAppSettings(): Promise<AppSetting[]> {
  const res = await api.get<RowShape[]>("/app-settings");
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map(normalizeRow);
}

export async function createAppSetting(setting: AppSetting): Promise<AppSetting> {
  await api.post("/app-settings", setting);
  return setting;
}

export async function updateAppSetting(setting: AppSetting): Promise<AppSetting> {
  await api.patch(`/app-settings/${setting.id}`, setting);
  return setting;
}

export async function deleteAppSetting(id: string): Promise<void> {
  await api.delete(`/app-settings/${id}`);
}
