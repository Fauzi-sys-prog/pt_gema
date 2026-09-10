const { PrismaClient } = require('@prisma/client');
const assert = require('node:assert/strict');
const { quotationSellingOnly } = require('../dist/utils/quotationSellingOnly');
const db = new PrismaClient();
async function run() {
  assert.deepEqual(quotationSellingOnly({qty:2, hargaUnit:50, total:100, hargaJualUnit:80, hargaJual:160, grossProfit:60}), {qty:2,hargaJualUnit:80,hargaJual:160});
  const result = await db.$transaction(async tx => {
    const financialBefore = await tx.$queryRawUnsafe('SELECT id, "grandTotal", "grandTotalWithTax", "totalSelling", discount FROM "Quotation" ORDER BY id');
    const counts = {};
    for (const [table, column, where] of [
      ['Quotation','payload',''], ['QuotationSection','payload',''],
      ['QuotationItem','payload',''], ['QuotationRevision','snapshot',''],
      ['AppEntity','payload'," WHERE resource = 'quotations'"],
    ]) {
      const rows = await tx.$queryRawUnsafe(`SELECT id, "${column}" AS data FROM "${table}"${where}`);
      counts[table] = rows.length;
      for (const row of rows) {
        const clean = quotationSellingOnly(row.data);
        await tx.$executeRawUnsafe(`UPDATE "${table}" SET "${column}" = $1::jsonb WHERE id = $2`, JSON.stringify(clean), row.id);
      }
    }
    await tx.$executeRawUnsafe('ALTER TABLE "Quotation" DROP COLUMN IF EXISTS "totalCost", DROP COLUMN IF EXISTS "grossProfit", DROP COLUMN IF EXISTS "marginPercent"');
    await tx.$executeRawUnsafe('ALTER TABLE "QuotationItem" DROP COLUMN IF EXISTS "costPerUnit", DROP COLUMN IF EXISTS "totalCost"');
    const financialAfter = await tx.$queryRawUnsafe('SELECT id, "grandTotal", "grandTotalWithTax", "totalSelling", discount FROM "Quotation" ORDER BY id');
    assert.deepEqual(financialAfter, financialBefore, 'Selling totals must remain unchanged');
    return counts;
  }, {timeout:120000});
  console.log(JSON.stringify({status:'migrated', processed:result, sellingTotals:'unchanged'}));
}
run().finally(()=>db.$disconnect()).catch(e=>{console.error(e);process.exitCode=1;});
