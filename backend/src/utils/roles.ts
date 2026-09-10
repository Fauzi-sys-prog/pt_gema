import { Role } from "@prisma/client";

// Temporary rollout mode: every authenticated role may use every module.
// Keep the status-transition validations in each route; this only removes
// role-based menu/action restrictions until the final permission matrix is
// approved by the business.
const FULL_ACCESS_ROLES = new Set<Role>(Object.values(Role));

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
  if (FULL_ACCESS_ROLES.has(role)) return true;
  if (allowedRoles.includes(role)) return true;
  return getRoleAliases(role).some((alias) => allowedRoles.includes(alias));
}

export function isOwnerLike(role?: Role | null): boolean {
  return hasRoleAccess(role, ["OWNER"]);
}
