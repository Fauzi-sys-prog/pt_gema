type ApiResult = {
  status: number;
  json: any;
  rawText: string;
};

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const USERNAME = process.env.SMOKE_OWNER_USERNAME || "owner";
const PASSWORD = process.env.SMOKE_OWNER_PASSWORD || "owner";
const OWNER_TOKEN_OVERRIDE = process.env.SMOKE_OWNER_TOKEN;

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

function passFail(ok: boolean): string {
  return ok ? "PASS" : "FAIL";
}

function assertStatus(name: string, got: number, expected: number[]) {
  const ok = expected.includes(got);
  console.log(`[${passFail(ok)}] ${name} -> ${got}, expected ${expected.join("/")}`);
  if (!ok) throw new Error(`${name}: got ${got}, expected ${expected.join("/")}`);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(): Promise<string> {
  if (typeof OWNER_TOKEN_OVERRIDE === "string" && OWNER_TOKEN_OVERRIDE.trim()) {
    return OWNER_TOKEN_OVERRIDE.trim();
  }
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const res = await api("POST", "/auth/login", {
      body: { username: USERNAME, password: PASSWORD },
    });
    if (res.status === 200 && res.json?.token) return String(res.json.token);
    if (res.status !== 429 || attempt === 8) {
      throw new Error(`Login failed: ${res.status} ${res.rawText}`);
    }
    await sleep(10_000);
  }
  throw new Error("Login failed after retries");
}

