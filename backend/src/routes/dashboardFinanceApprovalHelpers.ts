import { Prisma, Role } from "@prisma/client";
import { hasRoleAccess, isOwnerLike } from "../utils/roles";
import {
  asRecord,
  mapQuotationDashboardPayload,
  quotationDashboardSelect,
  readNumber,
  readString,
  toActionList,
  type FinanceQueueRow,
} from "./dashboardRouteSupport";

type QuotationActorInfo = {
  name: string;
  role: Role | null;
};

function asArray(input: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(input)) return [];
  return input.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Array<Record<string, unknown>>;
}

export function canReadFinanceApprovalQueue(role?: Role): boolean {
  return hasRoleAccess(role, [
    "OWNER",
    "SPV",
    "ADMIN",
    "MANAGER",
    "FINANCE",
    "SALES",
    "SUPPLY_CHAIN",
    "WAREHOUSE",
    "PURCHASING",
  ]);
}

export function canApproveRejectInFinanceHub(role: Role | undefined): boolean {
  return hasRoleAccess(role, ["OWNER", "SPV"]);
}

export function canApprovePoByRole(role: Role | undefined, total: number): boolean {
  void total;
  return canApproveRejectInFinanceHub(role);
}

export function canVerifyInvoiceByRole(role: Role | undefined): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "MANAGER", "FINANCE"]);
}

export function canApproveMaterialRequestByRole(role: Role | undefined): boolean {
  return canApproveRejectInFinanceHub(role);
}

export function canIssueMaterialRequestByRole(role: Role | undefined): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "WAREHOUSE", "PRODUKSI"]);
}

export function canSendQuotationByRole(role: Role | undefined): boolean {
  return hasRoleAccess(role, ["OWNER", "ADMIN", "MANAGER", "SALES"]);
}

export function collectQuotationActorIds(
  quotationRows: Array<Prisma.QuotationGetPayload<{ select: typeof quotationDashboardSelect }>>
): string[] {
  return Array.from(
    new Set(
      quotationRows.flatMap((row) => {
        const payload = mapQuotationDashboardPayload(row);
        const candidateValues = [
          readString(payload, "sentByUserId"),
          readString(payload, "spvApprovedByUserId"),
          readString(payload, "approvedByUserId"),
          readString(payload, "rejectedByUserId"),
          readString(payload, "sentBy"),
          readString(payload, "spvApprovedBy"),
          readString(payload, "approvedBy"),
          readString(payload, "rejectedBy"),
        ];
        return candidateValues.filter((value): value is string => Boolean(value));
      })
    )
  );
}

export function buildQuotationActorMap(
  users: Array<{ id: string; name: string | null; username: string; role: Role | null }>
): Map<string, QuotationActorInfo> {
  return new Map(
    users.map((user) => [
      user.id,
      {
        name: user.name || user.username || user.id,
        role: user.role || null,
      },
    ])
  );
}

export function buildPendingPurchaseOrders(
  poQueueRows: FinanceQueueRow[],
  role: Role | undefined
) {
  return poQueueRows
    .map((row) => {
      const payload = asRecord(row.payload);
      const status = String(readString(payload, "status") || "Draft").toUpperCase();
      const total =
        readNumber(payload, "total") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "grandTotal");
      return {
        id: readString(payload, "id") || row.entityId,
        noPO: readString(payload, "noPO") || "-",
        supplier:
          readString(payload, "supplier") ||
          readString(payload, "vendor") ||
          readString(payload, "vendorName") ||
          "-",
        total,
        status,
        projectId: readString(payload, "projectId") || undefined,
        auditStatus:
          status === "DRAFT"
            ? "Ready to Send"
            : status === "SENT"
              ? "Owner / SPV Review"
              : status === "PARTIAL"
                ? "Receiving Partial"
                : status === "RECEIVED"
                  ? "Received"
                  : status.replace(/_/g, " "),
        auditTrail:
          status === "SENT"
            ? "Waiting owner / SPV approval"
            : status === "DRAFT"
              ? "PO masih draft dan belum masuk approval"
              : "PO processed from procurement database",
        availableActions: toActionList(
          status === "SENT" && canApprovePoByRole(role, total) && "APPROVE",
          status === "SENT" && canApprovePoByRole(role, total) && "REJECT"
        ),
      };
    })
    .filter((po) => {
      const status = String(po.status || "").toUpperCase();
      return status === "DRAFT" || status === "SENT";
    })
    .sort((a, b) => b.total - a.total);
}

