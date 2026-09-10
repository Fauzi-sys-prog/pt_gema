import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { assertFinancialYearsOpen, financialYearsFromValue } from "../middlewares/financialYearLock";

type CustomerPayment = { tanggal?: string | Date; nominal: number; method?: string; proofNo?: string; bankName?: string; remark?: string; createdBy?: string; idempotencyKey?: string };
type VendorPayment = { tanggal?: string | Date; nominal: number; metodeBayar?: string; noBukti?: string; bank?: string; noRekening?: string; keterangan?: string; idempotencyKey?: string };

const asDate = (v?: string | Date) => v instanceof Date ? v : new Date(v || Date.now());
const amount = (v: number) => Number.isFinite(v) && v > 0 ? v : 0;

export async function receiveCustomerInvoicePayment(invoiceId: string, payment: CustomerPayment, actor?: { userId?: string; role?: string }) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.financeCustomerInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new Error("Invoice tidak ditemukan");
    const arPayable = ["Approved", "Unpaid", "Partially Paid", "Partial", "Overdue", "Sent"];
    if (!arPayable.includes(invoice.status)) {
      throw new Error("Invoice belum disetujui dan tidak boleh dibayar");
    }
    await assertFinancialYearsOpen(tx, financialYearsFromValue({
      tanggal: asDate(payment.tanggal).toISOString(),
      date: invoice.tanggal.toISOString(),
    }));
    const nominal = amount(payment.nominal);
    if (!nominal) throw new Error("Nominal pembayaran harus lebih besar dari nol");
    const proof = payment.proofNo || payment.idempotencyKey;
    if (proof) {
      const duplicate = await tx.financeCustomerInvoicePayment.findFirst({ where: { invoiceId, proofNo: proof } });
      if (duplicate) return invoice;
    }
    const newPaid = invoice.paidAmount + nominal;
    if (newPaid > invoice.totalAmount) throw new Error("Pembayaran melebihi total invoice");
    const arPaymentId = randomUUID();
    await tx.financeCustomerInvoicePayment.create({ data: { id: arPaymentId, invoiceId, tanggal: asDate(payment.tanggal), nominal, method: payment.method || "Transfer", proofNo: proof, bankName: payment.bankName, remark: payment.remark, createdBy: payment.createdBy, paidAt: new Date() } });
    if ((payment.method || "Transfer").toLowerCase() !== "cash") {
      await tx.financeBankReconciliation.create({ data: {
        id: `BANKREC-CPAY-${arPaymentId}`,
        customerInvoiceId: invoiceId,
        date: asDate(payment.tanggal),
        periodLabel: asDate(payment.tanggal).toISOString().slice(0, 7),
        account: String(payment.bankName || "Bank"),
        description: `Penerimaan dari ${invoice.customerName || "Customer"} — ${invoice.number || invoiceId}`,
        debit: nominal,
        credit: 0,
        balance: 0,
        status: "Posted",
        note: payment.remark ? String(payment.remark) : null,
        sourceType: "AR_PAYMENT",
        sourceId: arPaymentId,
      } });
    }
    const outstanding = invoice.totalAmount - newPaid;
    const status = outstanding <= 0 ? "Paid" : "Partial";
    const updated = await tx.financeCustomerInvoice.update({ where: { id: invoiceId }, data: { paidAmount: newPaid, outstandingAmount: outstanding, status, tanggalBayar: outstanding <= 0 ? new Date() : invoice.tanggalBayar } });
    await tx.auditLogEntry.create({ data: { id: randomUUID(), timestamp: new Date(), action: "FINANCE_PAYMENT", domain: "finance", actorUserId: actor?.userId || null, actorRole: actor?.role || null, userId: actor?.userId || null, module: "Finance", details: `Customer invoice payment ${invoiceId}`, status: "Success", resource: "customer-invoices", entityId: invoiceId, operation: "payment", metadata: JSON.stringify({ nominal, proofNo: proof }) } });
    return updated;
  });
}

export async function payVendorInvoice(invoiceId: string, payment: VendorPayment, actor?: { userId?: string; role?: string }) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.financeVendorInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new Error("Vendor invoice tidak ditemukan");
    const payable = ["Approved", "Unpaid", "Partially Paid", "Partial", "Overdue"];
    if (!payable.includes(invoice.status)) {
      throw new Error("Invoice vendor belum disetujui dan tidak boleh dibayar");
    }
    await assertFinancialYearsOpen(tx, financialYearsFromValue({
      tanggal: asDate(payment.tanggal).toISOString(),
      date: invoice.tanggal?.toISOString(),
    }));
    const nominal = amount(payment.nominal);
    if (!nominal) throw new Error("Nominal pembayaran harus lebih besar dari nol");
    const proof = payment.noBukti || payment.idempotencyKey;
    if (proof) {
      const duplicate = await tx.financeVendorInvoicePayment.findFirst({ where: { vendorInvoiceId: invoiceId, noBukti: proof } });
      if (duplicate) return invoice;
    }
    const newPaid = invoice.paidAmount + nominal;
    if (newPaid > invoice.totalAmount) throw new Error("Pembayaran melebihi total invoice vendor");
    const apPaymentId = randomUUID();
    await tx.financeVendorInvoicePayment.create({ data: { id: apPaymentId, vendorInvoiceId: invoiceId, tanggal: asDate(payment.tanggal), nominal, metodeBayar: payment.metodeBayar || "Transfer", noBukti: proof, bank: payment.bank, noRekening: payment.noRekening, keterangan: payment.keterangan } });
    if ((payment.metodeBayar || "Transfer").toLowerCase() !== "cash") {
      await tx.financeBankReconciliation.create({ data: {
        id: `BANKREC-VPAY-${apPaymentId}`,
        vendorInvoiceId: invoiceId,
        date: asDate(payment.tanggal),
        periodLabel: asDate(payment.tanggal).toISOString().slice(0, 7),
        account: String(payment.bank || "Bank"),
        description: `Pembayaran ke ${invoice.supplierName || "Vendor"} — ${invoice.number || invoiceId}`,
        debit: 0,
        credit: nominal,
        balance: 0,
        status: "Posted",
        note: payment.keterangan ? String(payment.keterangan) : null,
        sourceType: "AP_PAYMENT",
        sourceId: apPaymentId,
      } });
    }
    const outstanding = invoice.totalAmount - newPaid;
    const updated = await tx.financeVendorInvoice.update({ where: { id: invoiceId }, data: { paidAmount: newPaid, outstandingAmount: outstanding, status: outstanding <= 0 ? "Paid" : "Partially Paid" } });
    await tx.auditLogEntry.create({ data: { id: randomUUID(), timestamp: new Date(), action: "FINANCE_PAYMENT", domain: "finance", actorUserId: actor?.userId || null, actorRole: actor?.role || null, userId: actor?.userId || null, module: "Finance", details: `Vendor invoice payment ${invoiceId}`, status: "Success", resource: "vendor-invoices", entityId: invoiceId, operation: "payment", metadata: JSON.stringify({ nominal, proofNo: proof }) } });
    return updated;
  });
}