async function main() {
  console.log("Smoke Module Relations");
  console.log(`Base URL: ${BASE_URL}`);
  const token = await login();
  console.log("[PASS] Login");

  const cleanup: Array<() => Promise<void>> = [];
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  const readChecks = [
    "/projects",
    "/quotations",
    "/data-collections",
    "/purchase-orders",
    "/receivings",
    "/work-orders",
    "/inventory/stock-ins",
    "/inventory/stock-outs",
    "/inventory/movements",
    "/surat-jalan",
    "/material-requests",
    "/assets",
    "/maintenances",
    "/payrolls",
    "/employees",
    "/attendances",
    "/finance/vendor-expenses",
    "/finance/vendor-invoices",
    "/finance/customer-invoices",
    "/customers",
    "/vendors",
    "/hr/kasbons",
    "/fleet-health",
    "/proof-of-delivery",
    "/spk-records",
    "/finance/bank-reconciliations",
    "/finance/petty-cash-transactions",
    "/app-settings",
    "/surat-masuk",
    "/surat-keluar",
    "/template-surat",
    "/dashboard/finance-general-ledger-summary",
  ];

  for (const path of readChecks) {
    // eslint-disable-next-line no-await-in-loop
    const res = await api("GET", path, { token });
    assertStatus(`GET ${path}`, res.status, [200]);
  }

  const projectListRes = await api("GET", "/projects", { token });
  assertStatus("GET /projects (seed context)", projectListRes.status, [200]);
  const smokeProject = Array.isArray(projectListRes.json)
    ? projectListRes.json.find((item: any) => typeof item?.id === "string" && item.id.trim())
    : null;
  if (!smokeProject?.id) {
    throw new Error("Smoke butuh minimal 1 project aktif untuk uji relasi dedicated");
  }
  const smokeProjectId = String(smokeProject.id);
  const smokeProjectName = String(smokeProject.namaProject || smokeProject.projectName || smokeProjectId);

  try {
    const customerId = `CUS-SMREL-${now}`;
    const vendorId = `VND-SMREL-${now}`;
    const employeeId = `EMP-SMREL-${now}`;
    const templateId = `TPL-SMREL-${now}`;
    const assetId = `AST-SMREL-${now}`;
    const poId = `PO-SMREL-${now}`;
    const receivingId = `RCV-SMREL-${now}`;
    const woId = `WO-SMREL-${now}`;
    const stockOutId = `SOUT-SMREL-${now}`;
    const suratJalanId = `SJ-SMREL-${now}`;
    const mrId = `MR-SMREL-${now}`;
    const payrollId = `PAY-SMREL-${now}`;
    const attendanceId = `ATT-SMREL-${now}`;
    const vendorInvoiceId = `VINV-SMREL-${now}`;
    const vendorExpenseId = `VEXP-SMREL-${now}`;
    const customerInvoiceId = `CINV-SMREL-${now}`;
    const maintenanceId = `MNT-SMREL-${now}`;
    const kasbonId = `KSB-SMREL-${now}`;
    const fleetHealthId = `FHL-SMREL-${now}`;
    const podId = `POD-SMREL-${now}`;
    const spkId = `SPK-SMREL-${now}`;
    const appSettingId = `SET-SMREL-${now}`;
    const bankReconId = `BREC-SMREL-${now}`;
    const pettyTxnId = `PTTY-SMREL-${now}`;
    const suratMasukId = `SMK-SMREL-${now}`;
    const suratKeluarId = `SKR-SMREL-${now}`;

    const createCustomer = await api("POST", "/customers", {
      token,
      body: {
        id: customerId,
        kodeCustomer: customerId,
        namaCustomer: "Smoke Customer",
        alamat: "Jl Test",
        kota: "Jakarta",
        kontak: "PIC Smoke",
        telepon: "08123456789",
        email: `smoke-customer-${now}@test.local`,
        paymentTerms: "30 Days",
        rating: 5,
        status: "Active",
        createdAt: new Date().toISOString(),
      },
    });
    assertStatus("POST /customers", createCustomer.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/customers/${customerId}`, { token }); });

    const createVendor = await api("POST", "/vendors", {
      token,
      body: {
        id: vendorId,
        kodeVendor: vendorId,
        namaVendor: "Smoke Vendor",
        kategori: "Service",
        status: "Active",
        rating: 5,
        createdAt: new Date().toISOString(),
      },
    });
    assertStatus("POST /vendors", createVendor.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/vendors/${vendorId}`, { token }); });

    const createTemplate = await api("POST", "/template-surat", {
      token,
      body: {
        id: templateId,
        nama: "Template Smoke",
        jenisSurat: "General",
        content: "<p>Smoke</p>",
      },
    });
    assertStatus("POST /template-surat", createTemplate.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/template-surat/${templateId}`, { token }); });

    const createEmployee = await api("POST", "/employees", {
      token,
      body: {
        id: employeeId,
        employeeId,
        name: "Smoke Employee",
        position: "Operator",
        department: "Production",
        employmentType: "Contract",
        joinDate: today,
        email: `smoke-employee-${now}@test.local`,
        phone: "0812000000",
        address: "Jl Test",
        emergencyContact: "Smoke",
        emergencyPhone: "0812000001",
        salary: 5000000,
        status: "Active",
      },
    });
    assertStatus("POST /employees", createEmployee.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/employees/${employeeId}`, { token }); });

    const createAsset = await api("POST", "/assets", {
      token,
      body: {
        id: assetId,
        projectId: smokeProjectId,
        assetCode: assetId,
        name: "Smoke Asset",
        category: "Machine",
        location: "Warehouse",
        status: "Available",
        condition: "Good",
      },
    });
    assertStatus("POST /assets", createAsset.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/assets/${assetId}`, { token }); });

    const createPo = await api("POST", "/purchase-orders", {
      token,
      body: {
        id: poId,
        noPO: poId,
        tanggal: today,
        supplier: "Smoke Vendor",
        status: "Draft",
        total: 1000000,
        vendorId,
        items: [
          { id: "1", kode: "MAT-01", nama: "Material Smoke", qty: 1, unit: "Pcs", unitPrice: 1000000, total: 1000000 },
        ],
      },
    });
    assertStatus("POST /purchase-orders", createPo.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/purchase-orders/${poId}`, { token }); });

    const createReceiving = await api("POST", "/receivings", {
      token,
      body: {
        id: receivingId,
        noReceiving: receivingId,
        noPO: poId,
        poId,
        tanggal: today,
        supplier: "Smoke Vendor",
        project: "Smoke",
        status: "Pending",
        items: [],
      },
    });
    assertStatus("POST /receivings", createReceiving.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/receivings/${receivingId}`, { token }); });

    const createWorkOrder = await api("POST", "/work-orders", {
      token,
      body: {
        id: woId,
        woNumber: woId,
        projectId: smokeProjectId,
        projectName: smokeProjectName,
        itemToProduce: "Smoke Item",
        targetQty: 1,
        status: "Draft",
        priority: "Normal",
        deadline: today,
        leadTechnician: "Smoke Tech",
      },
    });
    assertStatus("POST /work-orders", createWorkOrder.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/work-orders/${woId}`, { token }); });

    const createStockOut = await api("POST", "/inventory/stock-outs", {
      token,
      body: {
        id: stockOutId,
        noStockOut: stockOutId,
        projectId: smokeProjectId,
        workOrderId: woId,
        noWorkOrder: woId,
        penerima: "Smoke",
        tanggal: today,
        type: "Project Issue",
        status: "Draft",
        createdBy: "smoke",
        items: [],
      },
    });
    assertStatus("POST /inventory/stock-outs", createStockOut.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/inventory/stock-outs/${stockOutId}`, { token }); });

    const createSuratJalan = await api("POST", "/surat-jalan", {
      token,
      body: {
        id: suratJalanId,
        noSurat: suratJalanId,
        projectId: smokeProjectId,
        tanggal: today,
        sjType: "Material Delivery",
        tujuan: "Smoke",
        alamat: "Smoke",
        items: [],
      },
    });
    assertStatus("POST /surat-jalan", createSuratJalan.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/surat-jalan/${suratJalanId}`, { token }); });

    const createMaterialRequest = await api("POST", "/material-requests", {
      token,
      body: {
        id: mrId,
        noRequest: mrId,
        projectId: smokeProjectId,
        projectName: smokeProjectName,
        requestedBy: "smoke",
        requestedAt: new Date().toISOString(),
        status: "Pending",
        items: [],
      },
    });
    assertStatus("POST /material-requests", createMaterialRequest.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/material-requests/${mrId}`, { token }); });

    const createAttendance = await api("POST", "/attendances", {
      token,
      body: {
        id: attendanceId,
        employeeId,
        employeeName: "Smoke Employee",
        date: today,
        status: "Present",
      },
    });
    assertStatus("POST /attendances", createAttendance.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/attendances/${attendanceId}`, { token }); });

    const createPayroll = await api("POST", "/payrolls", {
      token,
      body: {
        id: payrollId,
        employeeId,
        month: "March",
        year: 2026,
        totalPayroll: 1000000,
        status: "Pending",
        employeeCount: 1,
      },
    });
    assertStatus("POST /payrolls", createPayroll.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/payrolls/${payrollId}`, { token }); });

    const createVendorInvoice = await api("POST", "/finance/vendor-invoices", {
      token,
      body: {
        id: vendorInvoiceId,
        noInvoiceVendor: vendorInvoiceId,
        supplier: "Smoke Vendor",
        noPO: poId,
        vendorId,
        totalAmount: 1000000,
        paidAmount: 0,
        status: "Unpaid",
        jatuhTempo: today,
      },
    });
    assertStatus("POST /finance/vendor-invoices", createVendorInvoice.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/finance/vendor-invoices/${vendorInvoiceId}`, { token }); });

    const createVendorExpense = await api("POST", "/finance/vendor-expenses", {
      token,
      body: {
        id: vendorExpenseId,
        noExpense: vendorExpenseId,
        tanggal: today,
        vendorId,
        vendorName: "Smoke Vendor",
        kategori: "Service",
        keterangan: "Smoke Expense",
        nominal: 100000,
        totalNominal: 100000,
        hasKwitansi: false,
        metodeBayar: "Transfer",
        status: "Draft",
        createdBy: "smoke",
      },
    });
    assertStatus("POST /finance/vendor-expenses", createVendorExpense.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/finance/vendor-expenses/${vendorExpenseId}`, { token }); });

    const createCustomerInvoice = await api("POST", "/finance/customer-invoices", {
      token,
      body: {
        id: customerInvoiceId,
        noInvoice: customerInvoiceId,
        tanggal: today,
        dueDate: today,
        customerId,
        customerName: "Smoke Customer",
        perihal: "Smoke",
        items: [],
        subtotal: 0,
        ppn: 0,
        pph: 0,
        totalNominal: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        status: "Draft",
        paymentHistory: [],
        createdBy: "smoke",
      },
    });
    assertStatus("POST /finance/customer-invoices", createCustomerInvoice.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/finance/customer-invoices/${customerInvoiceId}`, { token }); });

    const createMaintenance = await api("POST", "/maintenances", {
      token,
      body: {
        id: maintenanceId,
        maintenanceNo: maintenanceId,
        equipmentName: "Smoke Asset",
        assetCode: assetId,
        assetId,
        maintenanceType: "Routine",
        status: "Scheduled",
        cost: 0,
        performedBy: "Smoke",
      },
    });
    assertStatus("POST /maintenances", createMaintenance.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/maintenances/${maintenanceId}`, { token }); });

    const createKasbon = await api("POST", "/hr/kasbons", {
      token,
      body: {
        id: kasbonId,
        employeeId,
        date: today,
        amount: 100000,
        status: "Draft",
      },
    });
    assertStatus("POST /hr/kasbons", createKasbon.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/hr/kasbons/${kasbonId}`, { token }); });

    const createFleetHealth = await api("POST", "/fleet-health", {
      token,
      body: {
        id: fleetHealthId,
        projectId: smokeProjectId,
        assetId,
        equipmentId: assetId,
        equipmentName: "Smoke Asset",
        date: today,
        hoursUsed: 6,
        operatorName: "Smoke Operator",
        costPerHour: 100000,
        status: "Ready",
      },
    });
    assertStatus("POST /fleet-health", createFleetHealth.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/fleet-health/${fleetHealthId}`, { token }); });

    const createPod = await api("POST", "/proof-of-delivery", {
      token,
      body: {
        id: podId,
        suratJalanId,
        workOrderId: woId,
        deliveredAt: new Date().toISOString(),
        receiverName: "Smoke Receiver",
        status: "Delivered",
      },
    });
    assertStatus("POST /proof-of-delivery", createPod.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/proof-of-delivery/${podId}`, { token }); });

    const createSpk = await api("POST", "/spk-records", {
      token,
      body: {
        id: spkId,
        workOrderId: woId,
        noSPK: spkId,
        tanggal: today,
        pekerjaan: "Smoke Work",
        status: "Active",
      },
    });
    assertStatus("POST /spk-records", createSpk.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/spk-records/${spkId}`, { token }); });

    const createAppSetting = await api("POST", "/app-settings", {
      token,
      body: {
        id: appSettingId,
        key: `setting.smoke.${now}`,
        label: "Smoke Setting",
        description: "Smoke testing settings endpoint",
        scope: "GLOBAL",
        value: { enabled: true, threshold: 10 },
        isActive: true,
      },
    });
    assertStatus("POST /app-settings", createAppSetting.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/app-settings/${appSettingId}`, { token }); });

    const createBankRecon = await api("POST", "/finance/bank-reconciliations", {
      token,
      body: {
        id: bankReconId,
        projectId: null,
        invoiceId: null,
        vendorInvoiceId,
        account: "BCA-GTP",
        description: `BANK-SMREL-${now}`,
        debit: 0,
        credit: 123000,
        balance: -123000,
        status: "Matched",
        date: today,
      },
    });
    assertStatus("POST /finance/bank-reconciliations", createBankRecon.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/finance/bank-reconciliations/${bankReconId}`, { token }); });

    const createPettyTxn = await api("POST", "/finance/petty-cash-transactions", {
      token,
      body: {
        id: pettyTxnId,
        date: today,
        employeeId,
        projectId: null,
        description: "Smoke petty txn",
        amount: 250000,
        type: "PETTY",
        source: "petty|accountCode=00000|direction=debit|kind=transaction",
      },
    });
    assertStatus("POST /finance/petty-cash-transactions", createPettyTxn.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/finance/petty-cash-transactions/${pettyTxnId}`, { token }); });

    const createSuratMasuk = await api("POST", "/surat-masuk", {
      token,
      body: {
        id: suratMasukId,
        noSurat: suratMasukId,
        tanggalTerima: today,
        tanggalSurat: today,
        pengirim: "Smoke",
        perihal: "Smoke",
        jenisSurat: "General",
        prioritas: "Normal",
        status: "Baru",
        penerima: "Smoke",
        kategori: "General",
      },
    });
    assertStatus("POST /surat-masuk", createSuratMasuk.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/surat-masuk/${suratMasukId}`, { token }); });

    const createSuratKeluar = await api("POST", "/surat-keluar", {
      token,
      body: {
        id: suratKeluarId,
        noSurat: suratKeluarId,
        tanggalSurat: today,
        tujuan: "Smoke",
        perihal: "Smoke",
        jenisSurat: "General",
        pembuat: "Smoke",
        status: "Draft",
        kategori: "General",
        templateId,
      },
    });
    assertStatus("POST /surat-keluar", createSuratKeluar.status, [201]);
    cleanup.push(async () => { await api("DELETE", `/surat-keluar/${suratKeluarId}`, { token }); });

    const patchVendorInvoiceValid = await api("PATCH", `/finance/vendor-invoices/${vendorInvoiceId}`, {
      token,
      body: {
        id: vendorInvoiceId,
        noInvoiceVendor: vendorInvoiceId,
        supplier: "Smoke Vendor Updated",
        noPO: poId,
        vendorId,
        totalAmount: 1500000,
        paidAmount: 0,
        status: "Unpaid",
        jatuhTempo: today,
      },
    });
    assertStatus("PATCH /finance/vendor-invoices valid vendorId", patchVendorInvoiceValid.status, [200]);

    const patchMaintenanceValid = await api("PATCH", `/maintenances/${maintenanceId}`, {
      token,
      body: {
        id: maintenanceId,
        maintenanceNo: maintenanceId,
        equipmentName: "Smoke Asset",
        assetCode: assetId,
        assetId,
        maintenanceType: "Routine",
        status: "In Progress",
        cost: 10000,
        performedBy: "Smoke Updated",
      },
    });
    assertStatus("PATCH /maintenances valid assetId", patchMaintenanceValid.status, [200]);

    const patchSuratKeluarValid = await api("PATCH", `/surat-keluar/${suratKeluarId}`, {
      token,
      body: {
        id: suratKeluarId,
        noSurat: suratKeluarId,
        tanggalSurat: today,
        tujuan: "Smoke Updated",
        perihal: "Smoke Updated",
        jenisSurat: "General",
        pembuat: "Smoke",
        status: "Draft",
        kategori: "General",
        templateId,
      },
    });
    assertStatus("PATCH /surat-keluar valid templateId", patchSuratKeluarValid.status, [200]);

    const patchAppSettingValid = await api("PATCH", `/app-settings/${appSettingId}`, {
      token,
      body: {
        id: appSettingId,
        key: `setting.smoke.${now}`,
        scope: "GLOBAL",
        value: { enabled: false, threshold: 12 },
      },
    });
    assertStatus("PATCH /app-settings", patchAppSettingValid.status, [200]);

    const patchBankReconValid = await api("PATCH", `/finance/bank-reconciliations/${bankReconId}`, {
      token,
      body: {
        id: bankReconId,
        vendorInvoiceId,
        account: "BCA-GTP",
        description: `BANK-SMREL-${now}-UPD`,
        debit: 0,
        credit: 123000,
        balance: -123000,
        status: "Matched",
        date: today,
      },
    });
    assertStatus("PATCH /finance/bank-reconciliations", patchBankReconValid.status, [200]);

    const patchPettyTxnValid = await api("PATCH", `/finance/petty-cash-transactions/${pettyTxnId}`, {
      token,
      body: {
        id: pettyTxnId,
        date: today,
        employeeId,
        description: "Smoke petty txn updated",
        amount: 300000,
        type: "PETTY",
        source: "petty|accountCode=00000|direction=debit|kind=transaction",
      },
    });
    assertStatus("PATCH /finance/petty-cash-transactions", patchPettyTxnValid.status, [200]);

    const invalidVendorInvoice = await api("POST", "/finance/vendor-invoices", {
      token,
      body: {
        id: `VINV-SMREL-BAD-${now}`,
        noInvoiceVendor: `VINV-SMREL-BAD-${now}`,
        supplier: "Bad Vendor",
        noPO: "NO-PO",
        vendorId: "VND-NOT-EXIST",
        totalAmount: 1,
        paidAmount: 0,
        status: "Unpaid",
        jatuhTempo: today,
      },
    });
    assertStatus("POST /finance/vendor-invoices invalid vendorId", invalidVendorInvoice.status, [400]);

    const invalidMaintenance = await api("POST", "/maintenances", {
      token,
      body: {
        id: `MNT-SMREL-BAD-${now}`,
        maintenanceNo: `MNT-SMREL-BAD-${now}`,
        equipmentName: "Bad Asset",
        assetCode: "BAD",
        assetId: "AST-NOT-EXIST",
        maintenanceType: "Routine",
        status: "Scheduled",
        cost: 0,
        performedBy: "Smoke",
      },
    });
    assertStatus("POST /maintenances invalid assetId", invalidMaintenance.status, [400]);

    const invalidPod = await api("POST", "/proof-of-delivery", {
      token,
      body: {
        id: `POD-SMREL-BAD-${now}`,
        suratJalanId: "SJ-NOT-EXIST",
        workOrderId: woId,
        deliveredAt: new Date().toISOString(),
      },
    });
    assertStatus("POST /proof-of-delivery invalid suratJalanId", invalidPod.status, [400]);

    const invalidSpk = await api("POST", "/spk-records", {
      token,
      body: {
        id: `SPK-SMREL-BAD-${now}`,
        workOrderId: "WO-NOT-EXIST",
        noSPK: `SPK-SMREL-BAD-${now}`,
        tanggal: today,
        pekerjaan: "Bad Work",
        status: "Active",
      },
    });
    assertStatus("POST /spk-records invalid workOrderId", invalidSpk.status, [400]);

    const invalidAppSetting = await api("POST", "/app-settings", {
      token,
      body: {
        id: `SET-SMREL-BAD-${now}`,
        key: `setting.bad.${now}`,
        scope: "GLOBAL",
        value: { enabled: true },
        updatedByUserId: "USR-NOT-EXIST-SMREL",
      },
    });
    assertStatus("POST /app-settings invalid updatedByUserId", invalidAppSetting.status, [400]);

    const invalidBankRecon = await api("POST", "/finance/bank-reconciliations", {
      token,
      body: {
        id: `BREC-SMREL-BAD-${now}`,
        invoiceId: "INV-NOT-EXIST",
        debit: 1,
      },
    });
    assertStatus("POST /finance/bank-reconciliations invalid invoiceId", invalidBankRecon.status, [400]);

    const invalidPettyTxn = await api("POST", "/finance/petty-cash-transactions", {
      token,
      body: {
        id: `PTTY-SMREL-BAD-${now}`,
        employeeId: "EMP-NOT-EXIST",
        amount: 1,
        date: today,
        description: "Invalid petty",
        source: "petty|accountCode=00000|direction=debit|kind=transaction",
      },
    });
    assertStatus("POST /finance/petty-cash-transactions invalid employeeId", invalidPettyTxn.status, [400]);

    const patchVendorInvoiceInvalid = await api("PATCH", `/finance/vendor-invoices/${vendorInvoiceId}`, {
      token,
      body: {
        id: vendorInvoiceId,
        noInvoiceVendor: vendorInvoiceId,
        supplier: "Bad Vendor",
        noPO: poId,
        vendorId: "VND-NOT-EXIST",
        totalAmount: 1500000,
        paidAmount: 0,
        status: "Unpaid",
        jatuhTempo: today,
      },
    });
    assertStatus("PATCH /finance/vendor-invoices invalid vendorId", patchVendorInvoiceInvalid.status, [400]);

    const patchMaintenanceInvalid = await api("PATCH", `/maintenances/${maintenanceId}`, {
      token,
      body: {
        id: maintenanceId,
        maintenanceNo: maintenanceId,
        equipmentName: "Bad Asset",
        assetCode: "BAD",
        assetId: "AST-NOT-EXIST",
        maintenanceType: "Routine",
        status: "In Progress",
        cost: 10000,
        performedBy: "Smoke",
      },
    });
    assertStatus("PATCH /maintenances invalid assetId", patchMaintenanceInvalid.status, [400]);

    const patchSuratKeluarInvalid = await api("PATCH", `/surat-keluar/${suratKeluarId}`, {
      token,
      body: {
        id: suratKeluarId,
        noSurat: suratKeluarId,
        tanggalSurat: today,
        tujuan: "Smoke Invalid",
        perihal: "Smoke Invalid",
        jenisSurat: "General",
        pembuat: "Smoke",
        status: "Draft",
        kategori: "General",
        templateId: "TPL-NOT-EXIST",
      },
    });
    assertStatus("PATCH /surat-keluar invalid templateId", patchSuratKeluarInvalid.status, [400]);
  } finally {
    for (const fn of cleanup.reverse()) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await fn();
      } catch {
        // ignore cleanup failure
      }
    }
  }

  console.log("\n[PASS] Smoke module relations completed.");
}

main().catch((err) => {
  console.error("\n[FAIL] Smoke module relations failed.");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
