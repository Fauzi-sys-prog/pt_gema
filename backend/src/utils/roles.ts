import { Role } from "@prisma/client";

const ROLE_ALIASES: Partial<Record<Role, Role[]>> = {
  SPV: ["OWNER"],
  PURCHASING: ["SUPPLY_CHAIN"],
  WAREHOUSE: ["SUPPLY_CHAIN"],
  OPERATIONS: ["PRODUKSI"],
};

export function getRoleAliases(role?: Role | null): Role[] {
  if (!role) return [];
  return ROLE_ALIASES[role] || [];
}

export function hasRoleAccess(role: Role | undefined | null, allowedRoles: Role[]): boolean {
  if (!role) return false;
  if (allowedRoles.includes(role)) return true;
  return getRoleAliases(role).some((alias) => allowedRoles.includes(alias));
}

export function isOwnerLike(role?: Role | null): boolean {
  return hasRoleAccess(role, ["OWNER"]);
}