export function buildPendingQuotations(
  quotationRows: Array<Prisma.QuotationGetPayload<{ select: typeof quotationDashboardSelect }>>,
  quotationActorMap: Map<string, QuotationActorInfo>,
  role: Role | undefined
) {
  return quotationRows
    .map((row) => {
      const payload = mapQuotationDashboardPayload(row);
      const effectiveStatus = String(payload.status || "Draft");
      const rawItems = Array.isArray(payload.items)
        ? payload.items
        : [
            ...Object.values(asRecord(payload.pricingItems)).flatMap((group) =>
              Array.isArray(group) ? group : []
            ),
            ...["materials", "manpower", "equipment", "consumables"].flatMap((key) => {
              const group = payload[key];
              return Array.isArray(group) ? group : [];
            }),
            ...(
              Array.isArray(payload.sections)
                ? payload.sections.flatMap((section) => {
                    const sectionRecord = asRecord(section);
                    const sectionItems = sectionRecord.items;
                    return Array.isArray(sectionItems) ? sectionItems : [];
                  })
                : []
            ),
          ];
      const items = rawItems
        .map((item) => {
          const record = asRecord(item);
          const qty =
            readNumber(record, "qty") ||
            readNumber(record, "volume") ||
            readNumber(record, "jumlah") ||
            0;
          const harga =
            readNumber(record, "harga") ||
            readNumber(record, "unitPrice") ||
            readNumber(record, "hargaSatuan") ||
            readNumber(record, "sellingPrice") ||
            readNumber(record, "price") ||
            0;
          const total =
            readNumber(record, "total") ||
            readNumber(record, "totalPrice") ||
            readNumber(record, "subtotal") ||
            qty * harga;
          return {
            id: readString(record, "id") || undefined,
            kode:
              readString(record, "kode") ||
              readString(record, "itemCode") ||
              readString(record, "itemKode") ||
              readString(record, "code") ||
              "-",
            nama:
              readString(record, "nama") ||
              readString(record, "itemName") ||
              readString(record, "deskripsi") ||
              readString(record, "description") ||
              readString(record, "uraian") ||
              "-",
            qty,
            unit:
              readString(record, "unit") ||
              readString(record, "satuan") ||
              "-",
            harga,
            total,
          };
        })
        .filter((item) => item.nama !== "-");
      const sentActor =
        quotationActorMap.get(readString(payload, "sentByUserId") || "") ||
        quotationActorMap.get(readString(payload, "sentBy") || "");
      const spvActor =
        quotationActorMap.get(readString(payload, "spvApprovedByUserId") || "") ||
        quotationActorMap.get(readString(payload, "spvApprovedBy") || "");
      const approvedActor =
        quotationActorMap.get(readString(payload, "approvedByUserId") || "") ||
        quotationActorMap.get(readString(payload, "approvedBy") || "");
      const rejectedActor =
        quotationActorMap.get(readString(payload, "rejectedByUserId") || "") ||
        quotationActorMap.get(readString(payload, "rejectedBy") || "");
      const auditStatus =
        effectiveStatus === "DRAFT"
          ? "Ready to Send"
          : effectiveStatus === "SENT"
            ? "Management Approval"
            : effectiveStatus === "REVIEW"
              ? "Management Review"
              : effectiveStatus === "REJECTED"
                ? "Rejected"
                : effectiveStatus === "APPROVED"
                  ? "Approved"
                  : "Processed";
      const auditTrail =
        effectiveStatus === "REVIEW"
          ? `SPV reviewed by ${spvActor?.name || readString(payload, "spvApprovedBy") || "SPV"}${spvActor?.role || readString(payload, "spvApprovedByRole") ? ` (${spvActor?.role || readString(payload, "spvApprovedByRole")})` : ""}`
          : effectiveStatus === "APPROVED"
            ? `Approved by ${approvedActor?.name || readString(payload, "approvedBy") || "Management"}${approvedActor?.role || readString(payload, "approvedByRole") ? ` (${approvedActor?.role || readString(payload, "approvedByRole")})` : ""}`
            : effectiveStatus === "REJECTED"
              ? `Rejected by ${rejectedActor?.name || readString(payload, "rejectedBy") || "Reviewer"}${rejectedActor?.role || readString(payload, "rejectedByRole") ? ` (${rejectedActor?.role || readString(payload, "rejectedByRole")})` : ""}`
              : effectiveStatus === "SENT"
                ? sentActor?.name || readString(payload, "sentBy")
                  ? `Sent by ${sentActor?.name || readString(payload, "sentBy")}`
                  : "Waiting management approval"
                : "Draft quotation";
      const owner = isOwnerLike(role);
      const canManageQuotationApproval = role === "SPV" || owner;
      const availableActions = toActionList(
        (effectiveStatus === "DRAFT" || effectiveStatus === "REJECTED") && canSendQuotationByRole(role) && "SEND",
        (effectiveStatus === "SENT" || effectiveStatus === "REVIEW") && canManageQuotationApproval && "APPROVE",
        (effectiveStatus === "SENT" || effectiveStatus === "REVIEW") && canManageQuotationApproval && "REJECT",
        "VIEW"
      );
      return {
        id: row.id,
        noPenawaran: readString(payload, "noPenawaran") || row.id,
        kepada: readString(payload, "kepada") || readString(payload, "perusahaan") || "-",
        grandTotal: readNumber(payload, "grandTotal"),
        status: effectiveStatus,
        tanggal: readString(payload, "tanggal") || undefined,
        perihal: readString(payload, "perihal") || undefined,
        sentAt: readString(payload, "sentAt") || undefined,
        sentBy: sentActor?.name || readString(payload, "sentBy") || readString(payload, "createdBy") || undefined,
        sentByRole: sentActor?.role || readString(payload, "sentByRole") || undefined,
        spvApprovedBy: spvActor?.name || readString(payload, "spvApprovedBy") || undefined,
        spvApprovedByRole: spvActor?.role || readString(payload, "spvApprovedByRole") || undefined,
        spvApprovedAt: readString(payload, "spvApprovedAt") || undefined,
        approvedBy: approvedActor?.name || readString(payload, "approvedBy") || undefined,
        approvedByRole: approvedActor?.role || readString(payload, "approvedByRole") || undefined,
        approvedAt: readString(payload, "approvedAt") || undefined,
        rejectedBy: rejectedActor?.name || readString(payload, "rejectedBy") || undefined,
        rejectedByRole: rejectedActor?.role || readString(payload, "rejectedByRole") || undefined,
        rejectedAt: readString(payload, "rejectedAt") || undefined,
        rejectReason: readString(payload, "rejectReason") || undefined,
        items,
        auditStatus,
        auditTrail,
        availableActions,
      };
    })
    .filter((q) => {
      const status = String(q.status || "").toUpperCase();
      return status === "DRAFT" || status === "SENT" || status === "REVIEW" || status === "REJECTED";
    })
    .sort((a, b) => b.grandTotal - a.grandTotal);
}

