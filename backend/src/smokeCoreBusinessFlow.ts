import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { resolveSmokeCredential, resolveSmokeToken } from "./utils/smokeCredentials";

type RoleKey = "owner" | "spv" | "sales" | "purchasing" | "warehouse" | "produksi";

type Session = {
  token: string;
  username: string;
};

type ApiResult = {
  status: number;
  json: any;
  rawText: string;
};

type DrillState = {
  prefix: string;
  timestamp: number;
  ids: {
    dataCollectionId: string;
    quotationId: string;
    projectId: string | null;
    purchaseOrderId: string;
    receivingId: string;
    poPaymentId: string;
    workOrderId: string;
    stockOutId: string;
    spkId: string;
    suratJalanId: string;
    beritaAcaraId: string;
    invoiceDraftId: string;
    invoiceFinalId: string;
  };
};

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const KEEP_DATA = String(process.env.SMOKE_KEEP_DATA || "").toLowerCase() === "true";
const ALLOW_LIVE_WRITE = String(process.env.SMOKE_ALLOW_LIVE_WRITE || "").toLowerCase() === "true";
const DRILL_PREFIX = process.env.SMOKE_FLOW_PREFIX || "DRILL-E2E";

const ownerCredential = resolveSmokeCredential(
  "SMOKE_OWNER_USERNAME",
  "SMOKE_OWNER_PASSWORD",
  [Role.OWNER, Role.ADMIN],
  { username: "syamsudin", password: "changeMeOwner123" }
);
const spvCredential = resolveSmokeCredential(
  "SMOKE_SPV_USERNAME",
  "SMOKE_SPV_PASSWORD",
  [Role.SPV],
  { username: "aji", password: "changeMeAji123" }
);
const salesCredential = resolveSmokeCredential(
  "SMOKE_SALES_USERNAME",
  "SMOKE_SALES_PASSWORD",
  [Role.SALES],
  { username: "angesti", password: "changeMeAngesti123" }
);
const purchasingCredential = resolveSmokeCredential(
  "SMOKE_PURCHASING_USERNAME",
  "SMOKE_PURCHASING_PASSWORD",
  [Role.PURCHASING],
  { username: "ening", password: "changeMePurchasing123" }
);
const warehouseCredential = resolveSmokeCredential(
  "SMOKE_WAREHOUSE_USERNAME",
  "SMOKE_WAREHOUSE_PASSWORD",
  [Role.WAREHOUSE],
  { username: "dewi", password: "changeMeWarehouse123" }
);
const produksiCredential = resolveSmokeCredential(
  "SMOKE_PRODUKSI_USERNAME",
  "SMOKE_PRODUKSI_PASSWORD",
  [Role.PRODUKSI],
  { username: "produksi", password: "changeMeProduksi123" }
);

const credentials: Record<RoleKey, { username: string; password: string; tokenEnvKey: string }> = {
  owner: { ...ownerCredential, tokenEnvKey: "SMOKE_OWNER_TOKEN" },
  spv: { ...spvCredential, tokenEnvKey: "SMOKE_SPV_TOKEN" },
  sales: { ...salesCredential, tokenEnvKey: "SMOKE_SALES_TOKEN" },
  purchasing: { ...purchasingCredential, tokenEnvKey: "SMOKE_PURCHASING_TOKEN" },
  warehouse: { ...warehouseCredential, tokenEnvKey: "SMOKE_WAREHOUSE_TOKEN" },
  produksi: { ...produksiCredential, tokenEnvKey: "SMOKE_PRODUKSI_TOKEN" },
};

const preferredRolesByKey: Record<RoleKey, Role[]> = {
  owner: [Role.OWNER, Role.ADMIN],
  spv: [Role.SPV],
  sales: [Role.SALES],
  purchasing: [Role.PURCHASING],
  warehouse: [Role.WAREHOUSE],
  produksi: [Role.PRODUKSI],
};

function isLocalBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function assertWriteSafety() {
  if (isLocalBaseUrl(BASE_URL) || ALLOW_LIVE_WRITE) return;
  throw new Error(
    `Refusing write-drill against non-local base URL '${BASE_URL}'. Set SMOKE_ALLOW_LIVE_WRITE=true if this is intentional.`
  );
}

async function api(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown }
): Promise<ApiResult> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts?.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const rawText = await res.text();
  let json: any = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, rawText };
}

