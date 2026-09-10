const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'test-db');
assert.equal(target.pathname, '/koperasi_test');
assert.equal(process.env.NODE_ENV, 'test');
const express = require('express');
const { prisma } = require('../dist/prisma');
const { koperasiRouter } = require('../dist/routes/koperasi');
const { signAccessToken } = require('../dist/utils/token');
let server, base, token;
before(async () => {
  assert.equal((await prisma.$queryRawUnsafe('SELECT current_database() AS name'))[0].name, 'koperasi_test');
  token = signAccessToken(await prisma.user.create({ data: { id:'test-owner', email:'owner@test.invalid', username:'test-owner', password:'unused', role:'OWNER' } }));
  await prisma.$executeRawUnsafe(`CREATE FUNCTION test_delay() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.15); RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER test_delay BEFORE UPDATE ON "KoperasiPinjaman" FOR EACH ROW EXECUTE FUNCTION test_delay()`);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION test_cash_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."referenceId" LIKE 'cash-fail%' THEN RAISE EXCEPTION 'injected cash failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER test_cash_failure BEFORE INSERT ON "KoperasiCashTransaction" FOR EACH ROW EXECUTE FUNCTION test_cash_failure()`);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityId" LIKE 'audit-fail%' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER test_audit_failure BEFORE INSERT ON "AuditLogEntry" FOR EACH ROW EXECUTE FUNCTION test_audit_failure()`);
  const app = express(); app.use(express.json()); app.use(koperasiRouter);
  server = await new Promise(resolve => { const s=app.listen(0,'127.0.0.1',()=>resolve(s)); });
  base=`http://127.0.0.1:${server.address().port}/koperasi/`;
});
after(async()=>{ if(server) await new Promise(resolve=>server.close(resolve)); await prisma.$disconnect(); });
async function post(path, body={}) {
  const r=await fetch(base+path,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
  return {status:r.status,body:await r.json()};
}
async function fixture(id, count=3) {
  await prisma.employeeRecord.create({data:{id,employeeId:id,name:id,position:'Test',department:'Test',employmentType:'Permanent',joinDate:'2026-01-01',status:'Active'}});
  await prisma.koperasiMember.create({data:{id,memberNo:id,employeeId:id,employeeName:id,joinDate:new Date()}});
  await prisma.koperasiPinjaman.create({data:{id,pinjamanNo:id,memberId:id,memberName:id,amount:300,totalAmount:330,installmentCount:count,installmentAmount:330/count,requestDate:new Date(),status:'Active'}});
}
const loan=id=>prisma.koperasiPinjaman.findUniqueOrThrow({where:{id}});
const entity=(resource,entityId)=>prisma.appEntity.findUniqueOrThrow({where:{resource_entityId:{resource,entityId}}});
async function payroll(id, employee) {
  await prisma.appEntity.create({data:{resource:'hr-payroll-runs',entityId:id,payload:{status:'Approved',period:'2026-09',slips:[{employeeId:employee}]}}});
  await prisma.appEntity.create({data:{resource:'hr-employee-advances',entityId:id,payload:{employeeId:employee,status:'Disbursed',remainingBalanceAfter:200,installmentAmount:50,paidInstallments:0}}});
  return {period:'2026-09',run:{status:'Disbursed',period:'2026-09',slips:[{employeeId:employee}]}};
}
test('concurrent same installment and replay post only once',async()=>{
  await fixture('manual',1);
  const results=await Promise.all([1,1].map(installmentNumber=>post('pinjaman/manual/installments',{installmentNumber})));
  assert.deepEqual(results.map(r=>r.status),[200,200],JSON.stringify(results));
  assert.equal((await post('pinjaman/manual/installments',{installmentNumber:1})).status,200);
  assert.equal((await loan('manual')).paidInstallments,1);
  assert.equal((await loan('manual')).status,'Settled');
  assert.equal(await prisma.koperasiCashTransaction.count({where:{referenceId:'manual'}}),2);
});
test('missing and out-of-sequence installment rejected without writes',async()=>{
  await fixture('sequence');
  assert.equal((await post('pinjaman/sequence/installments')).status,400);
  assert.equal((await post('pinjaman/sequence/installments',{installmentNumber:2})).status,409);
  assert.equal((await loan('sequence')).paidInstallments,0);
  assert.equal(await prisma.koperasiCashTransaction.count({where:{referenceId:'sequence'}}),0);
});
test('cash insert failure rolls back manual installment',async()=>{
  await fixture('cash-fail-manual');
  assert.ok((await post('pinjaman/cash-fail-manual/installments',{installmentNumber:1})).status>=400);
  assert.equal((await loan('cash-fail-manual')).paidInstallments,0);
  assert.equal(await prisma.koperasiCashTransaction.count({where:{referenceId:'cash-fail-manual'}}),0);
});
test('concurrent payroll and replay cannot double-deduct loan or advance',async()=>{
  await fixture('payroll-loan'); const body=await payroll('payroll-run','payroll-loan');
  const results=await Promise.all([1,2].map(()=>post('payroll-runs/payroll-run/post',body)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400],JSON.stringify(results));
  assert.equal((await post('payroll-runs/payroll-run/post',body)).status,400);
  assert.equal((await loan('payroll-loan')).paidInstallments,1);
  assert.equal((await entity('hr-employee-advances','payroll-run')).payload.remainingBalanceAfter,150);
  assert.equal((await entity('hr-payroll-runs','payroll-run')).payload.status,'Disbursed');
  assert.equal(await prisma.koperasiCashTransaction.count({where:{referenceId:'payroll-run:payroll-loan'}}),2);
  assert.equal(await prisma.auditLogEntry.count({where:{entityId:'payroll-run'}}),1);
});
test('late audit failure rolls back payroll, advance, loan and cash together',async()=>{
  await fixture('rollback-loan'); const body=await payroll('audit-fail-run','rollback-loan');
  assert.equal((await post('payroll-runs/audit-fail-run/post',body)).status,400);
  assert.equal((await loan('rollback-loan')).paidInstallments,0);
  assert.equal((await entity('hr-employee-advances','audit-fail-run')).payload.remainingBalanceAfter,200);
  assert.equal((await entity('hr-payroll-runs','audit-fail-run')).payload.status,'Approved');
  assert.equal(await prisma.koperasiCashTransaction.count({where:{referenceId:'audit-fail-run:rollback-loan'}}),0);
  assert.equal(await prisma.auditLogEntry.count({where:{entityId:'audit-fail-run'}}),0);
});