export function buildPendingInvoices(
  invoiceQueueRows: FinanceQueueRow[],
  role: Role | undefined
) {
  return invoiceQueueRows
    .map((row) => {
      const payload = asRecord(row.payload);
      const totalBayar =
        readNumber(payload, "totalBayar") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "subtotal");
      const paidAmount = readNumber(payload, "paidAmount");
      const outstandingAmount = Math.max(
        0,
        readNumber(payload, "outstandingAmount") || totalBayar - paidAmount
      );
      const status = String(readString(payload, "status") || "Unpaid").toUpperCase();
      const verifiedBy = readString(payload, "verifiedBy") || readString(payload, "paidVerifiedBy") || undefined;
      const verifiedByRole = readString(payload, "verifiedByRole") || readString(payload, "paidVerifiedByRole") || undefined;
      return {
        id: readString(payload, "id") || row.entityId,
        noInvoice: readString(payload, "noInvoice") || row.entityId,
        customer: readString(payload, "customer") || readString(payload, "customerName") || "-",
        totalBayar,
        outstandingAmount,
        status,
        verifiedBy,
        verifiedByRole,
        tanggalBayar: readString(payload, "tanggalBayar") || undefined,
        auditStatus: status === "UNPAID" ? "Awaiting Verification" : status === "PAID" ? "Verified Paid" : status.replace(/_/g, " "),
        auditTrail:
          verifiedBy
            ? `Verified by ${verifiedBy}${verifiedByRole ? ` (${verifiedByRole})` : ""}`
            : "Waiting finance verification",
        availableActions: toActionList(status === "UNPAID" && canVerifyInvoiceByRole(role) && "VERIFY"),
      };
    })
    .filter((inv) => inv.outstandingAmount > 0);
}

