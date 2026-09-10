import { Role } from "@prisma/client";
import { roleMatchesAllowedRoles } from "./dataResourceRules";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeStatus(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase().replace(/[\s-]+/g, "_");
}

const WORKFLOW_STATUS_ALIASES: Record<string, Record<string, string>> = {
  "work-orders": {
    DRAFT: "REVIEW_SPV",
    REVIEW: "REVIEW_SPV",
    IN_PROGRESS: "IN_PROGRESS",
    QC: "FOLLOW_UP",
    FOLLOW_UP: "FOLLOW_UP",
    COMPLETED: "DONE",
    DONE: "DONE",
    ON_HOLD: "ON_HOLD",
  },
  "material-requests": {
    PENDING: "DRAFT",
    DRAFT: "DRAFT",
    APPROVED: "PRICING_REVIEW",
    ORDERED: "PO_SUPPLIER",
    ISSUED: "READY_DELIVERY",
    DELIVERED: "CLOSED",
    CLOSED: "CLOSED",
    REJECTED: "DRAFT",
  },
  "production-trackers": {
    ON_TRACK: "IN_PROGRESS",
    TRACKING: "IN_PROGRESS",
    SCHEDULED: "PLANNED",
    PLANNED: "PLANNED",
    IN_PROGRESS: "IN_PROGRESS",
    DELAYED: "ON_HOLD",
    COMPLETED: "DONE",
    DONE: "DONE",
    ON_HOLD: "ON_HOLD",
  },
  "qc-inspections": {
    PENDING: "PENDING",
    PASSED: "PASSED",
    REJECTED: "FAILED",
    FAILED: "FAILED",
    PARTIAL: "FAILED",
    VERIFIED: "VERIFIED",
  },
  "production-reports": {
    DRAFT: "DRAFT",
    SUBMITTED: "SUBMITTED",
    VERIFIED: "VERIFIED",
    COMPLETED: "VERIFIED",
  },
  "surat-jalan": {
    PENDING: "PREPARED",
    PREPARED: "PREPARED",
    ON_DELIVERY: "ISSUED",
    IN_TRANSIT: "ISSUED",
    ISSUED: "ISSUED",
    DELIVERED: "DELIVERED",
    RETURNED: "CLOSED",
    CLOSED: "CLOSED",
  },
};

function canonicalizeWorkflowStatus(resource: string, status: string | null): string | null {
  if (!status) return null;
  const aliases = WORKFLOW_STATUS_ALIASES[resource];
  if (!aliases) return status;
  return aliases[status] ?? status;
}

export function extractWorkflowStatus(resource: string, payload: unknown): string | null {
  const obj = asRecord(payload);
  const raw = (
    normalizeStatus(obj.workflowStatus) ||
    normalizeStatus(obj.statusWorkflow) ||
    normalizeStatus(obj.status)
  );
  return canonicalizeWorkflowStatus(resource, raw);
}

const WORKFLOW_STATUS_RULES: Record<string, Record<string, Role[]>> = {
  "work-orders": {
    REVIEW_SPV: ["OWNER", "ADMIN", "PRODUKSI", "SUPPLY_CHAIN"],
    READY_EXECUTION: ["OWNER", "ADMIN", "SALES"],
    IN_PROGRESS: ["OWNER", "ADMIN", "PRODUKSI"],
    FOLLOW_UP: ["OWNER", "ADMIN", "PRODUKSI"],
    DONE: ["OWNER", "ADMIN", "PRODUKSI"],
    ON_HOLD: ["OWNER", "ADMIN", "PRODUKSI"],
  },
  "material-requests": {
    DRAFT: ["OWNER", "ADMIN", "PRODUKSI", "SALES", "WAREHOUSE"],
    PRICING_REVIEW: ["OWNER", "ADMIN", "FINANCE"],
    PO_SUPPLIER: ["OWNER", "ADMIN", "FINANCE", "PURCHASING"],
    READY_DELIVERY: ["OWNER", "ADMIN", "WAREHOUSE"],
    CLOSED: ["OWNER", "ADMIN", "WAREHOUSE", "FINANCE"],
  },
  "surat-jalan": {
    PREPARED: ["OWNER", "ADMIN", "WAREHOUSE"],
    ISSUED: ["OWNER", "ADMIN", "WAREHOUSE"],
    DELIVERED: ["OWNER", "ADMIN", "WAREHOUSE", "PRODUKSI"],
    CLOSED: ["OWNER", "ADMIN", "WAREHOUSE"],
  },
  "production-reports": {
    DRAFT: ["OWNER", "ADMIN", "PRODUKSI"],
    SUBMITTED: ["OWNER", "ADMIN", "PRODUKSI"],
    VERIFIED: ["OWNER", "ADMIN", "FINANCE"],
  },
  "production-trackers": {
    PLANNED: ["OWNER", "ADMIN", "SALES", "PRODUKSI"],
    IN_PROGRESS: ["OWNER", "ADMIN", "PRODUKSI"],
    FOLLOW_UP: ["OWNER", "ADMIN", "PRODUKSI"],
    DONE: ["OWNER", "ADMIN", "PRODUKSI"],
    ON_HOLD: ["OWNER", "ADMIN", "PRODUKSI"],
  },
  "qc-inspections": {
    PENDING: ["OWNER", "ADMIN", "PRODUKSI"],
    PASSED: ["OWNER", "ADMIN", "PRODUKSI"],
    FAILED: ["OWNER", "ADMIN", "PRODUKSI"],
    VERIFIED: ["OWNER", "ADMIN", "FINANCE"],
  },
};

