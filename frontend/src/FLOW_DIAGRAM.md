# 📊 FLOW DIAGRAM: Auto-Create Project System

## 🔄 STATUS WORKFLOW

```
┌─────────────────────────────────────────────────────────────┐
│                     QUOTATION LIFECYCLE                      │
└─────────────────────────────────────────────────────────────┘

    [CREATE]
       │
       ▼
  ┌─────────┐     📧 Send Button
  │  DRAFT  │────────────────────┐
  └─────────┘                    │
       │                         ▼
       │                    ┌─────────┐
       │                    │  SENT   │
       │                    └─────────┘
       │                         │
       │         ┌───────────────┴────────────────┐
       │         │                                │
       │         ▼                                ▼
       │    ┌──────────┐                    ┌──────────┐
       │    │ APPROVED │ ✅                 │ REJECTED │ ❌
       │    └──────────┘                    └──────────┘
       │         │                                │
       │         │ AUTO-CREATE!                   │
       │         ▼                                │
       │    ┌──────────┐                         │
       │    │ PROJECT  │ 🚀                      │
       │    │ CREATED  │                         │
       │    └──────────┘                         │
       │                                         │
       └─────────────────────────────────────────┘
                    DELETE (Draft/Rejected only)
```

---

## 🎯 BUTTON STATES

### Draft Status:
```
┌────────────────────────────────────────────────────┐
│  View   Edit   Print   📧Send   Delete            │
│   👁️     ✏️     🖨️      📧       🗑️              │
└────────────────────────────────────────────────────┘
```

### Sent Status:
```
┌────────────────────────────────────────────────────┐
│  View   Edit   Print   ✅Approve  ❌Reject  Delete│
│   👁️     ✏️     🖨️      ✅        ❌       🗑️    │
└────────────────────────────────────────────────────┘
```

### Approved Status:
```
┌────────────────────────────────────────────────────┐
│  View   Edit   Print   [✅ Project Badge]         │
│   👁️     ✏️     🖨️      ✅ Project                │
│                                                    │
│  ⚠️ Delete button HIDDEN (Data Protection)        │
└────────────────────────────────────────────────────┘
```

### Rejected Status:
```
┌────────────────────────────────────────────────────┐
│  View   Edit   Print   Delete                     │
│   👁️     ✏️     🖨️      🗑️                        │
└────────────────────────────────────────────────────┘
```

---

## 🏗️ AUTO-CREATE PROJECT LOGIC

```
┌─────────────────────────────────────────────────────┐
│           USER CLICKS "APPROVE" BUTTON              │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│   Show Confirmation Dialog with:                    │
│   • Quotation Number                               │
│   • Customer Name                                  │
│   • Total Value (formatted)                        │
│   • Warning: "Project akan otomatis dibuat!"       │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
            User Confirms? (Yes/No)
                        │
         ┌──────────────┴──────────────┐
         │ NO                           │ YES
         ▼                              ▼
    ┌────────┐            ┌──────────────────────────┐
    │ CANCEL │            │ Update Quotation Status  │
    └────────┘            │ status = "Approved"      │
                          └──────────────────────────┘
                                      │
                                      ▼
                          ┌──────────────────────────┐
                          │ TRIGGER AUTO-CREATE      │
                          │ (in AppContext)          │
                          └──────────────────────────┘
                                      │
        ┌─────────────────────────────┴──────────────────────────┐
        │                                                         │
        ▼                                                         ▼
┌───────────────────┐                                  ┌──────────────────┐
│ 1. VALIDATION     │                                  │ 2. CALCULATION   │
│ ✓ Check not      │                                  │ • Materials      │
│   already         │                                  │ • Manpower       │
│   approved        │                                  │ • Consumables    │
│ ✓ Check no        │                                  │ • Equipment      │
│   projectId yet   │                                  │ ─────────────    │
└───────────────────┘                                  │ Subtotal + PPN   │
                                                       │ = Nilai Kontrak  │
                                                       └──────────────────┘
                                      │
                                      ▼
                          ┌──────────────────────────┐
                          │ 3. CREATE PROJECT        │
                          │ • Generate kode project  │
                          │ • Copy customer info     │
                          │ • Set nilai kontrak      │
                          │ • Transfer BOQ data:     │
                          │   - Materials (actual=   │
                          │     plan qty)            │
                          │   - Manpower             │
                          │   - Consumables          │
                          │   - Equipment            │
                          │ • Set quotationId        │
                          │ • Status: "Planning"     │
                          └──────────────────────────┘
                                      │
                                      ▼
                          ┌──────────────────────────┐
                          │ 4. TWO-WAY LINK          │
                          │ Project.quotationId ──┐  │
                          │                       │  │
                          │ Quotation.projectId ◄─┘  │
                          └──────────────────────────┘
                                      │
                                      ▼
                          ┌──────────────────────────┐
                          │ 5. SUCCESS!              │
                          │ • Show success alert     │
                          │ • Badge "✅ Project"     │
                          │   appears in table       │
                          │ • Project in list        │
                          └──────────────────────────┘
```

---

## 🔗 DATA RELATIONSHIP