export function buildPendingMaterialRequests(
  mrQueueRows: FinanceQueueRow[],
  role: Role | undefined
) {
  return mrQueueRows
    .map((row) => {
      const payload = asRecord(row.payload);
      const status = String(readString(payload, "status") || "Pending").toUpperCase();
      const approvedBy = readString(payload, "approvedBy") || undefined;
      const approvedByRole = readString(payload, "approvedByRole") || undefined;
      const rejectedBy = readString(payload, "rejectedBy") || undefined;
      const rejectedByRole = readString(payload, "rejectedByRole") || undefined;
      const issuedBy = readString(payload, "issuedBy") || undefined;
      const issuedByRole = readString(payload, "issuedByRole") || undefined;
      return {
        id: readString(payload, "id") || row.entityId,
        noRequest: readString(payload, "noRequest") || row.entityId,
        projectName: readString(payload, "projectName") || "-",
        requestedBy: readString(payload, "requestedBy") || "-",
        status,
        approvedBy,
        approvedByRole,
        approvedAt: readString(payload, "approvedAt") || undefined,
        rejectedBy,
        rejectedByRole,
        rejectedAt: readString(payload, "rejectedAt") || undefined,
        issuedBy,
        issuedByRole,
        issuedAt: readString(payload, "issuedAt") || undefined,
        rejectReason: readString(payload, "rejectReason") || undefined,
        items: asArray(payload.items),
        auditStatus:
          status === "PENDING"
            ? "Pending Review"
            : status === "APPROVED"
              ? "Ready to Issue"
              : status === "ISSUED"
                ? "Issued"
                : status === "REJECTED"
                  ? "Rejected"
                  : status.replace(/_/g, " "),
        auditTrail:
          status === "APPROVED" && approvedBy
            ? `Approved by ${approvedBy}${approvedByRole ? ` (${approvedByRole})` : ""}`
            : status === "ISSUED" && issuedBy
              ? `Issued by ${issuedBy}${issuedByRole ? ` (${issuedByRole})` : ""}`
              : status === "REJECTED" && rejectedBy
                ? `Rejected by ${rejectedBy}${rejectedByRole ? ` (${rejectedByRole})` : ""}`
                : "Waiting approval",
        availableActions: toActionList(
          status === "PENDING" && canApproveMaterialRequestByRole(role) && "APPROVE",
          status === "PENDING" && canApproveMaterialRequestByRole(role) && "REJECT",
          status === "APPROVED" && canIssueMaterialRequestByRole(role) && "ISSUE"
        ),
      };
    })
    .filter((mr) => {
      const status = String(mr.status || "").toUpperCase();
      return status === "PENDING" || status === "APPROVED";
    });
}