const WORKFLOW_TRANSITIONS: Record<string, Record<string, string[]>> = {
  "work-orders": {
    REVIEW_SPV: ["READY_EXECUTION", "IN_PROGRESS", "FOLLOW_UP", "DONE", "ON_HOLD"],
    READY_EXECUTION: ["IN_PROGRESS", "FOLLOW_UP", "DONE", "ON_HOLD"],
    IN_PROGRESS: ["FOLLOW_UP", "DONE", "ON_HOLD"],
    FOLLOW_UP: ["IN_PROGRESS", "DONE", "ON_HOLD"],
    ON_HOLD: ["READY_EXECUTION", "IN_PROGRESS", "FOLLOW_UP", "DONE"],
    DONE: [],
  },
  "material-requests": {
    DRAFT: ["PRICING_REVIEW"],
    PRICING_REVIEW: ["PO_SUPPLIER"],
    PO_SUPPLIER: ["READY_DELIVERY"],
    READY_DELIVERY: ["CLOSED"],
    CLOSED: [],
  },
  "surat-jalan": {
    PREPARED: ["ISSUED"],
    ISSUED: ["DELIVERED"],
    DELIVERED: ["CLOSED"],
    CLOSED: [],
  },
  "production-reports": {
    DRAFT: ["SUBMITTED"],
    SUBMITTED: ["VERIFIED"],
    VERIFIED: [],
  },
  "production-trackers": {
    PLANNED: ["IN_PROGRESS", "ON_HOLD"],
    IN_PROGRESS: ["FOLLOW_UP", "DONE", "ON_HOLD"],
    FOLLOW_UP: ["IN_PROGRESS", "DONE", "ON_HOLD"],
    ON_HOLD: ["IN_PROGRESS", "FOLLOW_UP"],
    DONE: [],
  },
  "qc-inspections": {
    PENDING: ["PASSED", "FAILED"],
    PASSED: ["VERIFIED"],
    FAILED: ["VERIFIED"],
    VERIFIED: [],
  },
};

export function validateWorkflowStatusWrite(params: {
  resource: string;
  payload: unknown;
  role?: Role;
  previousStatus?: string | null;
}): { ok: true } | { ok: false; error: string } {
  const { resource, payload, role, previousStatus } = params;
  const statusRules = WORKFLOW_STATUS_RULES[resource];
  if (!statusRules) return { ok: true };

  const nextStatus = extractWorkflowStatus(resource, payload);
  if (!nextStatus) return { ok: true };

  const allowedRoles = statusRules[nextStatus];
  if (!allowedRoles) {
    return {
      ok: false,
      error: `Status '${nextStatus}' tidak valid untuk resource '${resource}'.`,
    };
  }

  if (!roleMatchesAllowedRoles(role, allowedRoles)) {
    return {
      ok: false,
      error: `Role '${role ?? "UNKNOWN"}' tidak boleh set status '${nextStatus}' pada '${resource}'.`,
    };
  }

  if (!previousStatus || previousStatus === nextStatus) {
    return { ok: true };
  }

  const transitions = WORKFLOW_TRANSITIONS[resource];
  const allowedNext = transitions?.[previousStatus] ?? [];
  if (!allowedNext.includes(nextStatus)) {
    return {
      ok: false,
      error: `Transisi status '${previousStatus}' -> '${nextStatus}' tidak diizinkan untuk '${resource}'.`,
    };
  }

  return { ok: true };
}