```
┌──────────────────────────────────────────────────────────┐
│                  TWO-WAY RELATIONSHIP                     │
└──────────────────────────────────────────────────────────┘

        QUOTATION                          PROJECT
┌─────────────────────┐          ┌─────────────────────┐
│ id: "QUO-001"       │          │ id: "PRJ-001"       │
│ nomorQuotation      │          │ kodeProject         │
│ customer: {         │ ◄────┐   │ namaProject         │
│   nama: "PT ABC"    │      │   │ customer: "PT ABC"  │
│   alamat: "..."     │      │   │ nilaiKontrak        │
│ }                   │      │   │ status: "Planning"  │
│ materials: [...]    │      │   │ boq: [...]          │
│ manpower: [...]     │      │   │                     │
│ status: "Approved"  │      │   │ quotationId: ────┐  │
│                     │      │   │   "QUO-001"      │  │
│ projectId: ─────────┼──────┘   └──────────────────┼──┘
│   "PRJ-001"         │                             │
└─────────────────────┘                             │
          │                                         │
          └─────────────────────────────────────────┘
                    LINKED RELATIONSHIP
```

---

## 📋 DATA TRANSFER MAP

```
FROM QUOTATION                TO PROJECT
═══════════════════           ═══════════════════

nomorQuotation                (reference only)
perihal                   →   namaProject
customer.nama            →   customer
customer.alamat          →   (customer detail)
customer.pic             →   (customer PIC)

CALCULATIONS:
materials.totalPrice     ┐
+ manpower.totalCost     │
+ consumables.totalCost  ├──→  nilaiKontrak
+ equipment.totalCost    │
+ PPN                    ┘

BOQ TRANSFER:
materials []             →   boq [] (with actualQty)
  - materialName              - materialName
  - quantity (→ qtyPlan)      - qtyPlan
  - unit                      - unit
  - unitPrice                 - unitPrice
  - (new: qtyActual)          - qtyActual = qtyPlan
  - (new: supplier)           - supplier = ""
  - (new: status)             - status = "Not Ordered"

manpower []              →   (transferred as-is)
consumables []           →   (transferred as-is)
equipment []             →   (transferred as-is)

METADATA:
id                       →   quotationId
status: "Approved"       →   (trigger)
                         ←   projectId (created)
```

---

## 🎬 USER JOURNEY

```
👤 USER STORY: "Saya ingin quotation yang diapprove otomatis jadi project"

STEP 1: Create Quotation
┌─────────────────────────────────────┐
│  📝 Isi form quotation              │
│  💰 Tambah materials + harga        │
│  👷 Tambah manpower + cost          │
│  📦 Tambah consumables & equipment  │
│  💾 Save sebagai Draft              │
└─────────────────────────────────────┘
         ↓ (takes 5 minutes)

STEP 2: Send to Customer
┌─────────────────────────────────────┐
│  📧 Klik tombol "Send"              │
│  ✅ Confirm dialog                  │
│  📤 Status → "Sent"                 │
└─────────────────────────────────────┘
         ↓ (takes 5 seconds)

STEP 3: Approve Quotation
┌─────────────────────────────────────┐
│  ✅ Klik tombol "Approve"           │
│  👁️ Review confirmation:            │
│     - Customer name                 │
│     - Total value                   │
│  ✅ Confirm                         │
└─────────────────────────────────────┘
         ↓ (INSTANT! < 1 second)

STEP 4: Magic Happens! ✨
┌─────────────────────────────────────┐
│  🎉 Success message                 │
│  ✅ Badge "Project" appears         │
│  🚀 Project auto-created            │
│  📊 All data transferred            │
└─────────────────────────────────────┘
         ↓

STEP 5: Verify & Start Execution
┌─────────────────────────────────────┐
│  📂 Open Project Management         │
│  👀 See new project in list         │
│  🔍 Click "Detail" to verify        │
│  ✅ All data perfect!               │
│  🏗️ Ready to execute!               │
└─────────────────────────────────────┘

TOTAL TIME: ~5 minutes (manual) + < 1 second (auto)
EFFORT SAVED: ~30 minutes of manual data entry! 🎯
```

---

## 🎨 UI STATES DIAGRAM

```
╔═══════════════════════════════════════════════════════════╗
║             QUOTATION TABLE ROW STATES                    ║
╚═══════════════════════════════════════════════════════════╝

STATE 1: DRAFT (Initial)
┌───────────────────────────────────────────────────────────┐
│ QUO-001 │ PT ABC │ Rp 100M │ [Draft] │ 👁️ ✏️ 🖨️ 📧 🗑️  │
└───────────────────────────────────────────────────────────┘

STATE 2: SENT (After Send)
┌───────────────────────────────────────────────────────────┐
│ QUO-001 │ PT ABC │ Rp 100M │ [Sent] │ 👁️ ✏️ 🖨️ ✅ ❌ 🗑️│
└───────────────────────────────────────────────────────────┘

STATE 3: APPROVED (After Approve)
┌───────────────────────────────────────────────────────────┐
│ QUO-001 │ PT ABC │ Rp 100M │ [Approved] │ 👁️ ✏️ 🖨️ ✅Project│
│                                                  Badge →  │
└───────────────────────────────────────────────────────────┘

STATE 4: REJECTED (If Rejected)
┌───────────────────────────────────────────────────────────┐
│ QUO-001 │ PT ABC │ Rp 100M │ [Rejected] │ 👁️ ✏️ 🖨️ 🗑️    │
└───────────────────────────────────────────────────────────┘
```

---

**Legend:**
- 👁️ = View Detail
- ✏️ = Edit
- 🖨️ = Print
- 📧 = Send
- ✅ = Approve
- ❌ = Reject
- 🗑️ = Delete
- ✅Project = Badge (Project Created)

**Color Coding:**
- 📧 Send = Purple
- ✅ Approve = Green
- ❌ Reject = Red
- 🗑️ Delete = Red
- ✅Project Badge = Green background

---

**End of Flow Diagram** 🎯
