import { Router, Response } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { COMPANY_LOGO_DATA_URI } from "../constants/companyLogo";

export const exportsRouter = Router();

const COMPANY_NAME = "PT. GEMA TEKNIK PERKASA";
const COMPANY_TAGLINE = "REFRACTORY FURNACE AND BOILER";
const COMPANY_ADDRESS = "Jl. Nurushoba II No 13 Setia Mekar Tambun Selatan Bekasi 17510";
const COMPANY_CONTACT = "Phone: 08510420221, 021.88354139 | Email: gemateknik@gmail.com";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

const CURRENCY_KEY_RE = /(harga|price|nilai|total|grand|nominal|kontrak|amount|cost)/i;
const DATE_KEY_RE = /(tanggal|date|approvedat|snapshotat|createdat|updatedat)$/i;
const COUNT_KEY_RE = /(qty|jumlah|progress|hari|day|volume|density|weight|wight|percent|reverse)/i;

function stripDemoMarker(value: string): string {
  return value
    .replace(/([-_/])DEMO([-_/])/gi, "$1")
    .replace(/^DEMO([-_/])?/gi, "")
    .replace(/([-_/])?DEMO$/gi, "")
    .replace(/\bDEMO\b/gi, "")
    .replace(/[-_/]{2,}/g, (m) => m[0])
    .replace(/[-_/]\s*$/g, "")
    .replace(/^\s*[-_/]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function humanizeLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function numFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatCellByKey(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const lowerKey = key.toLowerCase();
  const asNumber = numFromUnknown(value);

  if (DATE_KEY_RE.test(lowerKey)) return formatTanggalIndonesia(value);
  if (CURRENCY_KEY_RE.test(lowerKey) && asNumber !== null) return `Rp ${idr(asNumber)}`;
  if (COUNT_KEY_RE.test(lowerKey) && asNumber !== null) return asNumber.toLocaleString("id-ID");
  if (asNumber !== null && typeof value === "number") return asNumber.toLocaleString("id-ID");
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  return stripDemoMarker(String(value));
}

function companyLetterheadHtml(title: string): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>
        <td style="width:96px;vertical-align:top;">
          <div style="width:76px;height:60px;border:1.5px solid #111;display:flex;align-items:center;justify-content:center;background:#fff;">
            <img src="${COMPANY_LOGO_DATA_URI}" alt="Logo Gema Teknik" style="max-width:70px;max-height:54px;object-fit:contain;" />
          </div>
        </td>
        <td style="vertical-align:top;">
          <div style="font-size:21px;font-weight:700;letter-spacing:.3px;">${escapeHtml(COMPANY_NAME)}</div>
          <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;margin-top:2px;">${escapeHtml(COMPANY_TAGLINE)}</div>
          <div style="font-size:11px;margin-top:4px;">${escapeHtml(COMPANY_ADDRESS)}</div>
          <div style="font-size:11px;margin-top:1px;">${escapeHtml(COMPANY_CONTACT)}</div>
        </td>
      </tr>
    </table>
    <div style="border-top:2px solid #111;border-bottom:1px solid #888;height:3px;margin:8px 0 12px;"></div>
    <div style="margin:0 0 12px;text-align:center;">
      <div style="font-size:18px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;">${escapeHtml(title)}</div>
    </div>
  `;
}

function companyFooterHtml(signer: unknown): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:22px;font-size:12px;">
      <tr>
        <td style="width:58%;"></td>
        <td style="vertical-align:top;text-align:center;">
          <div style="margin-bottom:4px;">Bekasi, ${escapeHtml(formatTanggalIndonesia(new Date().toISOString()))}</div>
          <div style="font-weight:700;">${escapeHtml(COMPANY_NAME)}</div>
          <div style="margin-top:4px;">Disiapkan / Disetujui Oleh,</div>
          <div style="height:64px;"></div>
          <div style="font-weight:700;text-decoration:underline;">${escapeHtml(toText(signer, "Management"))}</div>
          <div style="font-size:11px;color:#444;">Management Representative</div>
        </td>
      </tr>
    </table>
  `;
}

function keyValueTableHtml(title: string, rows: Array<{ label: string; key: string; value: unknown }>): string {
  const body = rows
    .map((r) => {
      return `
        <tr>
          <td style="width:220px;padding:6px 8px;border:1px solid #b8bec7;background:#f7f7f8;font-weight:700;">${escapeHtml(r.label)}</td>
          <td style="padding:6px 8px;border:1px solid #b8bec7;">${escapeHtml(formatCellByKey(r.key, r.value))}</td>
        </tr>
      `;
    })
    .join("");
  return `
    <div style="margin:16px 0 8px;padding:6px 10px;background:#eef2f7;border-left:4px solid #111;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;">
      ${escapeHtml(title)}
    </div>
    <table border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:12px;margin-bottom:14px;">
      <tbody>${body}</tbody>
    </table>
  `;
}

async function getDataCollectionPayload(id: string): Promise<Record<string, unknown> | null> {
  const direct = await prisma.dataCollection.findUnique({ where: { id }, select: { payload: true } });
  if (direct) return asRecord(direct.payload);

  const legacy = await prisma.appEntity.findUnique({
    where: { resource_entityId: { resource: "data-collections", entityId: id } },
    select: { payload: true },
  });

  return legacy ? asRecord(legacy.payload) : null;
}

async function getQuotationPayload(id: string): Promise<Record<string, unknown> | null> {
  const direct = await prisma.quotation.findUnique({ where: { id }, select: { payload: true } });
  if (direct) return asRecord(direct.payload);

  const legacy = await prisma.appEntity.findUnique({
    where: { resource_entityId: { resource: "quotations", entityId: id } },
    select: { payload: true },
  });

  return legacy ? asRecord(legacy.payload) : null;
}

function isApprovedStatus(value: unknown): boolean {
  return String(value ?? "").trim().toUpperCase() === "APPROVED";
}

async function isQuotationApproved(id: string): Promise<boolean | null> {
  const direct = await prisma.quotation.findUnique({
    where: { id },
    select: { status: true, payload: true },
  });
  if (direct) {
    const payload = asRecord(direct.payload);
    return isApprovedStatus(direct.status || payload.status);
  }

  const legacy = await prisma.appEntity.findUnique({
    where: { resource_entityId: { resource: "quotations", entityId: id } },
    select: { payload: true },
  });
  if (!legacy) return null;

  const payload = asRecord(legacy.payload);
  return isApprovedStatus(payload.status);
}

async function getProjectPayload(id: string): Promise<Record<string, unknown> | null> {
  const direct = await prisma.appEntity.findUnique({
    where: { resource_entityId: { resource: "projects", entityId: id } },
    select: { payload: true },
  });

  return direct ? asRecord(direct.payload) : null;
}

async function getAppEntityPayload(resource: string, id: string): Promise<Record<string, unknown> | null> {
  if (resource === "invoices") {
    const invoice = await prisma.invoiceRecord.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        customerId: true,
        noInvoice: true,
        tanggal: true,
        jatuhTempo: true,
        customer: true,
        customerName: true,
        alamat: true,
        noPO: true,
        subtotal: true,
        ppn: true,
        totalBayar: true,
        paidAmount: true,
        outstandingAmount: true,
        status: true,
        projectName: true,
        noFakturPajak: true,
        perihal: true,
        termin: true,
        buktiTransfer: true,
        noKwitansi: true,
        tanggalBayar: true,
        items: {
          select: {
            deskripsi: true,
            qty: true,
            unit: true,
            hargaSatuan: true,
            total: true,
            sourceRef: true,
            batchNo: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (invoice) {
      return {
        id: invoice.id,
        projectId: invoice.projectId ?? undefined,
        customerId: invoice.customerId ?? undefined,
        noInvoice: invoice.noInvoice,
        tanggal: invoice.tanggal,
        jatuhTempo: invoice.jatuhTempo,
        customer: invoice.customer,
        customerName: invoice.customerName ?? invoice.customer,
        alamat: invoice.alamat,
        noPO: invoice.noPO,
        subtotal: invoice.subtotal,
        ppn: invoice.ppn,
        totalBayar: invoice.totalBayar,
        paidAmount: invoice.paidAmount,
        outstandingAmount: invoice.outstandingAmount,
        status: invoice.status,
        projectName: invoice.projectName ?? undefined,
        noFakturPajak: invoice.noFakturPajak ?? undefined,
        perihal: invoice.perihal ?? undefined,
        termin: invoice.termin ?? undefined,
        buktiTransfer: invoice.buktiTransfer ?? undefined,
        noKwitansi: invoice.noKwitansi ?? undefined,
        tanggalBayar: invoice.tanggalBayar ?? undefined,
        items: invoice.items.map((item) => ({
          deskripsi: item.deskripsi,
          qty: item.qty,
          unit: item.unit,
          hargaSatuan: item.hargaSatuan,
          total: item.total,
          sourceRef: item.sourceRef ?? undefined,
          batchNo: item.batchNo ?? undefined,
        })),
      };
    }
  }

  const row = await prisma.appEntity.findUnique({
    where: { resource_entityId: { resource, entityId: id } },
    select: { payload: true },
  });
  if (row) return asRecord(row.payload);

  const delegateByResource: Record<string, string> = {
    "purchase-orders": "purchaseOrderRecord",
    "surat-jalan": "suratJalanRecord",
    "proof-of-delivery": "proofOfDeliveryRecord",
    "berita-acara": "beritaAcaraRecord",
    "spk-records": "spkRecord",
    "stock-outs": "stockOutRecord",
    "work-orders": "workOrderRecord",
    "material-requests": "materialRequestRecord",
    "production-reports": "productionReportRecord",
    "production-trackers": "productionTrackerRecord",
    "qc-inspections": "qcInspectionRecord",
  };
  const delegateName = delegateByResource[resource];
  if (!delegateName) return null;

  const delegate = (prisma as unknown as Record<string, unknown>)[delegateName] as
    | { findUnique: (args: Record<string, unknown>) => Promise<{ payload?: unknown } | null> }
    | undefined;
  if (!delegate || typeof delegate.findUnique !== "function") return null;

  const dedicatedRow = await delegate.findUnique({
    where: { id },
    select: { payload: true },
  });
  return dedicatedRow ? asRecord(dedicatedRow.payload) : null;
}

type ProjectQuotationContext = {
  sourceLabel: "snapshot" | "linked-quotation" | "none";
  data: Record<string, unknown>;
};

type ProjectBoqCategory = "manpower" | "equipment" | "consumable" | "material" | "other";

const PROJECT_BOQ_CATEGORY_LABEL: Record<ProjectBoqCategory, string> = {
  manpower: "Manpower",
  equipment: "Equipment",
  consumable: "Consumable",
  material: "Material",
  other: "Other",
};

function listFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function pickScopeAndExclusions(source: Record<string, unknown>): {
  scopeOfWork: string[];
  exclusions: string[];
} {
  const terms = asRecord(source.commercialTerms);
  const scopeOfWork = listFromUnknown(terms.scopeOfWork).length
    ? listFromUnknown(terms.scopeOfWork)
    : listFromUnknown(source.scopeOfWork);
  const exclusions = listFromUnknown(terms.exclusions).length
    ? listFromUnknown(terms.exclusions)
    : listFromUnknown(source.exclusions);
  return { scopeOfWork, exclusions };
}

function projectBoqRowsFromPricingItems(pricingItemsRaw: unknown, legacyPayloadRaw?: unknown): Record<string, unknown>[] {
  const pricingItems = asRecord(pricingItemsRaw);
  const hasPricingItems =
    asRecords(pricingItems.manpower).length > 0 ||
    asRecords(pricingItems.consumables).length > 0 ||
    asRecords(pricingItems.equipment).length > 0 ||
    asRecords(pricingItems.materials).length > 0;
  const legacyRoot = asRecord(legacyPayloadRaw);
  const groups: Array<{ key: ProjectBoqCategory; rows: Record<string, unknown>[] }> = [
    { key: "manpower", rows: hasPricingItems ? asRecords(pricingItems.manpower) : asRecords(legacyRoot.manpower) },
    { key: "consumable", rows: hasPricingItems ? asRecords(pricingItems.consumables) : asRecords(legacyRoot.consumables) },
    { key: "equipment", rows: hasPricingItems ? asRecords(pricingItems.equipment) : asRecords(legacyRoot.equipment) },
    { key: "material", rows: hasPricingItems ? asRecords(pricingItems.materials) : asRecords(legacyRoot.materials) },
  ];

  const rows: Record<string, unknown>[] = [];
  for (const group of groups) {
    for (const item of group.rows) {
      const quantity = toNum(item.quantity) || 1;
      const duration = toNum(item.duration) || 1;
      const unitPrice = toNum(item.costPerUnit);
      const totalCost = toNum(item.totalCost) || quantity * duration * unitPrice;
      rows.push({
        itemKode: toText(item.id, "-"),
        materialName: toText(item.description, "-"),
        qtyEstimate: quantity * duration,
        unit: toText(item.unit, "Unit"),
        unitPrice,
        totalCost,
        category: group.key,
      });
    }
  }
  return rows;
}

function normalizeProjectBoqCategory(raw: Record<string, unknown>): ProjectBoqCategory {
  const text = String(raw.category || raw.section || raw.group || "").toLowerCase();
  const code = String(raw.itemKode || "").toUpperCase();
  const name = String(raw.materialName || "").toLowerCase();
  if (text.includes("manpower") || text.includes("jasa") || code.startsWith("MP-") || name.includes("teknisi")) return "manpower";
  if (text.includes("equipment") || text.includes("alat") || code.startsWith("EQ-")) return "equipment";
  if (text.includes("consum") || code.startsWith("CON-")) return "consumable";
  if (text.includes("material") || code.startsWith("MAT-")) return "material";
  return "other";
}

function projectBoqGroupedSections(boqRaw: unknown[]): Array<{
  key: ProjectBoqCategory;
  label: string;
  rows: Record<string, unknown>[];
  subtotal: number;
}> {
  const normalized = boqRaw.map((item) => {
    const row = asRecord(item);
    const qty = toNum(row.qtyEstimate);
    const unitPrice = toNum(row.unitPrice);
    const totalCost = toNum(row.totalCost) || qty * unitPrice;
    return {
      ...row,
      qtyEstimate: qty,
      unitPrice,
      totalCost,
      category: normalizeProjectBoqCategory(row),
    };
  });

  return (Object.keys(PROJECT_BOQ_CATEGORY_LABEL) as ProjectBoqCategory[])
    .map((key) => {
      const rows = normalized.filter((row) => row.category === key);
      const subtotal = rows.reduce((acc, row) => acc + toNum(row.totalCost), 0);
      return { key, label: PROJECT_BOQ_CATEGORY_LABEL[key], rows, subtotal };
    })
    .filter((section) => section.rows.length > 0);
}

function projectBoqWordHtml(boqRaw: unknown[]): string {
  const sections = projectBoqGroupedSections(boqRaw);
  const grandTotal = sections.reduce((acc, section) => acc + section.subtotal, 0);
  if (sections.length === 0) {
    return listTable("BOQ Items", [], ["itemKode", "materialName", "qtyEstimate", "unit", "unitPrice", "totalCost"]);
  }

  const sectionHtml = sections
    .map((section) => {
      return `
        <h3>BOQ - ${escapeHtml(section.label)}</h3>
        ${listTable(`${section.label} Items`, section.rows, ["itemKode", "materialName", "qtyEstimate", "unit", "unitPrice", "totalCost"])}
        <p><b>Subtotal ${escapeHtml(section.label)}:</b> Rp ${idr(section.subtotal)}</p>
      `;
    })
    .join("");

  return `${sectionHtml}<p><b>Grand Total BOQ:</b> Rp ${idr(grandTotal)}</p>`;
}

function projectBoqExcelRowsHtml(boqRaw: unknown[]): string {
  const sections = projectBoqGroupedSections(boqRaw);
  const grandTotal = sections.reduce((acc, section) => acc + section.subtotal, 0);
  if (sections.length === 0) return "<tr><td colspan='6'>-</td></tr>";

  const rows = sections
    .map((section) => {
      const items = section.rows
        .map((row) => {
          return `<tr><td>${escapeHtml(formatCellByKey("itemKode", row.itemKode))}</td><td>${escapeHtml(formatCellByKey("materialName", row.materialName))}</td><td>${escapeHtml(formatCellByKey("qtyEstimate", row.qtyEstimate))}</td><td>${escapeHtml(formatCellByKey("unit", row.unit))}</td><td>${escapeHtml(formatCellByKey("unitPrice", row.unitPrice))}</td><td>${escapeHtml(formatCellByKey("totalCost", row.totalCost))}</td></tr>`;
        })
        .join("");
      return `
        <tr><td colspan="6" class="section">BOQ - ${escapeHtml(section.label)}</td></tr>
        ${items}
        <tr><td colspan="5"><b>Subtotal ${escapeHtml(section.label)}</b></td><td><b>${escapeHtml(formatCellByKey("totalCost", section.subtotal))}</b></td></tr>
      `;
    })
    .join("");

  return `${rows}<tr><td colspan="5"><b>Grand Total BOQ</b></td><td><b>${escapeHtml(formatCellByKey("totalCost", grandTotal))}</b></td></tr>`;
}

async function getProjectQuotationContext(payload: Record<string, unknown>): Promise<ProjectQuotationContext> {
  const snapshot = asRecord(payload.quotationSnapshot);
  if (Object.keys(snapshot).length > 0) {
    return { sourceLabel: "snapshot", data: snapshot };
  }

  const quotationId = String(payload.quotationId || "").trim();
  if (!quotationId) return { sourceLabel: "none", data: {} };

  const quotationPayload = await getQuotationPayload(quotationId);
  if (!quotationPayload) return { sourceLabel: "none", data: {} };

  return { sourceLabel: "linked-quotation", data: quotationPayload };
}

async function isProjectApproved(id: string): Promise<boolean | null> {
  const direct = await prisma.appEntity.findUnique({
    where: { resource_entityId: { resource: "projects", entityId: id } },
    select: { payload: true },
  });
  if (!direct) return null;

  const payload = asRecord(direct.payload);
  return isApprovedStatus(payload.approvalStatus);
}

function listTable(title: string, items: unknown[], cols: string[]): string {
  const rows = items
    .map((raw) => {
      const r = asRecord(raw);
      const tds = cols
        .map((c) => `<td style="padding:6px 8px;border:1px solid #b8bec7;vertical-align:top;">${escapeHtml(formatCellByKey(c, r[c]))}</td>`)
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `
    <div style="margin:16px 0 8px;padding:6px 10px;background:#eef2f7;border-left:4px solid #111;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;">
      ${escapeHtml(title)}
    </div>
    <table border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:12px;margin-bottom:14px;">
      <thead>
        <tr style="background:#e5e7eb;">
          ${cols.map((c) => `<th style="padding:7px 8px;border:1px solid #b8bec7;text-align:left;">${escapeHtml(humanizeLabel(c))}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="${cols.length}" style="padding:8px;border:1px solid #b8bec7;text-align:center;">-</td></tr>`}</tbody>
    </table>
  `;
}

type TabularReportPayload = {
  title?: unknown;
  subtitle?: unknown;
  columns?: unknown;
  rows?: unknown;
  notes?: unknown;
  generatedBy?: unknown;
};

function tabularMetaTableHtml(input: { subtitle: string; generatedBy: string; rowCount: number }): string {
  const metaRows = [
    { label: "Deskripsi", value: input.subtitle || "-" },
    { label: "Tanggal Cetak", value: formatTanggalIndonesia(new Date().toISOString()) },
    { label: "Total Baris", value: input.rowCount.toLocaleString("id-ID") },
    { label: "Disiapkan Oleh", value: input.generatedBy || "System" },
  ];
  return `
    <table style="width:100%;border-collapse:collapse;margin:0 0 14px;font-size:11px;">
      <tbody>
        ${metaRows
          .map(
            (row) => `
              <tr>
                <td style="width:150px;padding:4px 6px;border:1px solid #b8bec7;background:#f7f7f8;font-weight:700;">${escapeHtml(
                  row.label,
                )}</td>
                <td style="padding:4px 6px;border:1px solid #b8bec7;">${escapeHtml(row.value)}</td>
              </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function tabularReportExportHtml(input: TabularReportPayload): string {
  const title = toText(input.title, "Finance Report");
  const subtitle = toText(input.subtitle, "");
  const columns = Array.isArray(input.columns) ? input.columns.map((c) => toText(c, "")).filter(Boolean) : [];
  const rawRows = Array.isArray(input.rows) ? input.rows : [];
  const notes = toText(input.notes, "");
  const generatedBy = toText(input.generatedBy, "System");

  const safeColumns = columns.length ? columns : ["Data"];
  const isKeyValueLayout =
    safeColumns.length === 2 && /^(field|label|keterangan|uraian)$/i.test(safeColumns[0]) && /^(value|nilai)$/i.test(safeColumns[1]);
  const tableRows = rawRows
    .map((row) => (Array.isArray(row) ? row : [row]))
    .map((row, rowIndex) => {
      const padded = [...row];
      while (padded.length < safeColumns.length) padded.push("-");
      return `<tr>${padded
        .slice(0, safeColumns.length)
        .map((cell, cellIndex) => {
          const lowerKey = safeColumns[cellIndex] || `column_${cellIndex + 1}`;
          const formatted = formatCellByKey(lowerKey, cell);
          const alignRight =
            CURRENCY_KEY_RE.test(lowerKey.toLowerCase()) ||
            /(total|nilai|nominal|amount|margin|persen|percent|qty|jumlah|hari|hours?)/i.test(lowerKey);
          const background = rowIndex % 2 === 0 ? "#ffffff" : "#fafafa";
          const extraStyle = isKeyValueLayout && cellIndex === 0 ? "font-weight:700;background:#f7f7f8;" : `background:${background};`;
          return `<td style="border:1px solid #b8bec7;padding:6px 8px;${extraStyle}${alignRight ? "text-align:right;" : ""}">${escapeHtml(
            formatted,
          )}</td>`;
        })
        .join("")}</tr>`;
    })
    .join("");

  return `
    ${companyLetterheadHtml(title)}
    ${tabularMetaTableHtml({ subtitle, generatedBy, rowCount: rawRows.length })}
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:11px;margin-bottom:14px;">
      <thead>
        <tr>${safeColumns
          .map(
            (col) =>
              `<th style="border:1px solid #6b7280;padding:7px 8px;background:#e9edf2;color:#111827;text-transform:uppercase;font-size:10px;letter-spacing:.4px;text-align:left;">${escapeHtml(
                col,
              )}</th>`,
          )
          .join("")}</tr>
      </thead>
      <tbody>
        ${
          tableRows ||
          `<tr><td colspan="${safeColumns.length}" style="border:1px solid #b8bec7;padding:10px 8px;text-align:center;color:#6b7280;">Tidak ada data</td></tr>`
        }
      </tbody>
    </table>
    ${
      notes
        ? `<div style="margin-top:10px;padding:10px 12px;border:1px solid #d4d4d8;background:#fafaf9;font-size:11px;"><div style="font-weight:700;margin-bottom:4px;">Catatan</div><div>${escapeHtml(
            notes,
          )}</div></div>`
        : ""
    }
    ${companyFooterHtml(generatedBy)}
  `;
}

function asRecords(items: unknown): Record<string, unknown>[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => asRecord(item));
}

function toNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.replace(/\s/g, "").replace(/,/g, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function toText(value: unknown, fallback = "-"): string {
  const text = stripDemoMarker(String(value ?? "").trim());
  return text || fallback;
}

function idr(value: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.round(value));
}

function formatTanggalIndonesia(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type TkJakonExportRow = {
  no: number;
  jenis_identitas: string;
  nomor_identitas: string;
  status: string;
  nama_lengkap: string;
  jenis_kelamin: string;
  tanggal_lahir: string;
  tempat_lahir: string;
  alamat_tinggal: string;
  nama_ibu_kandung: string;
  mulai_bekerja: string;
  no_hp: string;
  jenis_pekerjaan: string;
  nama_pekerjaan_lain: string;
};

type TkJakonResolved = {
  title: string;
  rows: TkJakonExportRow[];
};

function normalizeKey(input: unknown): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function pickValueByAliases(row: Record<string, unknown>, aliases: string[]): string {
  const direct = aliases
    .map((key) => {
      const val = row[key];
      return val === undefined || val === null ? "" : String(val).trim();
    })
    .find((v) => v.length > 0);
  if (direct) return direct;

  const entries = Object.entries(row);
  for (const [key, value] of entries) {
    const nk = normalizeKey(key);
    if (!aliases.map((a) => normalizeKey(a)).includes(nk)) continue;
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function resolveTkJakonPayload(payload: Record<string, unknown>): TkJakonResolved {
  const normalized = asRecord(payload.normalized);
  const normalizedAbsensi = asRecord(normalized.absensiTkJakon);
  const absensiRoot = asRecord(payload.absensiTkJakon);
  const candidateRows = [
    ...asRecords(normalizedAbsensi.rows),
    ...asRecords(absensiRoot.rows),
    ...asRecords(payload.rows),
  ];

  const rows = candidateRows
    .map((row, idx) => {
      const noRaw = pickValueByAliases(row, ["no", "nomor"]);
      const no = Number(String(noRaw).replace(/[^\d]/g, ""));
      const nama = pickValueByAliases(row, ["nama_lengkap", "nama", "name"]);
      return {
        no: Number.isFinite(no) && no > 0 ? no : idx + 1,
        jenis_identitas: pickValueByAliases(row, ["jenis_identitas", "identitas"]) || "KTP",
        nomor_identitas: pickValueByAliases(row, ["nomor_identitas", "nik", "no_ktp"]),
        status: pickValueByAliases(row, ["status"]),
        nama_lengkap: nama,
        jenis_kelamin: pickValueByAliases(row, ["jenis_kelamin", "jk", "kelamin"]),
        tanggal_lahir: pickValueByAliases(row, ["tanggal_lahir", "tgl_lahir"]),
        tempat_lahir: pickValueByAliases(row, ["tempat_lahir"]),
        alamat_tinggal: pickValueByAliases(row, ["alamat_tinggal", "alamat"]),
        nama_ibu_kandung: pickValueByAliases(row, ["nama_ibu_kandung", "ibu_kandung"]),
        mulai_bekerja: pickValueByAliases(row, ["mulai_bekerja", "tgl_masuk"]),
        no_hp: pickValueByAliases(row, ["no_hp", "hp", "telepon"]),
        jenis_pekerjaan: pickValueByAliases(row, ["jenis_pekerjaan", "kode_pekerjaan"]),
        nama_pekerjaan_lain: pickValueByAliases(row, ["nama_pekerjaan_lain", "jabatan", "pekerjaan"]),
      };
    })
    .filter((row) => row.nama_lengkap.length > 0);

  const seen = new Set<string>();
  const deduped = rows.filter((row) => {
    const key = row.nama_lengkap.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    title: toText(normalizedAbsensi.title || payload.title || payload.judul || "DATA DETAIL TK JAKON", "DATA DETAIL TK JAKON"),
    rows: deduped.map((row, idx) => ({ ...row, no: idx + 1 })),
  };
}

function tkJakonTableHeaderHtml(): string {
  return `
    <thead>
      <tr class="tk-head">
        <th>No</th>
        <th>JENIS IDENTITAS</th>
        <th>NOMOR_IDENTITAS</th>
        <th>Status</th>
        <th>NAMA LENGKAP</th>
        <th>JENIS KELAMIN</th>
        <th>TANGGAL LAHIR</th>
        <th>TEMPAT_LAHIR</th>
        <th>ALAMAT_TINGGAL</th>
        <th>NAMA IBU KANDUNG</th>
        <th>MULAI BEKERJA</th>
        <th>NO_HP</th>
        <th>JENIS PEKERJAAN</th>
        <th>NAMA PEKERJAAN LAIN</th>
      </tr>
    </thead>
  `;
}

function tkJakonWordHtml(payload: Record<string, unknown>): string {
  const tk = resolveTkJakonPayload(payload);
  const bodyRows = tk.rows
    .map((row) => {
      return `
        <tr>
          <td>${escapeHtml(row.no)}</td>
          <td>${escapeHtml(row.jenis_identitas)}</td>
          <td>${escapeHtml(row.nomor_identitas || "-")}</td>
          <td>${escapeHtml(row.status || "-")}</td>
          <td>${escapeHtml(row.nama_lengkap)}</td>
          <td>${escapeHtml(row.jenis_kelamin || "-")}</td>
          <td>${escapeHtml(row.tanggal_lahir || "-")}</td>
          <td>${escapeHtml(row.tempat_lahir || "-")}</td>
          <td>${escapeHtml(row.alamat_tinggal || "-")}</td>
          <td>${escapeHtml(row.nama_ibu_kandung || "-")}</td>
          <td>${escapeHtml(row.mulai_bekerja || "-")}</td>
          <td>${escapeHtml(row.no_hp || "-")}</td>
          <td>${escapeHtml(row.jenis_pekerjaan || "-")}</td>
          <td>${escapeHtml(row.nama_pekerjaan_lain || "-")}</td>
        </tr>
      `;
    })
    .join("");

  return `
    ${companyLetterheadHtml("Data Detail TK Jakon")}
    <style>
      .tk-title { font-family: Arial, sans-serif; font-weight: 700; font-size: 16px; text-align: center; margin: 0 0 8px; }
      .tk-meta { font-family: Arial, sans-serif; font-size: 11px; margin: 0 0 8px; }
      .tk-table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10px; }
      .tk-table th, .tk-table td { border: 1px solid #222; padding: 4px; vertical-align: middle; }
      .tk-table .tk-head th { background: #dce6ce; text-align: center; }
      .tk-table td:nth-child(1), .tk-table td:nth-child(6), .tk-table td:nth-child(13) { text-align: center; }
      .tk-footer { font-family: Arial, sans-serif; margin-top: 10px; font-size: 11px; }
    </style>
    <h1 class="tk-title">${escapeHtml(tk.title)}</h1>
    <p class="tk-meta"><b>Total Data:</b> ${escapeHtml(tk.rows.length)}</p>
    <table class="tk-table">
      ${tkJakonTableHeaderHtml()}
      <tbody>${bodyRows || `<tr><td colspan="14" style="text-align:center;">-</td></tr>`}</tbody>
    </table>
    <div class="tk-footer">Dicetak: ${escapeHtml(formatTanggalIndonesia(new Date().toISOString()))}</div>
  `;
}

function tkJakonExcelHtml(payload: Record<string, unknown>): string {
  const tk = resolveTkJakonPayload(payload);
  const rows = tk.rows
    .map((row) => {
      return `
        <tr>
          <td>${escapeHtml(row.no)}</td>
          <td>${escapeHtml(row.jenis_identitas)}</td>
          <td>${escapeHtml(row.nomor_identitas || "-")}</td>
          <td>${escapeHtml(row.status || "-")}</td>
          <td>${escapeHtml(row.nama_lengkap)}</td>
          <td>${escapeHtml(row.jenis_kelamin || "-")}</td>
          <td>${escapeHtml(row.tanggal_lahir || "-")}</td>
          <td>${escapeHtml(row.tempat_lahir || "-")}</td>
          <td>${escapeHtml(row.alamat_tinggal || "-")}</td>
          <td>${escapeHtml(row.nama_ibu_kandung || "-")}</td>
          <td>${escapeHtml(row.mulai_bekerja || "-")}</td>
          <td>${escapeHtml(row.no_hp || "-")}</td>
          <td>${escapeHtml(row.jenis_pekerjaan || "-")}</td>
          <td>${escapeHtml(row.nama_pekerjaan_lain || "-")}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table>
      <tr>
        <td style="width:90px;vertical-align:top;border:none;">
          <img src="${COMPANY_LOGO_DATA_URI}" alt="Logo Gema Teknik" style="max-width:68px;max-height:52px;object-fit:contain;" />
        </td>
        <td style="border:none;">
          <div style="font-size:18px;font-weight:700;">${escapeHtml(COMPANY_NAME)}</div>
          <div style="font-size:12px;font-weight:700;">${escapeHtml(COMPANY_TAGLINE)}</div>
          <div style="font-size:11px;">${escapeHtml(COMPANY_ADDRESS)}</div>
          <div style="font-size:11px;">${escapeHtml(COMPANY_CONTACT)}</div>
        </td>
      </tr>
    </table>
    <table>
      <tr><th colspan="14" class="section">${escapeHtml(tk.title)}</th></tr>
      <tr><td colspan="14"><b>Total Data:</b> ${escapeHtml(tk.rows.length)}</td></tr>
      <tr>
        <th>No</th>
        <th>JENIS IDENTITAS</th>
        <th>NOMOR_IDENTITAS</th>
        <th>Status</th>
        <th>NAMA LENGKAP</th>
        <th>JENIS KELAMIN</th>
        <th>TANGGAL LAHIR</th>
        <th>TEMPAT_LAHIR</th>
        <th>ALAMAT_TINGGAL</th>
        <th>NAMA IBU KANDUNG</th>
        <th>MULAI BEKERJA</th>
        <th>NO_HP</th>
        <th>JENIS PEKERJAAN</th>
        <th>NAMA PEKERJAAN LAIN</th>
      </tr>
      ${rows || `<tr><td colspan="14" style="text-align:center;">-</td></tr>`}
    </table>
  `;
}

type PricingRow = {
  no: number;
  kategori: string;
  keterangan: string;
  hargaUnit: number;
  qty: number;
  unit: string;
  total: number;
};

function normalizePricingRows(items: Record<string, unknown>[], kategori: string, unitFallback: string): PricingRow[] {
  return items.map((item, idx) => {
    const qty = toNum(item.quantity) || toNum(item.qty) || toNum(item.jumlah);
    const duration = toNum(item.duration) || 1;
    const costPerUnit = toNum(item.costPerUnit) || toNum(item.unitPrice) || toNum(item.hargaSatuan);
    const totalCostRaw = toNum(item.totalCost) || toNum(item.totalPrice) || toNum(item.jumlahHarga);
    const totalCost = totalCostRaw > 0 ? totalCostRaw : qty * duration * costPerUnit;
    const displayUnit = toText(item.unit || item.satuan || item.durationUnit, unitFallback);
    const displayName = toText(
      item.description || item.materialName || item.nama || item.itemName || item.equipmentName || item.jabatan || item.deskripsi
    );
    return {
      no: idx + 1,
      kategori,
      keterangan: displayName,
      hargaUnit: costPerUnit,
      qty: qty > 0 ? qty : duration,
      unit: displayUnit,
      total: totalCost,
    };
  });
}

type QuotationTemplate = "jasa" | "material" | "equipment";
type QuotationDocStyle = "legal-formal" | "corporate-minimal";

function resolveQuotationDocStyle(input: unknown): QuotationDocStyle {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "corporate-minimal" || raw === "minimal" || raw === "corporate") {
    return "corporate-minimal";
  }
  return "legal-formal";
}

function detectQuotationTemplate(payload: Record<string, unknown>): QuotationTemplate {
  const jenisQuotation = String(payload.jenisQuotation || payload.kategori || "").toUpperCase();
  const perihal = String(payload.perihal || payload.judul || "").toUpperCase();

  if (jenisQuotation.includes("MATERIAL") || perihal.includes("MATERIAL")) return "material";
  if (jenisQuotation.includes("EQUIPMENT") || perihal.includes("EQUIPMENT") || perihal.includes("SEWA")) return "equipment";
  return "jasa";
}

function buildPricingGroups(payload: Record<string, unknown>, template: QuotationTemplate) {
  const pricingItems = asRecord(payload.pricingItems);
  const hasPricingItems =
    asRecords(pricingItems.manpower).length > 0 ||
    asRecords(pricingItems.consumables).length > 0 ||
    asRecords(pricingItems.equipment).length > 0 ||
    asRecords(pricingItems.materials).length > 0;

  const manpowerSource = hasPricingItems ? asRecords(pricingItems.manpower) : asRecords(payload.manpower);
  const consumablesSource = hasPricingItems ? asRecords(pricingItems.consumables) : asRecords(payload.consumables);
  const equipmentSource = hasPricingItems ? asRecords(pricingItems.equipment) : asRecords(payload.equipment);
  const materialsSource = hasPricingItems ? asRecords(pricingItems.materials) : asRecords(payload.materials);

  const manpower = normalizePricingRows(manpowerSource, "Jasa Kerja", "Orang");
  const consumables = normalizePricingRows(consumablesSource, "Hand Tool & Consumable", "Lot");
  const equipment = normalizePricingRows(equipmentSource, "Equipment", "Unit");
  const materials = normalizePricingRows(materialsSource, "Material", "Unit");

  let groups;
  if (template === "material") {
    groups = [
      { title: "I. Material", rows: materials },
      { title: "II. Consumable", rows: consumables },
      { title: "III. Equipment Pendukung", rows: equipment },
      { title: "IV. Jasa Handling", rows: manpower },
    ];
  } else if (template === "equipment") {
    groups = [
      { title: "I. Equipment", rows: equipment },
      { title: "II. Mobilisasi & Consumable", rows: consumables },
      { title: "III. Jasa Teknisi", rows: manpower },
      { title: "IV. Material Pendukung", rows: materials },
    ];
  } else {
    groups = [
      { title: "I. Jasa Kerja", rows: manpower },
      { title: "II. Hand Tool & Safety Equipment", rows: consumables },
      { title: "III. Equipment", rows: equipment },
      { title: "IV. Material", rows: materials },
    ];
  }

  const nonEmpty = groups.filter((g) => g.rows.length > 0);
  const rows = nonEmpty.length > 0 ? nonEmpty : groups.slice(0, 1);
  return rows;
}

function quotationLetterHtml(
  payload: Record<string, unknown>,
  opts?: { excel?: boolean; style?: QuotationDocStyle }
): string {
  const customer = asRecord(payload.customer);
  const noPenawaran = toText(payload.noPenawaran || payload.nomorQuotation || payload.noQuotation || payload.id);
  const perihal = toText(payload.perihal || payload.judul || payload.tipePekerjaan || "Penawaran Harga");
  const kepada = toText(payload.kepada || customer.nama || payload.customerName || payload.namaResponden || "-");
  const perusahaan = toText(payload.perusahaan || customer.nama || payload.customerName, "");
  const lokasi = toText(payload.lokasi || customer.alamat || payload.customerAlamat || payload.address, "");
  const up = toText(payload.up || payload.upAttn || customer.pic || payload.customerPIC, "-");
  const tanggal = toText(payload.tanggal || payload.createdAt || new Date().toISOString());
  const tanggalCetak = formatTanggalIndonesia(payload.tanggal);
  const terms = asRecord(payload.commercialTerms);
  const conditions = Array.isArray(terms.conditions) ? terms.conditions : [];
  const scopeOfWorkRaw =
    Array.isArray(terms.scopeOfWork) && terms.scopeOfWork.length > 0
      ? terms.scopeOfWork
      : Array.isArray(payload.scopeOfWork)
      ? payload.scopeOfWork
      : [];
  const exclusionsRaw =
    Array.isArray(terms.exclusions) && terms.exclusions.length > 0
      ? terms.exclusions
      : Array.isArray(payload.exclusions)
      ? payload.exclusions
      : [];
  const scopeOfWork = scopeOfWorkRaw.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0);
  const exclusions = exclusionsRaw.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0);
  const template = detectQuotationTemplate(payload);
  const groups = buildPricingGroups(payload, template);
  const grandTotalRaw = toNum(payload.grandTotal);
  const signer = toText(payload.createdBy || payload.sourceSnapshotBy || payload.approvedBy, "Management");
  const pricingConfig = asRecord(payload.pricingConfig);
  const discountPercent =
    toNum(payload.diskonPersen) ||
    toNum(payload.discountPercent) ||
    toNum(pricingConfig.discountPercent);
  const subtotalAll = groups.reduce((sum, group) => sum + group.rows.reduce((acc, row) => acc + row.total, 0), 0);
  const discountNominal = toNum(payload.diskonNominal) || subtotalAll * (discountPercent / 100);
  const dpp = Math.max(0, subtotalAll - discountNominal);
  const ppnPercent = toNum(payload.ppn) || toNum(payload.ppnPercent) || 11;
  const ppnNominal = toNum(payload.ppnNominal) || dpp * (ppnPercent / 100);
  const grandTotal = grandTotalRaw > 0 ? grandTotalRaw : dpp + ppnNominal;
  const paymentTerms = asRecord(payload.paymentTerms);
  const termins = Array.isArray(paymentTerms.termins) ? paymentTerms.termins : [];
  const docStyle = opts?.style || "legal-formal";
  const isMinimal = docStyle === "corporate-minimal";
  const paymentTermsHtml =
    termins.length > 0
      ? `<ul class="notes">${termins
          .map((item) => {
            const term = asRecord(item);
            return `<li>${escapeHtml(toText(term.label, "Termin"))}: ${escapeHtml(formatCellByKey("percent", term.percent))}% - ${escapeHtml(toText(term.timing, "-"))}</li>`;
          })
          .join("")}</ul>`
      : `<p class="block-text">Pembayaran sesuai termin pada dokumen quotation.</p>`;
  const templateLabel =
    template === "material"
      ? "penawaran material refractory"
      : template === "equipment"
      ? "penawaran equipment pendukung pekerjaan"
      : "penawaran jasa kerja refractory";

  const sectionHtml = groups
    .map((group) => {
      const bodyRows = group.rows
        .map((row) => {
          return `
            <tr>
              <td>${row.no}</td>
              <td>${escapeHtml(row.keterangan)}</td>
              <td style="text-align:right;">Rp ${idr(row.hargaUnit)}</td>
              <td style="text-align:center;">${row.qty} ${escapeHtml(row.unit)}</td>
              <td style="text-align:right;">Rp ${idr(row.total)}</td>
            </tr>
          `;
        })
        .join("");
      const subtotal = group.rows.reduce((acc, row) => acc + row.total, 0);
      return `
        <tr class="section-row">
          <td colspan="5"><b>${escapeHtml(group.title)}</b></td>
        </tr>
        ${bodyRows}
        <tr class="subtotal-row">
          <td colspan="4" style="text-align:right;"><b>Subtotal</b></td>
          <td style="text-align:right;"><b>Rp ${idr(subtotal)}</b></td>
        </tr>
      `;
    })
    .join("");

  const notesHtml =
    conditions.length > 0
      ? conditions.map((note) => `<li>${escapeHtml(note)}</li>`).join("")
      : `<li>Harga belum termasuk PPN 11%.</li><li>Pembayaran sesuai termin pada dokumen quotation.</li>`;
  const scopeHtml = scopeOfWork.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const exclusionsHtml = exclusions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  return `
    <style>
      .sheet { font-family: Cambria, "Times New Roman", serif; font-size: ${opts?.excel ? "12px" : "13px"}; color:#111; }
      .head-table { width:100%; border-collapse:collapse; margin-bottom:8px; }
      .head-table td { vertical-align:top; }
      .logo-box { width:96px; height:72px; border:1px solid #333; display:flex; align-items:center; justify-content:center; font-weight:700; background:#fff; }
      .logo-box img { max-width:88px; max-height:64px; object-fit:contain; }
      .company-name { font-size:24px; font-weight:700; line-height:1.1; letter-spacing:0.2px; text-transform:uppercase; }
      .company-sub { font-size:12px; margin-top:2px; font-weight:700; letter-spacing:0.3px; }
      .doc-title { margin-top:8px; font-size:${isMinimal ? "16px" : "18px"}; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; text-align:center; }
      .doc-subtitle { margin-top:2px; font-size:11px; text-align:center; letter-spacing:0.4px; }
      .line { border-top:3px solid #222; margin:8px 0 10px; }
      .meta { width:100%; border-collapse:collapse; margin-bottom:8px; border:1px solid #222; }
      .meta td { padding:4px 6px; border:1px solid #222; }
      .meta .label { width:120px; font-weight:700; background:#f6f7f8; }
      .pricing { width:100%; border-collapse:collapse; margin-top:6px; }
      .pricing th, .pricing td { border:1px solid #222; padding:3px 6px; }
      .pricing th { background:#eceff3; text-transform:uppercase; font-size:11px; letter-spacing:0.4px; }
      .section-row td { background:#f7f8fa; }
      .subtotal-row td { background:#f6f6f6; }
      .summary { width:360px; margin-top:10px; margin-left:auto; border-collapse:collapse; }
      .summary td { border:1px solid #222; padding:4px 6px; }
      .summary td:first-child { background:#f6f7f8; font-weight:700; width:210px; }
      ul.notes { margin:6px 0 0 18px; padding:0; }
      ul.notes li { margin:2px 0; }
      .block-title { margin:12px 0 4px; font-weight:700; text-transform:uppercase; font-size:12px; }
      .block-text { margin:2px 0; }
      .sign { margin-top:14px; }
      .intro { margin: 8px 0 2px; }
      .open { margin: 2px 0 6px; }
      .closing { margin-top:10px; }
      .sign-grid { width:100%; border-collapse:collapse; margin-top:10px; }
      .sign-grid td { vertical-align:top; }
      .sign-left { width:52%; }
      .sign-right { width:48%; text-align:center; }
      .sign-space { height:60px; }
      .sign-name { font-weight:700; text-decoration:underline; }
      .sign-role { font-size:11px; }
    </style>

    <div class="sheet">
      <table class="head-table">
        <tr>
          <td style="width:130px;"><div class="logo-box"><img src="${COMPANY_LOGO_DATA_URI}" alt="Logo Gema Teknik" /></div></td>
          <td>
            <div class="company-name">PT. GEMA TEKNIK PERKASA</div>
            <div class="company-sub">REFRACTORY FURNACE AND BOILER</div>
            <div>Jl. Nurushoba II No 13 Setia Mekar Tambun Selatan Bekasi 17510</div>
            <div>Phone: 08510420221, 021.88354139</div>
            <div>Email: gemateknik@gmail.com</div>
            <div class="doc-title">SURAT PENAWARAN</div>
            <div class="doc-subtitle">${isMinimal ? "Corporate Quotation" : "Quotation / Final Offer Document"}</div>
          </td>
        </tr>
      </table>
      <div class="line"></div>

      <table class="meta">
        <tr><td class="label">No. Penawaran</td><td>${escapeHtml(noPenawaran)}</td></tr>
        <tr><td class="label">Tanggal</td><td>${escapeHtml(formatTanggalIndonesia(tanggal))}</td></tr>
        <tr><td class="label">Perihal</td><td>${escapeHtml(perihal)}</td></tr>
        <tr><td class="label">Kepada Yth</td><td>${escapeHtml(kepada)} ${perusahaan ? `- ${escapeHtml(perusahaan)}` : ""}</td></tr>
        <tr><td class="label">Di</td><td>${escapeHtml(lokasi)}</td></tr>
        <tr><td class="label">U/P</td><td>${escapeHtml(up)}</td></tr>
      </table>

      <p class="open">Dengan hormat,</p>
      <p class="intro">Sehubungan dengan rencana pekerjaan, bersama ini kami ajukan ${escapeHtml(templateLabel)} sebagai berikut:</p>

      <table class="pricing">
        <thead>
          <tr>
            <th style="width:40px;">No</th>
            <th>Keterangan</th>
            <th style="width:160px;">Harga / Unit</th>
            <th style="width:140px;">Jumlah</th>
            <th style="width:180px;">Total Harga</th>
          </tr>
        </thead>
        <tbody>
          ${sectionHtml}
        </tbody>
      </table>

      <table class="summary">
        <tr><td>Subtotal</td><td style="text-align:right;">Rp ${idr(subtotalAll)}</td></tr>
        <tr><td>Diskon (${discountPercent.toLocaleString("id-ID")}%)</td><td style="text-align:right;">Rp ${idr(discountNominal)}</td></tr>
        <tr><td>DPP</td><td style="text-align:right;">Rp ${idr(dpp)}</td></tr>
        <tr><td>PPN (${ppnPercent.toLocaleString("id-ID")}%)</td><td style="text-align:right;">Rp ${idr(ppnNominal)}</td></tr>
        <tr><td><b>Grand Total</b></td><td style="text-align:right;"><b>Rp ${idr(grandTotal)}</b></td></tr>
      </table>

      <p class="block-title">${isMinimal ? "Ketentuan Penawaran" : "1. Ketentuan Penawaran"}</p>
      <ul class="notes">${notesHtml}</ul>
      ${
        scopeHtml
          ? `<p class="block-title">${isMinimal ? "Scope Of Work" : "2. Scope Of Work"}</p><ul class="notes">${scopeHtml}</ul>`
          : ""
      }
      ${
        exclusionsHtml
          ? `<p class="block-title">${isMinimal ? "Exclusions" : "3. Exclusions"}</p><ul class="notes">${exclusionsHtml}</ul>`
          : ""
      }
      <p class="block-title">${isMinimal ? "Payment Terms" : "4. Payment Terms"}</p>
      ${paymentTermsHtml}

      <div class="sign">
        <p class="closing">Demikian penawaran harga ini kami sampaikan. Atas perhatian dan kerja samanya kami ucapkan terima kasih.</p>
        <table class="sign-grid">
          <tr>
            <td class="sign-left">
              <p>Penerima Penawaran,</p>
              <div class="sign-space"></div>
              <p class="sign-name">${escapeHtml(kepada)}</p>
              <p class="sign-role">${escapeHtml(perusahaan || "-")}</p>
            </td>
            <td class="sign-right">
              <p>Bekasi, ${escapeHtml(tanggalCetak)}</p>
              <p>Hormat kami,</p>
              <p>PT. Gema Teknik Perkasa</p>
              <div class="sign-space"></div>
              <p class="sign-name">${escapeHtml(signer)}</p>
              <p class="sign-role">Authorized Signatory</p>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
}

function technicalInfoHtml(payload: Record<string, unknown>): string {
  const endUser = toText(payload.kepada, "-");
  const projectName = toText(payload.perihal, "-");
  const location = toText(payload.lokasi, "-");
  const country = "Indonesia";
  const createBy = toText(payload.createdBy || payload.sourceSnapshotBy, "-");
  const date = toText(payload.tanggal, "-");
  const rev = toText(payload.revisi || payload.rev, "0");
  const noDoc = toText(payload.noDoc, "0");
  const contractPartner = toText(payload.contractPartner, "-");
  const segment = toText(payload.segment, "Thermal drying");

  return `
    <table class="ti-table">
      <tr>
        <td class="logo-cell" rowspan="4"><div class="mini-logo"><img src="${COMPANY_LOGO_DATA_URI}" alt="Logo Gema Teknik" style="max-width:66px;max-height:36px;object-fit:contain;" /></div></td>
        <td><b>TECHNICAL INFORMATION</b></td>
        <td><b>No Doc</b></td>
        <td><b>Drawing Refrence : No Drawing</b></td>
      </tr>
      <tr>
        <td>End User : ${escapeHtml(endUser)}</td>
        <td>${escapeHtml(noDoc)}</td>
        <td>Create By : ${escapeHtml(createBy)}</td>
      </tr>
      <tr>
        <td>Contract Partner : ${escapeHtml(contractPartner)}</td>
        <td>Location : ${escapeHtml(location)}</td>
        <td>Date : ${escapeHtml(date)}</td>
      </tr>
      <tr>
        <td>Project Name : ${escapeHtml(projectName)}</td>
        <td>Country : ${escapeHtml(country)} &nbsp; | &nbsp; Segment : ${escapeHtml(segment)}</td>
        <td>Rev : ${escapeHtml(rev)}</td>
      </tr>
    </table>
  `;
}

function quotationBomHtml(payload: Record<string, unknown>, opts?: { excel?: boolean }): string {
  const detailed = asRecords(payload.bomDetailed);
  const summary = asRecords(payload.bomSummary);

  const detailedRows = detailed
    .map((row, idx) => {
      const no = toNum(row.no) || idx + 1;
      return `
        <tr>
          <td>${no}</td>
          <td>${escapeHtml(toText(row.area, "-"))}</td>
          <td>${escapeHtml(toText(row.product, "-"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.kgM3, "0"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.thickness, "0"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.surface, "0"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.volume, "0"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.weightInstalled, "0"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.quantityInstalled, "0"))}</td>
          <td>${escapeHtml(toText(row.unit, "-"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.reversePercent, "0"))}</td>
          <td>${escapeHtml(toText(row.unitSize, "-"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.quantityDelivery, "0"))}</td>
          <td>${escapeHtml(toText(row.unit, "-"))}</td>
        </tr>
      `;
    })
    .join("");

  const summaryRows = summary
    .map((row, idx) => {
      const no = toNum(row.no) || idx + 1;
      return `
        <tr>
          <td>${no}</td>
          <td>${escapeHtml(toText(row.product, "-"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.density, "0"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.volume, "0"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.quantityInstalled, "0"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.quantityDelivered, "0"))}</td>
          <td>${escapeHtml(toText(row.unit, "-"))}</td>
          <td style="text-align:right;">${escapeHtml(toText(row.totalWeight, "0"))}</td>
        </tr>
      `;
    })
    .join("");

  const totalInstalled = summary.reduce((acc, row) => acc + toNum(row.quantityInstalled), 0);
  const totalDelivered = summary.reduce((acc, row) => acc + toNum(row.quantityDelivered), 0);
  const totalWeight = summary.reduce((acc, row) => acc + toNum(row.totalWeight), 0);

  return `
    <style>
      .bom-page { font-family: Arial, sans-serif; font-size: ${opts?.excel ? "11px" : "10.5px"}; color:#111; }
      .bom-title { text-align:center; font-size:38px; font-weight:700; margin:6px 0 0; }
      .bom-subtitle { text-align:center; font-size:34px; font-weight:700; margin:0 0 8px; }
      .bom-head { border:1px solid #111; border-collapse:collapse; width:100%; margin-bottom:8px; }
      .bom-head th, .bom-head td { border:1px solid #111; padding:4px; }
      .ti-table { border:1px solid #111; border-collapse:collapse; width:100%; margin-bottom:10px; }
      .ti-table td { border:1px solid #111; padding:4px 6px; }
      .logo-cell { width:90px; text-align:center; }
      .mini-logo { width:72px; height:42px; border:1px solid #111; margin:auto; display:flex; align-items:center; justify-content:center; font-weight:900; background:#fff; }
      .bom-table { border-collapse:collapse; width:100%; border:1px solid #111; }
      .bom-table th, .bom-table td { border:1px solid #111; padding:3px 4px; }
      .bom-table th { background:#f4f4f4; }
      .bom-table .blue-head th { background:#1e5fdb; color:#fff; font-weight:700; }
      .section-gap { height:24px; }
      .totals-row td { font-weight:700; background:#f5f5f5; }
      .page-break { page-break-before: always; margin-top: 16px; }
    </style>

    <div class="bom-page">
      <table class="bom-head">
        <tr><th colspan="14" class="bom-title">BILL OF MATERIAL</th></tr>
        <tr><th colspan="14" class="bom-subtitle">Detailed BOM</th></tr>
      </table>
      ${technicalInfoHtml(payload)}
      <table class="bom-table">
        <thead>
          <tr class="blue-head">
            <th>No</th>
            <th>AREA</th>
            <th>PRODUCT</th>
            <th>Kg/m3</th>
            <th>Thikness</th>
            <th>Surface</th>
            <th>Volume</th>
            <th>Wight (Installed)</th>
            <th>Quantity (Installed)</th>
            <th>Unit</th>
            <th>Reverse (%)</th>
            <th>Unit Size</th>
            <th>Quantity (Delivery)</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          ${detailedRows || `<tr><td colspan="14" style="text-align:center;">-</td></tr>`}
        </tbody>
      </table>

      <div class="${opts?.excel ? "section-gap" : "page-break"}"></div>

      <table class="bom-head">
        <tr><th colspan="8" class="bom-title">BILL OF MATERIAL</th></tr>
        <tr><th colspan="8" class="bom-subtitle">Summary BOM</th></tr>
      </table>
      ${technicalInfoHtml(payload)}
      <table class="bom-table">
        <thead>
          <tr style="background:#f59e0b;color:#111;font-weight:700;">
            <th>NO</th>
            <th>PRODUCT</th>
            <th>Density Kg/m3</th>
            <th>Volume m3</th>
            <th>Quantity Installed</th>
            <th>Quantity Delivered</th>
            <th>Unit</th>
            <th>Total Wight Delivered</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows || `<tr><td colspan="8" style="text-align:center;">-</td></tr>`}
          <tr class="totals-row">
            <td colspan="4" style="text-align:right;">Totals</td>
            <td style="text-align:right;">${totalInstalled.toLocaleString("id-ID")}</td>
            <td style="text-align:right;">${totalDelivered.toLocaleString("id-ID")}</td>
            <td></td>
            <td style="text-align:right;">${totalWeight.toLocaleString("id-ID")}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function invoiceExportHtml(payload: Record<string, unknown>): string {
  const items = asRecords(payload.items);
  const signer = payload.createdBy || payload.approvedBy;
  const meta = keyValueTableHtml("Informasi Invoice", [
    { label: "ID", key: "id", value: payload.id },
    { label: "No Invoice", key: "noInvoice", value: payload.noInvoice },
    { label: "Tanggal", key: "tanggal", value: payload.tanggal },
    { label: "Jatuh Tempo", key: "jatuhTempo", value: payload.jatuhTempo },
    { label: "Customer", key: "customer", value: payload.customer },
    { label: "Alamat", key: "alamat", value: payload.alamat },
    { label: "No PO", key: "noPO", value: payload.noPO },
    { label: "Status", key: "status", value: payload.status },
    { label: "Subtotal", key: "subtotal", value: payload.subtotal },
    { label: "PPN", key: "ppn", value: payload.ppn },
    { label: "Total Bayar", key: "totalBayar", value: payload.totalBayar },
  ]);
  const itemsTable = listTable("Rincian Item", items, ["deskripsi", "qty", "unit", "hargaSatuan", "jumlah"]);
  return `${companyLetterheadHtml("Invoice")} ${meta} ${itemsTable} ${companyFooterHtml(signer)}`;
}

function suratJalanExportHtml(payload: Record<string, unknown>): string {
  const items = asRecords(payload.items);
  const signer = payload.pengirim || payload.createdBy;
  const meta = keyValueTableHtml("Informasi Surat Jalan", [
    { label: "ID", key: "id", value: payload.id },
    { label: "No Surat Jalan", key: "noSuratJalan", value: payload.noSuratJalan || payload.nomor },
    { label: "Tanggal", key: "tanggal", value: payload.tanggal },
    { label: "Tujuan", key: "tujuan", value: payload.tujuan || payload.customer },
    { label: "Alamat Tujuan", key: "alamatTujuan", value: payload.alamatTujuan || payload.alamat },
    { label: "Pengirim", key: "pengirim", value: payload.pengirim },
    { label: "Penerima", key: "penerima", value: payload.penerima },
    { label: "Keterangan", key: "keterangan", value: payload.keterangan },
    { label: "Status", key: "status", value: payload.status },
  ]);
  const itemsTable = listTable("Rincian Barang / Pekerjaan", items, ["namaBarang", "qty", "unit", "keterangan"]);
  return `${companyLetterheadHtml("Surat Jalan")} ${meta} ${itemsTable} ${companyFooterHtml(signer)}`;
}

function beritaAcaraExportHtml(payload: Record<string, unknown>): string {
  const signer = payload.pihakPertama || payload.createdBy || payload.approvedBy;
  const pekerjaan = asRecords(payload.pekerjaanList || payload.items);
  const meta = keyValueTableHtml("Informasi Berita Acara", [
    { label: "ID", key: "id", value: payload.id },
    { label: "No Berita Acara", key: "noBeritaAcara", value: payload.noBeritaAcara || payload.nomor },
    { label: "Tanggal", key: "tanggal", value: payload.tanggal },
    { label: "Judul", key: "judul", value: payload.judul || payload.perihal },
    { label: "Pihak Pertama", key: "pihakPertama", value: payload.pihakPertama },
    { label: "Pihak Kedua", key: "pihakKedua", value: payload.pihakKedua },
    { label: "Lokasi", key: "lokasi", value: payload.lokasi },
    { label: "Keterangan", key: "keterangan", value: payload.keterangan || payload.catatan },
    { label: "Status", key: "status", value: payload.status },
  ]);
  const pekerjaanTable = listTable("Rincian Pekerjaan", pekerjaan, ["deskripsi", "qty", "unit", "keterangan"]);
  return `${companyLetterheadHtml("Berita Acara")} ${meta} ${pekerjaanTable} ${companyFooterHtml(signer)}`;
}

function purchaseOrderExportHtml(payload: Record<string, unknown>): string {
  const items = asRecords(payload.items);
  const signer = payload.signatoryName || payload.createdBy || payload.approvedBy;
  const meta = keyValueTableHtml("Informasi Purchase Order", [
    { label: "ID", key: "id", value: payload.id },
    { label: "No PO", key: "noPO", value: payload.noPO },
    { label: "Tanggal", key: "tanggal", value: payload.tanggal },
    { label: "Supplier", key: "supplier", value: payload.supplier },
    { label: "Project", key: "projectName", value: payload.projectName || payload.projectId },
    { label: "Status", key: "status", value: payload.status },
    { label: "Subtotal", key: "subtotal", value: payload.subtotal || payload.total },
    { label: "PPN (%)", key: "ppn", value: payload.ppn },
    { label: "Total", key: "total", value: payload.total },
    { label: "Catatan", key: "notes", value: payload.notes },
  ]);
  const itemsTable = listTable("Rincian Item PO", items, [
    "kode",
    "nama",
    "qty",
    "unit",
    "harga",
    "total",
    "qtyReceived",
  ]);
  return `${companyLetterheadHtml("Purchase Order")} ${meta} ${itemsTable} ${companyFooterHtml(signer)}`;
}

function stockOutExportHtml(payload: Record<string, unknown>): string {
  const items = asRecords(payload.items);
  const signer = payload.createdBy || payload.penerima;
  const meta = keyValueTableHtml("Informasi Stock Out", [
    { label: "ID", key: "id", value: payload.id },
    { label: "No Stock Out", key: "noStockOut", value: payload.noStockOut },
    { label: "Tanggal", key: "tanggal", value: payload.tanggal },
    { label: "Work Order / Project Ref", key: "noWorkOrder", value: payload.noWorkOrder || payload.projectId },
    { label: "Penerima", key: "penerima", value: payload.penerima },
    { label: "Tipe", key: "type", value: payload.type },
    { label: "Status", key: "status", value: payload.status },
    { label: "Catatan", key: "notes", value: payload.notes },
  ]);
  const itemsTable = listTable("Rincian Material Keluar", items, ["kode", "nama", "qty", "unit", "batchNo"]);
  return `${companyLetterheadHtml("Stock Out / Surat Jalan Internal")} ${meta} ${itemsTable} ${companyFooterHtml(signer)}`;
}

function spkRecordExportHtml(payload: Record<string, unknown>): string {
  const teknisi = Array.isArray(payload.teknisi)
    ? payload.teknisi.map((t) => String(t ?? "").trim()).filter(Boolean).join(", ")
    : String(payload.teknisi || "").trim();
  const signer = payload.createdBy || payload.updatedBy || "Workshop Supervisor";
  const meta = keyValueTableHtml("Informasi SPK", [
    { label: "ID", key: "id", value: payload.id },
    { label: "No SPK", key: "noSPK", value: payload.noSPK },
    { label: "Tanggal", key: "tanggal", value: payload.tanggal },
    { label: "Project", key: "projectName", value: payload.projectName || payload.projectId },
    { label: "Pekerjaan", key: "pekerjaan", value: payload.pekerjaan },
    { label: "Teknisi", key: "teknisi", value: teknisi || "-" },
    { label: "Status", key: "status", value: payload.status },
    { label: "Prioritas", key: "urgent", value: payload.urgent ? "Urgent" : "Normal" },
  ]);
  return `${companyLetterheadHtml("Surat Perintah Kerja (SPK)")} ${meta} ${companyFooterHtml(signer)}`;
}

function workOrderSpkExportHtml(payload: Record<string, unknown>): string {
  const signer = payload.createdBy || payload.updatedBy || "Workshop Supervisor";
  const meta = keyValueTableHtml("Informasi SPK dari Work Order", [
    { label: "ID Work Order", key: "id", value: payload.id },
    { label: "No SPK", key: "noSPK", value: payload.noSPK || payload.woNumber },
    { label: "No Work Order", key: "woNumber", value: payload.woNumber },
    { label: "Tanggal Mulai", key: "startDate", value: payload.startDate },
    { label: "Deadline", key: "deadline", value: payload.deadline },
    { label: "Project Ref", key: "projectRef", value: payload.projectRef || payload.projectId },
    { label: "Item / Pekerjaan", key: "itemToProduce", value: payload.itemToProduce },
    { label: "Teknisi Utama", key: "leadTechnician", value: payload.leadTechnician },
    { label: "Prioritas", key: "priority", value: payload.priority },
    { label: "Status", key: "status", value: payload.status },
    { label: "Target Qty", key: "targetQty", value: payload.targetQty },
    { label: "Completed Qty", key: "completedQty", value: payload.completedQty },
  ]);
  return `${companyLetterheadHtml("Surat Perintah Kerja (SPK)")} ${meta} ${companyFooterHtml(signer)}`;
}

function productionReportExportHtml(payload: Record<string, unknown>): string {
  const signer = payload.createdBy || payload.updatedBy || "Production Supervisor";
  const meta = keyValueTableHtml("Informasi Laporan Harian Produksi", [
    { label: "ID", key: "id", value: payload.id },
    { label: "Tanggal", key: "tanggal", value: payload.tanggal },
    { label: "Shift", key: "shift", value: payload.shift },
    { label: "Workshop", key: "workshop", value: payload.workshop },
    { label: "WO Ref", key: "woId", value: payload.woId || payload.workOrderId },
    { label: "Jenis Pekerjaan", key: "jenisPekerjaan", value: payload.jenisPekerjaan },
    { label: "Output", key: "output", value: payload.output },
    { label: "Unit", key: "unit", value: payload.unit },
    { label: "Efficiency", key: "efficiency", value: payload.efficiency },
    { label: "Down Time", key: "downTime", value: payload.downTime },
    { label: "Status", key: "status", value: payload.status },
    { label: "Operator", key: "operator", value: payload.operator },
    { label: "Mulai", key: "startTime", value: payload.startTime },
    { label: "Selesai", key: "endTime", value: payload.endTime },
  ]);
  return `${companyLetterheadHtml("Laporan Harian Produksi (LHP)")} ${meta} ${companyFooterHtml(signer)}`;
}

function fieldProjectReportExportHtml(payload: Record<string, unknown>): string {
  const attendance = asRecords(payload.attendanceRows);
  const kasbon = asRecords(payload.kasbonRows);
  const equipment = asRecords(payload.equipmentRows);
  const materials = asRecords(payload.materialRows);
  const signer = payload.generatedBy || payload.createdBy || "System";
  const meta = keyValueTableHtml("Informasi Weekly Field Report", [
    { label: "Project", key: "projectName", value: payload.projectName },
    { label: "Period Start", key: "startDate", value: payload.startDate },
    { label: "Generated By", key: "generatedBy", value: payload.generatedBy },
    { label: "Generated At", key: "generatedAt", value: payload.generatedAt },
  ]);
  return `
    ${companyLetterheadHtml("Weekly Field Project Report")}
    ${meta}
    ${listTable("Attendance", attendance, ["date", "employeeId", "employeeName", "position", "inTime", "outTime"])}
    ${listTable("Kasbon", kasbon, ["date", "employeeName", "amount", "status"])}
    ${listTable("Equipment Usage", equipment, ["date", "equipmentName", "hoursUsed", "operatorName", "costPerHour", "totalCost"])}
    ${listTable("Material Requests", materials, ["date", "itemName", "qty", "unit", "status", "estimatedCost"])}
    ${companyFooterHtml(signer)}
  `;
}

function vendorPaymentReportExportHtml(payload: Record<string, unknown>): string {
  const expenses = asRecords(payload.expenses);
  const vendors = asRecords(payload.vendors);
  const projects = asRecords(payload.projects);
  const generatedBy = payload.generatedBy || "System";
  const generatedAt = payload.generatedAt || new Date().toISOString();
  const totalNominal = expenses.reduce((sum, e) => sum + toNum(e.nominal), 0);
  const totalPpn = expenses.reduce((sum, e) => sum + toNum(e.ppn), 0);
  const totalAll = totalNominal + totalPpn;

  const normalizedExpenses = expenses.map((e) => ({
    ...e,
    totalWithTax: toNum(e.nominal) + toNum(e.ppn),
  }));

  return `
    ${companyLetterheadHtml("Vendor Payment & Expense Report")}
    ${keyValueTableHtml("Ringkasan", [
      { label: "Generated By", key: "generatedBy", value: generatedBy },
      { label: "Generated At", key: "generatedAt", value: generatedAt },
      { label: "Total Expense", key: "totalNominal", value: totalNominal },
      { label: "Total PPN", key: "totalPpn", value: totalPpn },
      { label: "Grand Total", key: "totalAll", value: totalAll },
      { label: "Jumlah Vendor", key: "vendorsCount", value: vendors.length },
      { label: "Jumlah Project", key: "projectsCount", value: projects.length },
    ])}
    ${listTable("Daftar Expense", normalizedExpenses, [
      "tanggal",
      "noExpense",
      "vendorName",
      "projectName",
      "kategori",
      "keterangan",
      "nominal",
      "ppn",
      "totalWithTax",
      "status",
    ])}
    ${listTable("Daftar Vendor", vendors, ["kodeVendor", "namaVendor", "kategori", "paymentTerms", "status"])}
    ${listTable("Daftar Project", projects, ["kodeProject", "namaProject", "customer", "status"])}
    ${companyFooterHtml(generatedBy)}
  `;
}

function payrollReportExportHtml(payload: Record<string, unknown>): string {
  const rows = asRecords(payload.rows);
  const summary = asRecord(payload.summary);
  const generatedBy = payload.generatedBy || "System";
  const generatedAt = payload.generatedAt || new Date().toISOString();
  const periodLabel = payload.periodLabel || payload.period || "-";

  const normalizedRows = rows.map((row) => ({
    name: toText(row.name || row.employeeName, "-"),
    position: toText(row.position, "-"),
    employmentType: toText(row.employmentType, "-"),
    attendanceCount: toNum(row.attendanceCount),
    totalHours: toNum(row.totalHours),
    totalOvertime: toNum(row.totalOvertime),
    salary: toNum(row.salary),
    allowanceAndOvertime: toNum(row.allowanceAndOvertime || toNum(row.overtimePay) + toNum(row.mealAllowance)),
    totalKasbon: toNum(row.totalKasbon),
    netSalary: toNum(row.netSalary),
  }));

  const totalNetPayroll = toNum(summary.totalNetPayroll || payload.totalNetPayroll);
  const totalManHours = toNum(summary.totalManHours || payload.totalManHours);
  const totalOvertime = toNum(summary.totalOvertime || payload.totalOvertime);
  const totalKasbon = toNum(summary.totalKasbon || payload.totalKasbon);
  const employeeCount = toNum(summary.employeeCount || payload.employeeCount || normalizedRows.length);
  const avgNetSalary = employeeCount > 0 ? totalNetPayroll / employeeCount : 0;

  return `
    ${companyLetterheadHtml("Payroll Recap Report")}
    ${keyValueTableHtml("Ringkasan Payroll", [
      { label: "Periode Payroll", key: "periodLabel", value: periodLabel },
      { label: "Generated By", key: "generatedBy", value: generatedBy },
      { label: "Generated At", key: "generatedAt", value: generatedAt },
      { label: "Jumlah Karyawan", key: "employeeCount", value: employeeCount },
      { label: "Total Net Payroll", key: "totalNetPayroll", value: totalNetPayroll },
      { label: "Total Man Hours", key: "totalManHours", value: totalManHours },
      { label: "Total Lembur", key: "totalOvertime", value: totalOvertime },
      { label: "Total Kasbon", key: "totalKasbon", value: totalKasbon },
      { label: "Rata-rata Gaji Bersih", key: "avgNetSalary", value: avgNetSalary },
    ])}
    ${listTable("Rincian Payroll Karyawan", normalizedRows, [
      "name",
      "position",
      "employmentType",
      "attendanceCount",
      "totalHours",
      "totalOvertime",
      "salary",
      "allowanceAndOvertime",
      "totalKasbon",
      "netSalary",
    ])}
    ${companyFooterHtml(generatedBy)}
  `;
}

function receivableReportExportHtml(payload: Record<string, unknown>): string {
  const rows = asRecords(payload.rows);
  const summary = asRecord(payload.summary);
  const generatedBy = payload.generatedBy || "System";
  const generatedAt = payload.generatedAt || new Date().toISOString();
  const filterStatus = payload.filterStatus || "All";

  const normalizedRows = rows.map((row) => ({
    noInvoice: toText(row.noInvoice, "-"),
    tanggal: row.tanggal,
    jatuhTempo: row.jatuhTempo,
    customer: toText(row.customer, "-"),
    status: toText(row.status, "-"),
    daysLate: toNum(row.daysLate),
    totalBayar: toNum(row.totalBayar),
  }));

  const totalAR = toNum(summary.totalAR || payload.totalAR);
  const totalInvoiced = toNum(summary.totalInvoiced || payload.totalInvoiced);
  const totalPaid = toNum(summary.totalPaid || payload.totalPaid);
  const overdueAmount = toNum(summary.overdueAmount || payload.overdueAmount);
  const overdueCount = toNum(summary.overdueCount || payload.overdueCount);
  const aging0to30 = toNum(summary.aging0to30 || payload.aging0to30);
  const aging31to60 = toNum(summary.aging31to60 || payload.aging31to60);
  const aging61to90 = toNum(summary.aging61to90 || payload.aging61to90);
  const agingOver90 = toNum(summary.agingOver90 || payload.agingOver90);

  return `
    ${companyLetterheadHtml("Accounts Receivable Report")}
    ${keyValueTableHtml("Ringkasan Piutang", [
      { label: "Filter Status", key: "filterStatus", value: filterStatus },
      { label: "Generated By", key: "generatedBy", value: generatedBy },
      { label: "Generated At", key: "generatedAt", value: generatedAt },
      { label: "Total Outstanding", key: "totalAR", value: totalAR },
      { label: "Total Invoiced", key: "totalInvoiced", value: totalInvoiced },
      { label: "Total Paid", key: "totalPaid", value: totalPaid },
      { label: "Overdue Amount", key: "overdueAmount", value: overdueAmount },
      { label: "Overdue Count", key: "overdueCount", value: overdueCount },
      { label: "Aging 0-30", key: "aging0to30", value: aging0to30 },
      { label: "Aging 31-60", key: "aging31to60", value: aging31to60 },
      { label: "Aging 61-90", key: "aging61to90", value: aging61to90 },
      { label: "Aging > 90", key: "agingOver90", value: agingOver90 },
    ])}
    ${listTable("Rincian Invoice Piutang", normalizedRows, [
      "noInvoice",
      "tanggal",
      "jatuhTempo",
      "customer",
      "status",
      "daysLate",
      "totalBayar",
    ])}
    ${companyFooterHtml(generatedBy)}
  `;
}

function payableReportExportHtml(payload: Record<string, unknown>): string {
  const rows = asRecords(payload.rows);
  const summary = asRecord(payload.summary);
  const generatedBy = payload.generatedBy || "System";
  const generatedAt = payload.generatedAt || new Date().toISOString();

  const normalizedRows = rows.map((row) => ({
    supplier: toText(row.supplier, "-"),
    noInvoiceVendor: toText(row.noInvoiceVendor, "-"),
    noPO: toText(row.noPO, "-"),
    projectId: toText(row.projectId, "-"),
    jatuhTempo: row.jatuhTempo,
    totalAmount: toNum(row.totalAmount),
    paidAmount: toNum(row.paidAmount),
    outstandingAmount: toNum(row.outstandingAmount),
    status: toText(row.status, "-"),
  }));

  const totalPayable = toNum(summary.totalPayable || payload.totalPayable);
  const overdue = toNum(summary.overdue || payload.overdue);
  const paidThisMonth = toNum(summary.paidThisMonth || payload.paidThisMonth);
  const invoiceCount = toNum(summary.invoiceCount || payload.invoiceCount || normalizedRows.length);
  const overdueCount = toNum(summary.overdueCount || payload.overdueCount);
  const totalOutstanding = normalizedRows.reduce((sum, row) => sum + toNum(row.outstandingAmount), 0);

  return `
    ${companyLetterheadHtml("Accounts Payable Report")}
    ${keyValueTableHtml("Ringkasan Hutang Vendor", [
      { label: "Generated By", key: "generatedBy", value: generatedBy },
      { label: "Generated At", key: "generatedAt", value: generatedAt },
      { label: "Jumlah Invoice", key: "invoiceCount", value: invoiceCount },
      { label: "Total Payable", key: "totalPayable", value: totalPayable },
      { label: "Outstanding Total", key: "totalOutstanding", value: totalOutstanding },
      { label: "Overdue Amount", key: "overdue", value: overdue },
      { label: "Overdue Count", key: "overdueCount", value: overdueCount },
      { label: "Paid This Month", key: "paidThisMonth", value: paidThisMonth },
    ])}
    ${listTable("Rincian Invoice Vendor", normalizedRows, [
      "supplier",
      "noInvoiceVendor",
      "noPO",
      "projectId",
      "jatuhTempo",
      "totalAmount",
      "paidAmount",
      "outstandingAmount",
      "status",
    ])}
    ${companyFooterHtml(generatedBy)}
  `;
}

function generalLedgerReportExportHtml(payload: Record<string, unknown>): string {
  const rows = asRecords(payload.rows);
  const summary = asRecord(payload.summary);
  const generatedBy = payload.generatedBy || "System";
  const generatedAt = payload.generatedAt || new Date().toISOString();
  const view = toText(payload.view, "overview").toUpperCase();

  const normalizedRows = rows.map((row) => ({
    date: row.date,
    reference: toText(row.reference, "-"),
    description: toText(row.description, "-"),
    category: toText(row.category, "-"),
    debit: toNum(row.debit),
    credit: toNum(row.credit),
    balance: toNum(row.balance),
  }));

  const totalIncome = toNum(summary.income || payload.totalIncome);
  const totalExpense = toNum(summary.expense || payload.totalExpense);
  const net = toNum(summary.net || payload.net);
  const health = toNum(summary.health || payload.health);
  const receivable = toNum(summary.receivable || payload.receivable);
  const payable = toNum(summary.payable || payload.payable);

  return `
    ${companyLetterheadHtml("General Ledger Report")}
    ${keyValueTableHtml("Ringkasan General Ledger", [
      { label: "View Ledger", key: "view", value: view },
      { label: "Generated By", key: "generatedBy", value: generatedBy },
      { label: "Generated At", key: "generatedAt", value: generatedAt },
      { label: "Jumlah Journal Entries", key: "entryCount", value: normalizedRows.length },
      { label: "Total Income", key: "totalIncome", value: totalIncome },
      { label: "Total Expense", key: "totalExpense", value: totalExpense },
      { label: "Net Position", key: "net", value: net },
      { label: "Financial Health", key: "health", value: health },
      { label: "Total Receivable", key: "receivable", value: receivable },
      { label: "Total Payable", key: "payable", value: payable },
    ])}
    ${listTable("Rincian Journal Entries", normalizedRows, [
      "date",
      "reference",
      "description",
      "category",
      "debit",
      "credit",
      "balance",
    ])}
    <p><b>Catatan:</b> Laporan buku besar umum ini digunakan untuk monitoring arus transaksi, validasi posisi keuangan, dan kebutuhan audit internal manajemen.</p>
    ${companyFooterHtml(generatedBy)}
  `;
}

function bankReconciliationReportExportHtml(payload: Record<string, unknown>): string {
  const rows = asRecords(payload.rows);
  const summary = asRecord(payload.summary);
  const generatedBy = payload.generatedBy || "System";
  const generatedAt = payload.generatedAt || new Date().toISOString();
  const periodLabel = toText(payload.periodLabel, "-");
  const viewLabel = toText(payload.viewLabel, "Semua transaksi");

  const normalizedRows = rows.map((row) => ({
    id: toText(row.id, "-"),
    date: row.date,
    account: toText(row.account, "-"),
    description: toText(row.description, "-"),
    debit: toNum(row.debit),
    credit: toNum(row.credit),
    balance: toNum(row.balance),
    status: toText(row.status, "-"),
  }));

  const totalDebit = toNum(summary.totalDebit || payload.totalDebit);
  const totalCredit = toNum(summary.totalCredit || payload.totalCredit);
  const finalBalance = toNum(summary.finalBalance || payload.finalBalance);
  const matchRate = toNum(summary.matchRate || payload.matchRate);
  const transactionCount = toNum(summary.transactionCount || payload.transactionCount || normalizedRows.length);

  return `
    ${companyLetterheadHtml("Bank Reconciliation Statement")}
    ${keyValueTableHtml("Ringkasan Rekonsiliasi Bank", [
      { label: "Periode Rekonsiliasi", key: "periodLabel", value: periodLabel },
      { label: "View Rekonsiliasi", key: "viewLabel", value: viewLabel },
      { label: "Generated By", key: "generatedBy", value: generatedBy },
      { label: "Generated At", key: "generatedAt", value: generatedAt },
      { label: "Jumlah Transaksi", key: "transactionCount", value: transactionCount },
      { label: "Total Debit", key: "totalDebit", value: totalDebit },
      { label: "Total Credit", key: "totalCredit", value: totalCredit },
      { label: "Net Movement", key: "finalBalance", value: finalBalance },
      { label: "Match Rate", key: "matchRate", value: matchRate },
    ])}
    ${listTable("Rincian Transaksi Rekonsiliasi", normalizedRows, [
      "id",
      "date",
      "account",
      "description",
      "debit",
      "credit",
      "balance",
      "status",
    ])}
    <p><b>Catatan:</b> Laporan ini digunakan untuk memastikan mutasi rekening koran bank selaras dengan pencatatan invoice customer, invoice vendor, dan buku kas internal.</p>
    ${companyFooterHtml(generatedBy)}
  `;
}

function executiveAuditExportHtml(payload: Record<string, unknown>): string {
  const type = toText(payload.type, "Executive Audit");
  const generatedAt = payload.generatedAt || new Date().toISOString();
  const generatedBy = payload.generatedBy || "System";
  const finStats = asRecord(payload.finStats);
  const opsStats = asRecord(payload.opsStats);
  const rows: Array<{ label: string; key: string; value: unknown }> = [
    { label: "Type", key: "type", value: type },
    { label: "Generated At", key: "generatedAt", value: generatedAt },
    { label: "Generated By", key: "generatedBy", value: generatedBy },
    { label: "Aggregate Revenue", key: "totalRevenue", value: finStats.totalRevenue },
    { label: "Accounts Receivable (AR)", key: "totalReceivable", value: finStats.totalReceivable },
    { label: "Inventory Capital", key: "inventoryValue", value: finStats.inventoryValue },
    { label: "Net Cash Position", key: "netPosition", value: finStats.netPosition },
    { label: "Manufacturing Output Efficiency (%)", key: "efficiency", value: opsStats.efficiency },
    { label: "Work Orders Total", key: "totalWO", value: opsStats.totalWO },
    { label: "Work Orders Completed", key: "completedWO", value: opsStats.completedWO },
    { label: "Work Orders In Progress", key: "inProgressWO", value: opsStats.inProgressWO },
    { label: "Work Orders Overdue", key: "overdueWO", value: opsStats.overdueWO },
  ];

  return `
    ${companyLetterheadHtml("Executive Audit Report")}
    ${keyValueTableHtml("Executive Summary", rows)}
    <h3>Catatan</h3>
    <p>Laporan ini disusun otomatis dari dashboard konsolidasi untuk kebutuhan audit internal manajemen.</p>
    ${companyFooterHtml(generatedBy)}
  `;
}

function purchaseOrderSuratJalanExportHtml(payload: Record<string, unknown>): string {
  const items = asRecords(payload.items);
  const signer = payload.signatoryName || payload.createdBy || "Management";
  const noPO = toText(payload.noPO, "-");
  const noSj = `SJ/${new Date().getFullYear()}/${noPO.split("/").pop() || "001"}`;
  const meta = keyValueTableHtml("Informasi Surat Jalan (Referensi PO)", [
    { label: "No SJ", key: "noSj", value: noSj },
    { label: "No PO Referensi", key: "noPO", value: payload.noPO },
    { label: "Tanggal", key: "tanggal", value: new Date().toISOString() },
    { label: "Supplier", key: "supplier", value: payload.supplier },
    { label: "Project", key: "projectName", value: payload.projectName || payload.projectId },
    { label: "Attention", key: "attention", value: payload.attention },
    { label: "Status PO", key: "status", value: payload.status },
  ]);
  const itemsTable = listTable("Rincian Barang", items, ["nama", "qty", "unit", "keterangan"]);
  return `${companyLetterheadHtml("Surat Jalan")} ${meta} ${itemsTable} ${companyFooterHtml(signer)}`;
}

function workingExpenseSheetExportHtml(payload: Record<string, unknown>): string {
  const signer = payload.createdBy || payload.updatedBy || payload.approvedBy || "Finance";
  const items = asRecords(payload.items);
  const totalKas = items.reduce((sum, item) => sum + toNum(item.nominal), 0);
  const meta = keyValueTableHtml("Informasi Working Expense Sheet", [
    { label: "ID", key: "id", value: payload.id },
    { label: "No Hal", key: "noHal", value: payload.noHal },
    { label: "Client", key: "client", value: payload.client },
    { label: "Project", key: "project", value: payload.project },
    { label: "Location", key: "location", value: payload.location },
    { label: "Date", key: "date", value: payload.date },
    { label: "Revisi", key: "revisi", value: payload.revisi },
    { label: "Status", key: "status", value: payload.status },
    { label: "Total Kas", key: "totalKas", value: payload.totalKas || totalKas },
  ]);
  const itemsTable = listTable("Rincian Biaya", items, ["date", "description", "nominal", "hasNota", "remark"]);
  return `${companyLetterheadHtml("Working Expense Sheet")} ${meta} ${itemsTable} ${companyFooterHtml(signer)}`;
}

function workingExpenseLedgerExportHtml(payload: Record<string, unknown>): string {
  const sheets = asRecords(payload.items);
  const total = sheets.reduce((sum, item) => sum + toNum(item.totalKas), 0);
  const meta = keyValueTableHtml("Informasi Working Expense Ledger", [
    { label: "Generated At", key: "generatedAt", value: payload.generatedAt || new Date().toISOString() },
    { label: "Generated By", key: "generatedBy", value: payload.generatedBy || "System" },
    { label: "Total Sheets", key: "totalSheets", value: sheets.length },
    { label: "Total Kas", key: "totalKas", value: total },
  ]);
  const table = listTable("Daftar Working Expense", sheets, ["id", "noHal", "date", "client", "project", "location", "status", "totalKas"]);
  return `${companyLetterheadHtml("Working Expense Ledger")} ${meta} ${table} ${companyFooterHtml(payload.generatedBy || "System")}`;
}

function ppnLedgerExportHtml(payload: Record<string, unknown>): string {
  const rows = asRecords(payload.items);
  const totalDpp = rows.reduce((sum, row) => sum + toNum(row.dpp), 0);
  const totalPpn = rows.reduce((sum, row) => sum + toNum(row.ppn), 0);
  const meta = keyValueTableHtml("Informasi PPN Ledger", [
    { label: "Generated At", key: "generatedAt", value: payload.generatedAt || new Date().toISOString() },
    { label: "Generated By", key: "generatedBy", value: payload.generatedBy || "System" },
    { label: "Tab", key: "tab", value: payload.tab || "all" },
    { label: "Total Rows", key: "totalRows", value: rows.length },
    { label: "Total DPP", key: "totalDpp", value: totalDpp },
    { label: "Total PPN", key: "totalPpn", value: totalPpn },
  ]);
  const table = listTable("Rincian PPN", rows, ["tanggal", "nomor", "noFaktur", "pihak", "tipe", "dpp", "ppn", "status"]);
  return `${companyLetterheadHtml("PPN Ledger")} ${meta} ${table} ${companyFooterHtml(payload.generatedBy || "System")}`;
}

function sendWord(res: Response, filename: string, bodyHtml: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:16mm}body{font-family:Cambria,Arial,sans-serif;font-size:12px;line-height:1.5;color:#111}.doc-page{width:100%}h1{font-size:20px;margin:0 0 10px;font-weight:700}h2{font-size:16px;margin:14px 0 8px;font-weight:700}h3{font-size:14px;margin:10px 0 6px;font-weight:700}table{margin-bottom:14px;border-collapse:collapse}th,td{vertical-align:top}th{background:#f3f4f6}p{margin:4px 0}ul{margin:4px 0 8px 18px;padding:0}li{margin:2px 0}</style></head><body><div class="doc-page">${bodyHtml}</div></body></html>`;
  res.setHeader("Content-Type", "application/msword; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}.doc\"`);
  return res.send(html);
}

function sendExcel(res: Response, filename: string, bodyHtml: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:11px;color:#111}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:4px 6px;vertical-align:top}th{background:#e5e7eb;text-align:left}.section{background:#f9fafb;font-weight:700}</style></head><body>${bodyHtml}</body></html>`;
  res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}.xls\"`);
  return res.send(html);
}

function sendPreview(res: Response, bodyHtml: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Cambria,Arial,sans-serif;font-size:12px;line-height:1.45;color:#111;background:#f5f6f8;margin:0;padding:16px}.preview{max-width:920px;margin:0 auto;background:#fff;border:1px solid #ddd;padding:20px}h1{font-size:20px;margin:0 0 10px}h2{font-size:16px;margin:14px 0 8px}h3{font-size:14px;margin:10px 0 6px}table{margin-bottom:14px}th{background:#f3f4f6}p{margin:4px 0}</style></head><body><div class="preview">${bodyHtml}</div></body></html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(html);
}

exportsRouter.get("/exports/data-collections/:id/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getDataCollectionPayload(req.params.id);
  if (!payload) return res.status(404).json({ error: "Data collection not found" });
  const tkJakon = resolveTkJakonPayload(payload);
  if (tkJakon.rows.length > 0) {
    return sendWord(res, `data-collection-${req.params.id}`, tkJakonWordHtml(payload));
  }

  const tools = Array.isArray(payload.tools) ? payload.tools : [];
  const manpower = Array.isArray(payload.manpower) ? payload.manpower : [];
  const schedule = Array.isArray(payload.schedule) ? payload.schedule : [];
  const consumables = Array.isArray(payload.consumables) ? payload.consumables : [];
  const scopeOfWork = Array.isArray(payload.scopeOfWork)
    ? payload.scopeOfWork.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0)
    : [];
  const scopeHtml =
    scopeOfWork.length > 0
      ? `<h3>Scope Of Work</h3><ul>${scopeOfWork.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
      : "";

  const html = `
    ${companyLetterheadHtml("Data Persiapan Pekerjaan Proyek")}
    <p><b>ID:</b> ${escapeHtml(toText(payload.id))}</p>
    <p><b>Nama Proyek:</b> ${escapeHtml(payload.namaProyek)}</p>
    <p><b>Customer:</b> ${escapeHtml(payload.customer)}</p>
    <p><b>Lokasi:</b> ${escapeHtml(payload.lokasi)}</p>
    <p><b>Durasi:</b> ${escapeHtml(payload.durasiProyekHari)} hari</p>
    <p><b>Notes:</b> ${escapeHtml(payload.notes)}</p>
    ${scopeHtml}
    ${listTable("Tools", tools, ["nama", "jenis", "jumlah", "keterangan"])}
    ${listTable("Manpower", manpower, ["jabatan", "jumlah", "sertifikat", "keterangan"])}
    ${listTable("Schedule", schedule, ["deskripsi", "jumlahHari", "keterangan"])}
    ${listTable("Consumables", consumables, ["deskripsi", "unit", "jumlah", "keterangan"])}
    ${companyFooterHtml(payload.createdBy)}
  `;

  return sendWord(res, `data-collection-${req.params.id}`, html);
});

exportsRouter.get("/exports/data-collections/:id/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getDataCollectionPayload(req.params.id);
  if (!payload) return res.status(404).json({ error: "Data collection not found" });
  const tkJakon = resolveTkJakonPayload(payload);
  if (tkJakon.rows.length > 0) {
    return sendExcel(res, `data-collection-${req.params.id}`, tkJakonExcelHtml(payload));
  }

  const html = `
    <table>
      <tr><th colspan="2" class="section">Data Collection ${escapeHtml(toText(payload.id))}</th></tr>
      <tr><th>Field</th><th>Value</th></tr>
      <tr><td>ID</td><td>${escapeHtml(formatCellByKey("id", payload.id))}</td></tr>
      <tr><td>Nama Proyek</td><td>${escapeHtml(formatCellByKey("namaProyek", payload.namaProyek))}</td></tr>
      <tr><td>Customer</td><td>${escapeHtml(formatCellByKey("customer", payload.customer))}</td></tr>
      <tr><td>Lokasi</td><td>${escapeHtml(formatCellByKey("lokasi", payload.lokasi))}</td></tr>
      <tr><td>Durasi (hari)</td><td>${escapeHtml(formatCellByKey("durasiProyekHari", payload.durasiProyekHari))}</td></tr>
      <tr><td>Status</td><td>${escapeHtml(formatCellByKey("status", payload.status))}</td></tr>
    </table>
  `;

  return sendExcel(res, `data-collection-${req.params.id}`, html);
});

exportsRouter.get("/exports/quotations/:id/word", authenticate, async (req: AuthRequest, res: Response) => {
  const isApproved = await isQuotationApproved(req.params.id);
  if (isApproved === null) return res.status(404).json({ error: "Quotation not found" });
  if (!isApproved) {
    return res.status(409).json({
      error: "Export final quotation hanya diizinkan untuk status Approved",
    });
  }

  const payload = await getQuotationPayload(req.params.id);
  if (!payload) return res.status(404).json({ error: "Quotation not found" });
  const style = resolveQuotationDocStyle(req.query?.style);

  const hasBom = asRecords(payload.bomDetailed).length > 0 || asRecords(payload.bomSummary).length > 0;
  const html = hasBom ? quotationBomHtml(payload) : quotationLetterHtml(payload, { style });

  return sendWord(res, `quotation-${req.params.id}`, html);
});

exportsRouter.get("/exports/quotations/:id/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const isApproved = await isQuotationApproved(req.params.id);
  if (isApproved === null) return res.status(404).json({ error: "Quotation not found" });
  if (!isApproved) {
    return res.status(409).json({
      error: "Export final quotation hanya diizinkan untuk status Approved",
    });
  }

  const payload = await getQuotationPayload(req.params.id);
  if (!payload) return res.status(404).json({ error: "Quotation not found" });
  const style = resolveQuotationDocStyle(req.query?.style);

  const hasBom = asRecords(payload.bomDetailed).length > 0 || asRecords(payload.bomSummary).length > 0;
  const html = hasBom ? quotationBomHtml(payload, { excel: true }) : quotationLetterHtml(payload, { excel: true, style });

  return sendExcel(res, `quotation-${req.params.id}`, html);
});

exportsRouter.get("/exports/projects/:id/word", authenticate, async (req: AuthRequest, res: Response) => {
  const isApproved = await isProjectApproved(req.params.id);
  if (isApproved === null) return res.status(404).json({ error: "Project not found" });
  if (!isApproved) {
    return res.status(409).json({
      error: "Export final project hanya diizinkan untuk project dengan approvalStatus Approved",
    });
  }

  const payload = await getProjectPayload(req.params.id);
  if (!payload) return res.status(404).json({ error: "Project not found" });

  const linkedQuotation = await getProjectQuotationContext(payload);
  const rawBoq = Array.isArray(payload.boq) ? payload.boq : [];
  const boq = rawBoq.length > 0
    ? rawBoq
    : projectBoqRowsFromPricingItems(linkedQuotation.data.pricingItems, linkedQuotation.data);
  const milestones = Array.isArray(payload.milestones) ? payload.milestones : [];
  const workOrders = Array.isArray(payload.workOrders) ? payload.workOrders : [];
  const quotationSnapshot = linkedQuotation.data;
  const hasSnapshot = Object.keys(quotationSnapshot).length > 0;
  const snapshotGrandTotal = toNum(quotationSnapshot.grandTotal);
  const { scopeOfWork, exclusions } = pickScopeAndExclusions(quotationSnapshot);
  const snapshotSourceText =
    linkedQuotation.sourceLabel === "snapshot"
      ? "Locked Snapshot"
      : linkedQuotation.sourceLabel === "linked-quotation"
      ? "Linked Quotation (Live)"
      : "-";
  const scopeHtml =
    scopeOfWork.length > 0
      ? `<ul>${scopeOfWork.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "<p>-</p>";
  const exclusionsHtml =
    exclusions.length > 0
      ? `<ul>${exclusions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "<p>-</p>";

  const html = `
    ${companyLetterheadHtml("Project Summary Report")}
    ${keyValueTableHtml("Project Overview", [
      { label: "ID", key: "id", value: payload.id },
      { label: "Kode Project", key: "kodeProject", value: payload.kodeProject },
      { label: "Nama Project", key: "namaProject", value: payload.namaProject },
      { label: "Customer", key: "customer", value: payload.customer },
      { label: "Status", key: "status", value: payload.status },
      { label: "Approval Status", key: "approvalStatus", value: payload.approvalStatus || "Pending" },
      { label: "Approved By", key: "approvedBy", value: payload.approvedBy || "-" },
      { label: "Approved At", key: "approvedAt", value: payload.approvedAt || "-" },
      { label: "Nilai Kontrak", key: "nilaiKontrak", value: toNum(payload.nilaiKontrak) },
    ])}
    ${
      hasSnapshot
        ? `
      ${keyValueTableHtml(`Quotation Reference (${snapshotSourceText})`, [
        { label: "Quotation ID", key: "quotationId", value: quotationSnapshot.id || "-" },
        { label: "No Penawaran", key: "noPenawaran", value: quotationSnapshot.noPenawaran || "-" },
        { label: "Kepada", key: "kepada", value: quotationSnapshot.kepada || "-" },
        { label: "Perihal", key: "perihal", value: quotationSnapshot.perihal || "-" },
        { label: "Grand Total", key: "grandTotal", value: snapshotGrandTotal },
        { label: "Snapshot At", key: "snapshotAt", value: payload.quotationSnapshotAt || "-" },
        { label: "Snapshot By", key: "snapshotBy", value: payload.quotationSnapshotBy || "-" },
      ])}
      <h3>Scope Of Work</h3>
      ${scopeHtml}
      <h3>Exclusions</h3>
      ${exclusionsHtml}
    `
        : ""
    }
    ${projectBoqWordHtml(boq)}
    ${listTable("Milestones", milestones, ["name", "status", "plannedDate", "actualDate"])}
    ${listTable("Work Orders", workOrders, ["woNumber", "itemToProduce", "targetQty", "completedQty", "status"])}
    ${companyFooterHtml(payload.approvedBy || payload.quotationSnapshotBy)}
  `;

  return sendWord(res, `project-${req.params.id}`, html);
});

exportsRouter.get("/exports/projects/:id/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const isApproved = await isProjectApproved(req.params.id);
  if (isApproved === null) return res.status(404).json({ error: "Project not found" });
  if (!isApproved) {
    return res.status(409).json({
      error: "Export final project hanya diizinkan untuk project dengan approvalStatus Approved",
    });
  }

  const payload = await getProjectPayload(req.params.id);
  if (!payload) return res.status(404).json({ error: "Project not found" });

  const linkedQuotation = await getProjectQuotationContext(payload);
  const rawBoq = Array.isArray(payload.boq) ? payload.boq : [];
  const boq = rawBoq.length > 0
    ? rawBoq
    : projectBoqRowsFromPricingItems(linkedQuotation.data.pricingItems, linkedQuotation.data);
  const quotationSnapshot = linkedQuotation.data;
  const hasSnapshot = Object.keys(quotationSnapshot).length > 0;
  const snapshotGrandTotal = toNum(quotationSnapshot.grandTotal);
  const { scopeOfWork, exclusions } = pickScopeAndExclusions(quotationSnapshot);
  const snapshotSourceText =
    linkedQuotation.sourceLabel === "snapshot"
      ? "Locked Snapshot"
      : linkedQuotation.sourceLabel === "linked-quotation"
      ? "Linked Quotation (Live)"
      : "-";
  const boqRows = projectBoqExcelRowsHtml(boq);
  const scopeRows =
    scopeOfWork.length > 0
      ? scopeOfWork.map((item) => `<tr><td colspan="6">- ${escapeHtml(item)}</td></tr>`).join("")
      : `<tr><td colspan="6">-</td></tr>`;
  const exclusionRows =
    exclusions.length > 0
      ? exclusions.map((item) => `<tr><td colspan="6">- ${escapeHtml(item)}</td></tr>`).join("")
      : `<tr><td colspan="6">-</td></tr>`;

  const html = `
    <table>
      <tr>
        <td style="width:90px;vertical-align:top;border:none;">
          <img src="${COMPANY_LOGO_DATA_URI}" alt="Logo Gema Teknik" style="max-width:68px;max-height:52px;object-fit:contain;" />
        </td>
        <td style="border:none;">
          <div style="font-size:18px;font-weight:700;">${escapeHtml(COMPANY_NAME)}</div>
          <div style="font-size:12px;font-weight:700;">${escapeHtml(COMPANY_TAGLINE)}</div>
          <div style="font-size:11px;">${escapeHtml(COMPANY_ADDRESS)}</div>
          <div style="font-size:11px;">${escapeHtml(COMPANY_CONTACT)}</div>
        </td>
      </tr>
    </table>
    <table>
      <tr><th colspan="6" class="section">Project ${escapeHtml(toText(payload.kodeProject || payload.id))}</th></tr>
      <tr><th>Field</th><th colspan="5">Value</th></tr>
      <tr><td>ID</td><td colspan="5">${escapeHtml(formatCellByKey("id", payload.id))}</td></tr>
      <tr><td>Nama Project</td><td colspan="5">${escapeHtml(formatCellByKey("namaProject", payload.namaProject))}</td></tr>
      <tr><td>Customer</td><td colspan="5">${escapeHtml(formatCellByKey("customer", payload.customer))}</td></tr>
      <tr><td>Status</td><td colspan="5">${escapeHtml(formatCellByKey("status", payload.status))}</td></tr>
      <tr><td>Approval Status</td><td colspan="5">${escapeHtml(formatCellByKey("approvalStatus", payload.approvalStatus || "Pending"))}</td></tr>
      <tr><td>Nilai Kontrak</td><td colspan="5">${escapeHtml(formatCellByKey("nilaiKontrak", payload.nilaiKontrak))}</td></tr>
      ${hasSnapshot ? `<tr><td colspan="6" class="section">Quotation Reference (${escapeHtml(snapshotSourceText)})</td></tr>` : ""}
      ${hasSnapshot ? `<tr><td>Quotation ID</td><td colspan="5">${escapeHtml(formatCellByKey("id", quotationSnapshot.id || "-"))}</td></tr>` : ""}
      ${hasSnapshot ? `<tr><td>No Penawaran</td><td colspan="5">${escapeHtml(formatCellByKey("noPenawaran", quotationSnapshot.noPenawaran || "-"))}</td></tr>` : ""}
      ${hasSnapshot ? `<tr><td>Kepada</td><td colspan="5">${escapeHtml(formatCellByKey("kepada", quotationSnapshot.kepada || "-"))}</td></tr>` : ""}
      ${hasSnapshot ? `<tr><td>Perihal</td><td colspan="5">${escapeHtml(formatCellByKey("perihal", quotationSnapshot.perihal || "-"))}</td></tr>` : ""}
      ${hasSnapshot ? `<tr><td>Grand Total</td><td colspan="5">${escapeHtml(formatCellByKey("grandTotal", snapshotGrandTotal))}</td></tr>` : ""}
      ${hasSnapshot ? `<tr><td>Snapshot At</td><td colspan="5">${escapeHtml(formatCellByKey("snapshotAt", payload.quotationSnapshotAt || "-"))}</td></tr>` : ""}
      ${hasSnapshot ? `<tr><td colspan="6" class="section">Scope Of Work</td></tr>${scopeRows}` : ""}
      ${hasSnapshot ? `<tr><td colspan="6" class="section">Exclusions</td></tr>${exclusionRows}` : ""}
      <tr><th>Item Kode</th><th>Material</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total Cost</th></tr>
      ${boqRows}
    </table>
  `;

  return sendExcel(res, `project-${req.params.id}`, html);
});

exportsRouter.get("/exports/invoices/:id/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("invoices", req.params.id);
  if (!payload) return res.status(404).json({ error: "Invoice not found" });
  return sendWord(res, `invoice-${req.params.id}`, invoiceExportHtml(payload));
});

exportsRouter.get("/exports/invoices/:id/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("invoices", req.params.id);
  if (!payload) return res.status(404).json({ error: "Invoice not found" });
  return sendExcel(res, `invoice-${req.params.id}`, invoiceExportHtml(payload));
});

exportsRouter.get("/exports/surat-jalan/:id/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("surat-jalan", req.params.id);
  if (!payload) return res.status(404).json({ error: "Surat jalan not found" });
  return sendWord(res, `surat-jalan-${req.params.id}`, suratJalanExportHtml(payload));
});

exportsRouter.get("/exports/surat-jalan/:id/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("surat-jalan", req.params.id);
  if (!payload) return res.status(404).json({ error: "Surat jalan not found" });
  return sendExcel(res, `surat-jalan-${req.params.id}`, suratJalanExportHtml(payload));
});

exportsRouter.get("/exports/berita-acara/:id/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("berita-acara", req.params.id);
  if (!payload) return res.status(404).json({ error: "Berita acara not found" });
  return sendWord(res, `berita-acara-${req.params.id}`, beritaAcaraExportHtml(payload));
});

exportsRouter.get("/exports/berita-acara/:id/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("berita-acara", req.params.id);
  if (!payload) return res.status(404).json({ error: "Berita acara not found" });
  return sendExcel(res, `berita-acara-${req.params.id}`, beritaAcaraExportHtml(payload));
});

exportsRouter.get("/exports/purchase-orders/:id/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("purchase-orders", req.params.id);
  if (!payload) return res.status(404).json({ error: "Purchase order not found" });
  return sendWord(res, `purchase-order-${req.params.id}`, purchaseOrderExportHtml(payload));
});

exportsRouter.get("/exports/purchase-orders/:id/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("purchase-orders", req.params.id);
  if (!payload) return res.status(404).json({ error: "Purchase order not found" });
  return sendExcel(res, `purchase-order-${req.params.id}`, purchaseOrderExportHtml(payload));
});

exportsRouter.get("/exports/stock-outs/:id/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("stock-outs", req.params.id);
  if (!payload) return res.status(404).json({ error: "Stock out not found" });
  return sendWord(res, `stock-out-${req.params.id}`, stockOutExportHtml(payload));
});

exportsRouter.get("/exports/stock-outs/:id/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("stock-outs", req.params.id);
  if (!payload) return res.status(404).json({ error: "Stock out not found" });
  return sendExcel(res, `stock-out-${req.params.id}`, stockOutExportHtml(payload));
});

exportsRouter.get("/exports/spk-records/:id/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("spk-records", req.params.id);
  if (!payload) return res.status(404).json({ error: "SPK record not found" });
  return sendWord(res, `spk-${req.params.id}`, spkRecordExportHtml(payload));
});

exportsRouter.get("/exports/spk-records/:id/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("spk-records", req.params.id);
  if (!payload) return res.status(404).json({ error: "SPK record not found" });
  return sendExcel(res, `spk-${req.params.id}`, spkRecordExportHtml(payload));
});

exportsRouter.get("/exports/work-orders/:id/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("work-orders", req.params.id);
  if (!payload) return res.status(404).json({ error: "Work order not found" });
  return sendWord(res, `work-order-${req.params.id}`, workOrderSpkExportHtml(payload));
});

exportsRouter.get("/exports/work-orders/:id/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("work-orders", req.params.id);
  if (!payload) return res.status(404).json({ error: "Work order not found" });
  return sendExcel(res, `work-order-${req.params.id}`, workOrderSpkExportHtml(payload));
});

exportsRouter.get("/exports/production-reports/:id/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("production-reports", req.params.id);
  if (!payload) return res.status(404).json({ error: "Production report not found" });
  return sendWord(res, `production-report-${req.params.id}`, productionReportExportHtml(payload));
});

exportsRouter.get("/exports/production-reports/:id/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("production-reports", req.params.id);
  if (!payload) return res.status(404).json({ error: "Production report not found" });
  return sendExcel(res, `production-report-${req.params.id}`, productionReportExportHtml(payload));
});

exportsRouter.post("/exports/field-project-report/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "Invalid field project report payload" });
  }
  const projectName = toText(payload.projectName, "project").replace(/[^\w.-]+/g, "-").toLowerCase();
  const startDate = toText(payload.startDate, new Date().toISOString().slice(0, 10)).replace(/[^\d-]+/g, "");
  return sendWord(res, `weekly-report-${projectName}-${startDate}`, fieldProjectReportExportHtml(payload));
});

exportsRouter.post("/exports/field-project-report/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "Invalid field project report payload" });
  }
  const projectName = toText(payload.projectName, "project").replace(/[^\w.-]+/g, "-").toLowerCase();
  const startDate = toText(payload.startDate, new Date().toISOString().slice(0, 10)).replace(/[^\d-]+/g, "");
  return sendExcel(res, `weekly-report-${projectName}-${startDate}`, fieldProjectReportExportHtml(payload));
});

exportsRouter.post("/exports/vendor-payment-report/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "Invalid vendor payment report payload" });
  }
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendWord(res, `vendor-payment-report-${dateKey}`, vendorPaymentReportExportHtml(payload));
});

exportsRouter.post("/exports/vendor-payment-report/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "Invalid vendor payment report payload" });
  }
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendExcel(res, `vendor-payment-report-${dateKey}`, vendorPaymentReportExportHtml(payload));
});

exportsRouter.post("/exports/payroll-report/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const rows = asRecords(payload.rows);
  if (!rows.length) {
    return res.status(400).json({ error: "Payroll report is empty" });
  }
  const periodSlug = toText(payload.periodLabel, new Date().toISOString().slice(0, 10))
    .replace(/[^\w.-]+/g, "-")
    .toLowerCase();
  return sendWord(res, `payroll-report-${periodSlug}`, payrollReportExportHtml(payload));
});

exportsRouter.post("/exports/payroll-report/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const rows = asRecords(payload.rows);
  if (!rows.length) {
    return res.status(400).json({ error: "Payroll report is empty" });
  }
  const periodSlug = toText(payload.periodLabel, new Date().toISOString().slice(0, 10))
    .replace(/[^\w.-]+/g, "-")
    .toLowerCase();
  return sendExcel(res, `payroll-report-${periodSlug}`, payrollReportExportHtml(payload));
});

exportsRouter.post("/exports/receivable-report/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const rows = asRecords(payload.rows);
  if (!rows.length) {
    return res.status(400).json({ error: "Receivable report is empty" });
  }
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendWord(res, `receivable-report-${dateKey}`, receivableReportExportHtml(payload));
});

exportsRouter.post("/exports/receivable-report/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const rows = asRecords(payload.rows);
  if (!rows.length) {
    return res.status(400).json({ error: "Receivable report is empty" });
  }
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendExcel(res, `receivable-report-${dateKey}`, receivableReportExportHtml(payload));
});

exportsRouter.post("/exports/payable-report/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const rows = asRecords(payload.rows);
  if (!rows.length) {
    return res.status(400).json({ error: "Payable report is empty" });
  }
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendWord(res, `payable-report-${dateKey}`, payableReportExportHtml(payload));
});

exportsRouter.post("/exports/payable-report/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const rows = asRecords(payload.rows);
  if (!rows.length) {
    return res.status(400).json({ error: "Payable report is empty" });
  }
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendExcel(res, `payable-report-${dateKey}`, payableReportExportHtml(payload));
});

exportsRouter.post("/exports/general-ledger-report/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const rows = asRecords(payload.rows);
  if (!rows.length) {
    return res.status(400).json({ error: "General ledger report is empty" });
  }
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendWord(res, `general-ledger-report-${dateKey}`, generalLedgerReportExportHtml(payload));
});

exportsRouter.post("/exports/general-ledger-report/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const rows = asRecords(payload.rows);
  if (!rows.length) {
    return res.status(400).json({ error: "General ledger report is empty" });
  }
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendExcel(res, `general-ledger-report-${dateKey}`, generalLedgerReportExportHtml(payload));
});

exportsRouter.post("/exports/bank-reconciliation-report/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const rows = asRecords(payload.rows);
  if (!rows.length) {
    return res.status(400).json({ error: "Bank reconciliation report is empty" });
  }
  const periodSlug = toText(payload.periodLabel, new Date().toISOString().slice(0, 10))
    .replace(/[^\w.-]+/g, "-")
    .toLowerCase();
  return sendWord(res, `bank-reconciliation-${periodSlug}`, bankReconciliationReportExportHtml(payload));
});

exportsRouter.post("/exports/bank-reconciliation-report/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const rows = asRecords(payload.rows);
  if (!rows.length) {
    return res.status(400).json({ error: "Bank reconciliation report is empty" });
  }
  const periodSlug = toText(payload.periodLabel, new Date().toISOString().slice(0, 10))
    .replace(/[^\w.-]+/g, "-")
    .toLowerCase();
  return sendExcel(res, `bank-reconciliation-${periodSlug}`, bankReconciliationReportExportHtml(payload));
});

exportsRouter.post("/exports/executive-audit/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "Invalid executive audit payload" });
  }
  const typeSlug = toText(payload.type, "executive-audit").replace(/[^\w.-]+/g, "-").toLowerCase();
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendWord(res, `${typeSlug}-${dateKey}`, executiveAuditExportHtml(payload));
});

exportsRouter.post("/exports/executive-audit/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "Invalid executive audit payload" });
  }
  const typeSlug = toText(payload.type, "executive-audit").replace(/[^\w.-]+/g, "-").toLowerCase();
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendExcel(res, `${typeSlug}-${dateKey}`, executiveAuditExportHtml(payload));
});

exportsRouter.get("/exports/purchase-orders/:id/surat-jalan/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("purchase-orders", req.params.id);
  if (!payload) return res.status(404).json({ error: "Purchase order not found" });
  return sendWord(res, `surat-jalan-${req.params.id}`, purchaseOrderSuratJalanExportHtml(payload));
});

exportsRouter.get("/exports/purchase-orders/:id/surat-jalan/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = await getAppEntityPayload("purchase-orders", req.params.id);
  if (!payload) return res.status(404).json({ error: "Purchase order not found" });
  return sendExcel(res, `surat-jalan-${req.params.id}`, purchaseOrderSuratJalanExportHtml(payload));
});

exportsRouter.post("/exports/working-expense-sheet/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "Invalid working expense sheet payload" });
  }
  const id = toText(payload.id, "working-expense-sheet").replace(/[^\w.-]+/g, "-").toLowerCase();
  return sendWord(res, `${id}`, workingExpenseSheetExportHtml(payload));
});

exportsRouter.post("/exports/working-expense-sheet/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "Invalid working expense sheet payload" });
  }
  const id = toText(payload.id, "working-expense-sheet").replace(/[^\w.-]+/g, "-").toLowerCase();
  return sendExcel(res, `${id}`, workingExpenseSheetExportHtml(payload));
});

exportsRouter.post("/exports/working-expense-ledger/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const items = asRecords(payload.items);
  if (!items.length) return res.status(400).json({ error: "Working expense ledger is empty" });
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendWord(res, `working-expense-ledger-${dateKey}`, workingExpenseLedgerExportHtml(payload));
});

exportsRouter.post("/exports/working-expense-ledger/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const items = asRecords(payload.items);
  if (!items.length) return res.status(400).json({ error: "Working expense ledger is empty" });
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendExcel(res, `working-expense-ledger-${dateKey}`, workingExpenseLedgerExportHtml(payload));
});

exportsRouter.post("/exports/ppn-ledger/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const items = asRecords(payload.items);
  if (!items.length) return res.status(400).json({ error: "PPN ledger is empty" });
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendWord(res, `ppn-ledger-${dateKey}`, ppnLedgerExportHtml(payload));
});

exportsRouter.post("/exports/ppn-ledger/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const items = asRecords(payload.items);
  if (!items.length) return res.status(400).json({ error: "PPN ledger is empty" });
  const dateKey = new Date().toISOString().slice(0, 10);
  return sendExcel(res, `ppn-ledger-${dateKey}`, ppnLedgerExportHtml(payload));
});

exportsRouter.post("/exports/tabular-report/word", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) return res.status(400).json({ error: "Tabular report is empty" });
  const filename = toText(payload.filename, `report-${new Date().toISOString().slice(0, 10)}`)
    .replace(/[^\w.-]+/g, "-")
    .toLowerCase();
  return sendWord(res, filename, tabularReportExportHtml(payload as TabularReportPayload));
});

exportsRouter.post("/exports/tabular-report/excel", authenticate, async (req: AuthRequest, res: Response) => {
  const payload = asRecord(req.body);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) return res.status(400).json({ error: "Tabular report is empty" });
  const filename = toText(payload.filename, `report-${new Date().toISOString().slice(0, 10)}`)
    .replace(/[^\w.-]+/g, "-")
    .toLowerCase();
  return sendExcel(res, filename, tabularReportExportHtml(payload as TabularReportPayload));
});

exportsRouter.get("/exports/preview/:resource/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const resource = String(req.params.resource || "").trim().toLowerCase();
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "Invalid id" });

  if (resource === "data-collections") {
    const payload = await getDataCollectionPayload(id);
    if (!payload) return res.status(404).json({ error: "Data collection not found" });
    const tkJakon = resolveTkJakonPayload(payload);
    if (tkJakon.rows.length > 0) {
      return sendPreview(res, tkJakonWordHtml(payload));
    }
    const tools = Array.isArray(payload.tools) ? payload.tools : [];
    const manpower = Array.isArray(payload.manpower) ? payload.manpower : [];
    const schedule = Array.isArray(payload.schedule) ? payload.schedule : [];
    const consumables = Array.isArray(payload.consumables) ? payload.consumables : [];
    const scopeOfWork = Array.isArray(payload.scopeOfWork)
      ? payload.scopeOfWork.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0)
      : [];
    const scopeHtml =
      scopeOfWork.length > 0
        ? `<h3>Scope Of Work</h3><ul>${scopeOfWork.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
        : "";
    const html = `
      ${companyLetterheadHtml("Data Persiapan Pekerjaan Proyek")}
      <p><b>ID:</b> ${escapeHtml(toText(payload.id))}</p>
      <p><b>Nama Proyek:</b> ${escapeHtml(payload.namaProyek)}</p>
      <p><b>Customer:</b> ${escapeHtml(payload.customer)}</p>
      <p><b>Lokasi:</b> ${escapeHtml(payload.lokasi)}</p>
      <p><b>Durasi:</b> ${escapeHtml(payload.durasiProyekHari)} hari</p>
      <p><b>Notes:</b> ${escapeHtml(payload.notes)}</p>
      ${scopeHtml}
      ${listTable("Tools", tools, ["nama", "jenis", "jumlah", "keterangan"])}
      ${listTable("Manpower", manpower, ["jabatan", "jumlah", "sertifikat", "keterangan"])}
      ${listTable("Schedule", schedule, ["deskripsi", "jumlahHari", "keterangan"])}
      ${listTable("Consumables", consumables, ["deskripsi", "unit", "jumlah", "keterangan"])}
      ${companyFooterHtml(payload.createdBy)}
    `;
    return sendPreview(res, html);
  }

  if (resource === "quotations") {
    const payload = await getQuotationPayload(id);
    if (!payload) return res.status(404).json({ error: "Quotation not found" });
    const style = resolveQuotationDocStyle(req.query?.style);
    const hasBom = asRecords(payload.bomDetailed).length > 0 || asRecords(payload.bomSummary).length > 0;
    return sendPreview(res, hasBom ? quotationBomHtml(payload) : quotationLetterHtml(payload, { style }));
  }

  if (resource === "projects") {
    const payload = await getProjectPayload(id);
    if (!payload) return res.status(404).json({ error: "Project not found" });
    const linkedQuotation = await getProjectQuotationContext(payload);
    const rawBoq = Array.isArray(payload.boq) ? payload.boq : [];
    const boq = rawBoq.length > 0 ? rawBoq : projectBoqRowsFromPricingItems(linkedQuotation.data.pricingItems, linkedQuotation.data);
    const milestones = Array.isArray(payload.milestones) ? payload.milestones : [];
    const workOrders = Array.isArray(payload.workOrders) ? payload.workOrders : [];
    const quotationSnapshot = linkedQuotation.data;
    const hasSnapshot = Object.keys(quotationSnapshot).length > 0;
    const snapshotGrandTotal = toNum(quotationSnapshot.grandTotal);
    const { scopeOfWork, exclusions } = pickScopeAndExclusions(quotationSnapshot);
    const snapshotSourceText =
      linkedQuotation.sourceLabel === "snapshot"
        ? "Locked Snapshot"
        : linkedQuotation.sourceLabel === "linked-quotation"
        ? "Linked Quotation (Live)"
        : "-";
    const scopeHtml =
      scopeOfWork.length > 0 ? `<ul>${scopeOfWork.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p>-</p>";
    const exclusionsHtml =
      exclusions.length > 0 ? `<ul>${exclusions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p>-</p>";
    const html = `
      ${companyLetterheadHtml("Project Summary Report")}
      <p><b>ID:</b> ${escapeHtml(toText(payload.id))}</p>
      <p><b>Kode Project:</b> ${escapeHtml(payload.kodeProject)}</p>
      <p><b>Nama Project:</b> ${escapeHtml(payload.namaProject)}</p>
      <p><b>Customer:</b> ${escapeHtml(payload.customer)}</p>
      <p><b>Status:</b> ${escapeHtml(payload.status)}</p>
      <p><b>Approval Status:</b> ${escapeHtml(payload.approvalStatus || "Pending")}</p>
      <p><b>Approved By:</b> ${escapeHtml(payload.approvedBy || "-")}</p>
      <p><b>Approved At:</b> ${escapeHtml(payload.approvedAt || "-")}</p>
      <p><b>Nilai Kontrak:</b> Rp ${idr(toNum(payload.nilaiKontrak))}</p>
      ${
        hasSnapshot
          ? `
        <h2>Quotation Reference (${escapeHtml(snapshotSourceText)})</h2>
        <p><b>Quotation ID:</b> ${escapeHtml(toText(quotationSnapshot.id, "-"))}</p>
        <p><b>No Penawaran:</b> ${escapeHtml(quotationSnapshot.noPenawaran || "-")}</p>
        <p><b>Kepada:</b> ${escapeHtml(quotationSnapshot.kepada || "-")}</p>
        <p><b>Perihal:</b> ${escapeHtml(quotationSnapshot.perihal || "-")}</p>
        <p><b>Grand Total:</b> Rp ${idr(snapshotGrandTotal)}</p>
        <p><b>Snapshot At:</b> ${escapeHtml(payload.quotationSnapshotAt || "-")}</p>
        <p><b>Snapshot By:</b> ${escapeHtml(payload.quotationSnapshotBy || "-")}</p>
        <h3>Scope Of Work</h3>
        ${scopeHtml}
        <h3>Exclusions</h3>
        ${exclusionsHtml}
      `
          : ""
      }
      ${listTable("BOQ Items", boq, ["itemKode", "materialName", "qtyEstimate", "unit", "unitPrice", "totalCost"])}
      ${listTable("Milestones", milestones, ["name", "status", "plannedDate", "actualDate"])}
      ${listTable("Work Orders", workOrders, ["woNumber", "itemToProduce", "targetQty", "completedQty", "status"])}
      ${companyFooterHtml(payload.approvedBy || payload.quotationSnapshotBy)}
    `;
    return sendPreview(res, html);
  }

  if (resource === "invoices") {
    const payload = await getAppEntityPayload("invoices", id);
    if (!payload) return res.status(404).json({ error: "Invoice not found" });
    return sendPreview(res, invoiceExportHtml(payload));
  }

  if (resource === "surat-jalan") {
    const payload = await getAppEntityPayload("surat-jalan", id);
    if (!payload) return res.status(404).json({ error: "Surat jalan not found" });
    return sendPreview(res, suratJalanExportHtml(payload));
  }

  if (resource === "berita-acara") {
    const payload = await getAppEntityPayload("berita-acara", id);
    if (!payload) return res.status(404).json({ error: "Berita acara not found" });
    return sendPreview(res, beritaAcaraExportHtml(payload));
  }

  if (resource === "purchase-orders") {
    const payload = await getAppEntityPayload("purchase-orders", id);
    if (!payload) return res.status(404).json({ error: "Purchase order not found" });
    return sendPreview(res, purchaseOrderExportHtml(payload));
  }

  if (resource === "stock-outs") {
    const payload = await getAppEntityPayload("stock-outs", id);
    if (!payload) return res.status(404).json({ error: "Stock out not found" });
    return sendPreview(res, stockOutExportHtml(payload));
  }

  if (resource === "spk-records") {
    const payload = await getAppEntityPayload("spk-records", id);
    if (!payload) return res.status(404).json({ error: "SPK record not found" });
    return sendPreview(res, spkRecordExportHtml(payload));
  }

  if (resource === "work-orders") {
    const payload = await getAppEntityPayload("work-orders", id);
    if (!payload) return res.status(404).json({ error: "Work order not found" });
    return sendPreview(res, workOrderSpkExportHtml(payload));
  }

  return res.status(400).json({
    error: "Unsupported preview resource",
    supported: [
      "data-collections",
      "quotations",
      "projects",
      "invoices",
      "surat-jalan",
      "berita-acara",
      "purchase-orders",
      "stock-outs",
      "spk-records",
      "work-orders",
    ],
  });
});