function pass(message: string, detail?: string) {
  console.log(`OK ${message}${detail ? ` -> ${detail}` : ""}`);
}

function failMessage(res: ApiResult): string {
  if (typeof res.json?.message === "string" && res.json.message.trim()) return res.json.message;
  if (typeof res.json?.error === "string" && res.json.error.trim()) return res.json.error;
  if (res.rawText.trim()) return res.rawText.trim();
  return `HTTP ${res.status}`;
}

function assertStatus(name: string, res: ApiResult, expected: number | number[]) {
  const expectedList = Array.isArray(expected) ? expected : [expected];
  if (!expectedList.includes(res.status)) {
    throw new Error(`${name} expected ${expectedList.join("/")} but got ${res.status}: ${failMessage(res)}`);
  }
  pass(name, String(res.status));
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(role: RoleKey): Promise<Session> {
  const cred = credentials[role];
  const dbUser = await prisma.user.findFirst({
    where: {
      role: { in: preferredRolesByKey[role] },
      isActive: true,
    },
    select: {
      username: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const username = dbUser?.username || cred.username;
  const directToken = await resolveSmokeToken(cred.tokenEnvKey, username);
  if (directToken) {
    pass(`${role} token`, username);
    return { token: directToken, username };
  }

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const res = await api("POST", "/auth/login", {
      body: { username, password: cred.password },
    });
    if (res.status === 200 && res.json?.token) {
      pass(`${role} login`, username);
      return { token: String(res.json.token), username };
    }
    if (res.status !== 429 || attempt === 8) {
      throw new Error(`${role} login failed: ${res.status} ${failMessage(res)}`);
    }
    await sleep(10_000);
  }

  throw new Error(`${role} login failed after retries`);
}

async function pollProjectIdByQuotationId(
  quotationId: string,
  token: string
): Promise<{ id: string; projectName: string }> {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const res = await api("GET", "/projects", { token });
    assertStatus("GET /projects", res, 200);
    const rows = Array.isArray(res.json) ? res.json : [];
    const found = rows.find((row: any) => row?.quotationId === quotationId && typeof row?.id === "string");
    if (found) {
      return {
        id: String(found.id),
        projectName: String(found.namaProject || found.projectName || found.id),
      };
    }
    await sleep(1_000);
  }
  throw new Error(`Linked project for quotation '${quotationId}' not found after polling`);
}

async function cleanup(state: DrillState) {
  if (KEEP_DATA) {
    console.log(`KEEP_DATA enabled. Drill records with prefix '${state.prefix}' left in database.`);
    return;
  }

  const ids = Object.values(state.ids).filter((value): value is string => Boolean(value));
  const idSet = Array.from(new Set(ids));

  await prisma.auditLogEntry.deleteMany({
    where: {
      OR: [
        { entityId: { in: idSet } },
        { details: { contains: state.prefix } },
      ],
    },
  });

  if (state.ids.projectId) {
    await prisma.projectApprovalLog.deleteMany({
      where: { projectId: state.ids.projectId },
    });
  }

  await prisma.quotationApprovalLog.deleteMany({
    where: { quotationId: state.ids.quotationId },
  });

  await prisma.invoiceRecord.deleteMany({
    where: {
      id: {
        in: [state.ids.invoiceDraftId, state.ids.invoiceFinalId],
      },
    },
  });

  await prisma.projectBeritaAcara.deleteMany({ where: { id: state.ids.beritaAcaraId } });
  await prisma.projectSpkRecord.deleteMany({ where: { id: state.ids.spkId } });
  await prisma.logisticsSuratJalan.deleteMany({ where: { id: state.ids.suratJalanId } });
  await prisma.inventoryStockOut.deleteMany({ where: { id: state.ids.stockOutId } });
  await prisma.productionTrackerEntry.deleteMany({
    where: {
      OR: [
        { workOrderId: state.ids.workOrderId },
        ...(state.ids.projectId ? [{ projectId: state.ids.projectId }] : []),
      ],
    },
  });
  await prisma.workOrderRecord.deleteMany({ where: { id: state.ids.workOrderId } });
  await prisma.productionWorkOrder.deleteMany({ where: { id: state.ids.workOrderId } });
  await prisma.procurementReceiving.deleteMany({ where: { id: state.ids.receivingId } });
  await prisma.receivingRecord.deleteMany({ where: { id: state.ids.receivingId } });
  await prisma.purchaseOrderRecord.deleteMany({ where: { id: state.ids.purchaseOrderId } });
  await prisma.procurementPurchaseOrder.deleteMany({ where: { id: state.ids.purchaseOrderId } });
  await prisma.appEntity.deleteMany({ where: { entityId: { in: idSet } } });

  if (state.ids.projectId) {
    await prisma.projectRecord.deleteMany({ where: { id: state.ids.projectId } });
  }

  await prisma.quotation.deleteMany({ where: { id: state.ids.quotationId } });
  await prisma.dataCollection.deleteMany({ where: { id: state.ids.dataCollectionId } });

  pass("cleanup", "done");
}

async function main() {
  assertWriteSafety();

  console.log("Smoke Core Business Flow");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Keep data: ${KEEP_DATA ? "yes" : "no"}`);

  const sessions = {
    owner: await login("owner"),
    spv: await login("spv"),
    sales: await login("sales"),
    purchasing: await login("purchasing"),
    warehouse: await login("warehouse"),
    produksi: await login("produksi"),
  };

  const timestamp = Date.now();
  const prefix = `${DRILL_PREFIX}-${timestamp}`;
  const today = new Date().toISOString().slice(0, 10);
  const materialCode = `MAT-${timestamp}`;
  const itemName = `Material Drill ${timestamp}`;
  const customerName = `PT Drill Customer ${timestamp}`;

  const state: DrillState = {
    prefix,
    timestamp,
    ids: {
      dataCollectionId: `${prefix}-DC`,
      quotationId: `${prefix}-QUO`,
      projectId: null,
      purchaseOrderId: `${prefix}-PO`,
      receivingId: `${prefix}-RCV`,
      poPaymentId: `${prefix}-POPAY`,
      workOrderId: `${prefix}-WO`,
      stockOutId: `${prefix}-SOUT`,
      spkId: `${prefix}-SPK`,
      suratJalanId: `${prefix}-SJ`,
      beritaAcaraId: `${prefix}-BA`,
      invoiceDraftId: `${prefix}-INV-DRAFT`,
      invoiceFinalId: `${prefix}-INV-FINAL`,
    },
  };

  try {
    const createDataCollection = await api("POST", "/data-collections", {
      token: sessions.sales.token,
      body: {
        id: state.ids.dataCollectionId,
        namaResponden: customerName,
        lokasi: "Jakarta",
        tipePekerjaan: "Jasa / Produksi",
        status: "Draft",
        tanggalSurvey: today,
        notes: prefix,
      },
    });
    assertStatus("create data collection", createDataCollection, 201);

    const reviewDataCollection = await api("PATCH", `/data-collections/${state.ids.dataCollectionId}`, {
      token: sessions.spv.token,
      body: {
        status: "Reviewed SPV",
        reviewedBy: sessions.spv.username,
        reviewNotes: prefix,
      },
    });
    assertStatus("review data collection", reviewDataCollection, 200);

    const listDataCollections = await api("GET", "/data-collections", { token: sessions.sales.token });
    assertStatus("list data collections", listDataCollections, 200);

    const createQuotation = await api("POST", "/quotations", {
      token: sessions.sales.token,
      body: {
        id: state.ids.quotationId,
        tanggal: today,
        kepada: customerName,
        customer: customerName,
        customerName,
        perusahaan: customerName,
        perihal: `Regression ${prefix}`,
        status: "Draft",
        dataCollectionId: state.ids.dataCollectionId,
        grandTotal: 1_000_000,
        items: [
          {
            deskripsi: `Penawaran ${prefix}`,
            qty: 1,
            unit: "lot",
            hargaSatuan: 1_000_000,
            total: 1_000_000,
          },
        ],
      },
    });
    assertStatus("create quotation", createQuotation, 201);

    const sendQuotation = await api("POST", "/dashboard/finance-approval-action", {
      token: sessions.sales.token,
      body: {
        documentType: "QUOTATION",
        action: "SEND",
        documentId: state.ids.quotationId,
      },
    });
    assertStatus("send quotation", sendQuotation, 200);

    const approveQuotation = await api("POST", "/dashboard/finance-approval-action", {
      token: sessions.spv.token,
      body: {
        documentType: "QUOTATION",
        action: "APPROVE",
        documentId: state.ids.quotationId,
      },
    });
    assertStatus("approve quotation", approveQuotation, 200);

    const linkedProject = await pollProjectIdByQuotationId(state.ids.quotationId, sessions.spv.token);
    state.ids.projectId = linkedProject.id;
    pass("linked project", linkedProject.id);

    const approveProject = await api("PATCH", `/projects/${linkedProject.id}/approval`, {
      token: sessions.spv.token,
      body: {
        action: "APPROVE",
      },
    });
    assertStatus("approve project", approveProject, 200);

    const createPo = await api("POST", "/purchase-orders", {
      token: sessions.purchasing.token,
      body: {
        id: state.ids.purchaseOrderId,
        noPO: state.ids.purchaseOrderId,
        tanggal: today,
        supplier: `Supplier ${prefix}`,
        projectId: linkedProject.id,
        status: "Draft",
        total: 1_000_000,
        items: [
          {
            kode: materialCode,
            nama: itemName,
            qty: 2,
            unit: "pcs",
            unitPrice: 500_000,
            total: 1_000_000,
            qtyReceived: 0,
          },
        ],
        notes: prefix,
      },
    });
    assertStatus("create purchase order", createPo, 201);

    const getPo = await api("GET", "/purchase-orders", { token: sessions.purchasing.token });
    assertStatus("list purchase orders", getPo, 200);

    const createReceiving = await api("POST", "/receivings", {
      token: sessions.warehouse.token,
      body: {
        id: state.ids.receivingId,
        noReceiving: state.ids.receivingId,
        tanggal: today,
        poId: state.ids.purchaseOrderId,
        noPO: state.ids.purchaseOrderId,
        supplier: `Supplier ${prefix}`,
        projectId: linkedProject.id,
        project: linkedProject.projectName,
        status: "Complete",
        lokasiGudang: "Gudang Utama",
        items: [
          {
            itemKode: materialCode,
            itemName,
            qtyOrdered: 2,
            qtyReceived: 2,
            qtyGood: 2,
            qtyDamaged: 0,
            qtyPreviouslyReceived: 0,
            unit: "pcs",
          },
        ],
        notes: prefix,
      },
    });
    assertStatus("create receiving", createReceiving, 201);

    const getReceiving = await api("GET", "/receivings", { token: sessions.warehouse.token });
    assertStatus("list receivings", getReceiving, 200);

    const createPoPayment = await api("POST", "/finance-po-payments", {
      token: sessions.purchasing.token,
      body: {
        id: state.ids.poPaymentId,
        poId: state.ids.purchaseOrderId,
        projectId: linkedProject.id,
        noPO: state.ids.purchaseOrderId,
        tanggal: today,
        supplier: `Supplier ${prefix}`,
        amount: 1_000_000,
        status: "Draft",
        notes: prefix,
      },
    });
    assertStatus("create po payment", createPoPayment, 201);

    const getPoPayment = await api("GET", "/finance-po-payments", { token: sessions.purchasing.token });
    assertStatus("list po payments", getPoPayment, 200);

    const createWorkOrder = await api("POST", "/work-orders", {
      token: sessions.produksi.token,
      body: {
        id: state.ids.workOrderId,
        woNumber: state.ids.workOrderId,
        projectId: linkedProject.id,
        projectName: linkedProject.projectName,
        itemToProduce: `Output ${prefix}`,
        targetQty: 1,
        completedQty: 0,
        status: "Draft",
        priority: "Normal",
        leadTechnician: "Tim Produksi",
        workflowStatus: "Draft",
        bom: [
          {
            kode: materialCode,
            nama: itemName,
            qty: 1,
            unit: "pcs",
          },
        ],
      },
    });
    assertStatus("create work order", createWorkOrder, 201);

    const getWorkOrder = await api("GET", "/work-orders", { token: sessions.produksi.token });
    assertStatus("list work orders", getWorkOrder, 200);

    const createStockOut = await api("POST", "/inventory/stock-outs", {
      token: sessions.produksi.token,
      body: {
        id: state.ids.stockOutId,
        noStockOut: state.ids.stockOutId,
        tanggal: today,
        projectId: linkedProject.id,
        noWorkOrder: state.ids.workOrderId,
        type: "Project Issue",
        status: "Draft",
        penerima: "Tim Produksi",
        items: [
          {
            kode: materialCode,
            nama: itemName,
            qty: 1,
            satuan: "pcs",
          },
        ],
        notes: prefix,
      },
    });
    assertStatus("create stock out", createStockOut, 201);

    const createSpk = await api("POST", "/spk-records", {
      token: sessions.produksi.token,
      body: {
        id: state.ids.spkId,
        projectId: linkedProject.id,
        workOrderId: state.ids.workOrderId,
        noSPK: state.ids.spkId,
        title: `SPK ${prefix}`,
        pekerjaan: `Pekerjaan ${prefix}`,
        tanggal: today,
        status: "Active",
        teknisi: ["Teknisi Drill"],
      },
    });
    assertStatus("create spk", createSpk, 201);

    const createSuratJalan = await api("POST", "/surat-jalan", {
      token: sessions.warehouse.token,
      body: {
        id: state.ids.suratJalanId,
        noSurat: state.ids.suratJalanId,
        tanggal: today,
        sjType: "Material Delivery",
        tujuan: customerName,
        alamat: "Jakarta",
        projectId: linkedProject.id,
        noPO: state.ids.purchaseOrderId,
        pengirim: sessions.warehouse.username,
        deliveryStatus: "Pending",
        workflowStatus: "PREPARED",
        items: [
          {
            itemKode: materialCode,
            namaItem: itemName,
            jumlah: 1,
            satuan: "pcs",
          },
        ],
      },
    });
    assertStatus("create surat jalan", createSuratJalan, 201);

    const getSuratJalan = await api("GET", "/surat-jalan", { token: sessions.warehouse.token });
    assertStatus("list surat jalan", getSuratJalan, 200);

    const invoiceBasePayload = {
      projectId: linkedProject.id,
      projectName: linkedProject.projectName,
      customer: customerName,
      customerName,
      noPO: state.ids.purchaseOrderId,
      tanggal: today,
      jatuhTempo: today,
      subtotal: 1_000_000,
      ppn: 11,
      totalBayar: 1_110_000,
      items: [
        {
          deskripsi: `Invoice ${prefix}`,
          qty: 1,
          unit: "lot",
          hargaSatuan: 1_000_000,
          total: 1_000_000,
          sourceRef: state.ids.suratJalanId,
        },
      ],
    };

    const createInvoiceBeforeBa = await api("POST", "/invoices", {
      token: sessions.owner.token,
      body: {
        id: state.ids.invoiceDraftId,
        noInvoice: state.ids.invoiceDraftId,
        ...invoiceBasePayload,
      },
    });
    assertStatus("invoice blocked before BA", createInvoiceBeforeBa, 400);

    const createBeritaAcara = await api("POST", "/berita-acara", {
      token: sessions.produksi.token,
      body: {
        id: state.ids.beritaAcaraId,
        noBA: state.ids.beritaAcaraId,
        tanggal: today,
        jenisBA: "Serah Terima",
        pihakPertama: "PT Gema",
        pihakKedua: customerName,
        lokasi: "Jakarta",
        contentHTML: `<p>${prefix}</p>`,
        refSuratJalan: state.ids.suratJalanId,
        projectId: linkedProject.id,
        projectName: linkedProject.projectName,
        status: "Final",
        approvedBy: sessions.spv.username,
        approvedAt: new Date().toISOString(),
      },
    });
    assertStatus("create berita acara", createBeritaAcara, 201);

    const getBeritaAcara = await api("GET", "/berita-acara", { token: sessions.produksi.token });
    assertStatus("list berita acara", getBeritaAcara, 200);

    const createInvoice = await api("POST", "/invoices", {
      token: sessions.owner.token,
      body: {
        id: state.ids.invoiceFinalId,
        noInvoice: state.ids.invoiceFinalId,
        ...invoiceBasePayload,
      },
    });
    assertStatus("create invoice after BA", createInvoice, 201);

    const getInvoices = await api("GET", "/invoices", { token: sessions.owner.token });
    assertStatus("list invoices", getInvoices, 200);

    console.log("\nCore business flow smoke passed.");
    console.log(
      JSON.stringify(
        {
          ok: true,
          prefix,
          projectId: linkedProject.id,
          invoiceBeforeBa: createInvoiceBeforeBa.status,
          invoiceAfterBa: createInvoice.status,
        },
        null,
        2
      )
    );
  } finally {
    await cleanup(state);
  }
}

main()
  .catch((err) => {
    console.error("\nCore business flow smoke failed:");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export {};
