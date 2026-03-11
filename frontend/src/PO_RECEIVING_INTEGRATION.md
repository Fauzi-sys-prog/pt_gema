# 🔗 Purchase Order ↔ Receiving Integration

## Overview
Sistem **integrasi penuh** antara **Purchase Order (PO)** dan **Receiving** dengan fitur auto-fill, auto-update status, navigation links, dan visual indicators yang memudahkan tracking material receipt dari PO.

---

## ✨ Features

### 1. **📦 Create Receiving from PO**
- **Tombol Package** (📦) di PO list untuk status "Sent" atau "Partial"
- **Auto-fill form** receiving dengan data PO:
  - No PO
  - Supplier
  - Project ID
  - All items (nama, qty, unit)
- **Support partial receiving** - bisa terima sebagian dulu

### 2. **🔄 Auto-Update PO Status**
- Ketika receiving dibuat, PO otomatis update:
  - **qtyReceived** untuk setiap item
  - **Status PO:**
    - `0% received` → Status tetap "Sent"
    - `1-99% received` → Status change to **"Partial"**
    - `100% received` → Status change to **"Received"**

### 3. **📊 Receiving History in PO Detail**
PO Detail Modal menampilkan section **Receiving History** dengan:
- **Progress bars** untuk setiap item (visual qty received/ordered)
- **List receiving documents** dengan:
  - No Receiving
  - Tanggal
  - Status badge (Complete/Partial/Pending)
  - Link "View" untuk navigate ke receiving list
- **Overall PO Status** badge

### 4. **🔗 Navigation Links**
#### From PO → Receiving:
- **Button Package** (📦) di PO list
- **Button "View"** di receiving history (dalam PO detail)
- Auto-navigate dengan highlight receiving row

#### From Receiving → PO:
- **Link No PO** (dengan icon 🔗) di receiving list
- Auto-navigate dengan highlight PO row

### 5. **👁️ Visual Indicators**
#### Di PO List:
- Badge showing: **"X receiving(s)"** dengan truck icon 🚚
- Color-coded status badges

#### Di Receiving List:
- Progress bar untuk setiap receiving
- Link to related PO
- Link to related Project

#### Di PO Detail:
- **Receiving History** section dengan gradient background
- Progress bars untuk each item
- Color-coded badges (green = complete, blue = partial)

---

## 🎯 User Flow

### Scenario 1: Create Receiving from PO
```
1. User di PO List
2. PO status = "Sent" → Button Package (📦) muncul
3. Click Package button
4. Navigate ke Receiving Page
5. Form auto-filled dengan data PO ✨
6. User input qty received untuk each item
7. Save receiving
8. PO auto-update status & qtyReceived ✨
9. Success message muncul
```

### Scenario 2: View PO from Receiving
```
1. User di Receiving List
2. Click No PO link (🔗 PO-2024-001)
3. Navigate ke PO Page
4. PO row auto-highlighted (yellow background) ✨
5. User can view PO detail
```

### Scenario 3: View Receiving History from PO
```
1. User buka PO Detail (Click Eye 👁️)
2. Scroll ke section "Receiving History"
3. Lihat progress bars untuk each item
4. Lihat list receiving documents
5. Click "View →" pada receiving document
6. Navigate ke Receiving Page
7. Receiving row auto-highlighted ✨
```

### Scenario 4: Partial Receiving (Multiple Receivings for 1 PO)
```
1. PO-2024-001: Order 1000 unit
2. Receiving 1: Terima 400 unit (40%)
   → PO status = "Partial"
   → Item qtyReceived = 400
3. Receiving 2: Terima 300 unit (30%)
   → PO status = "Partial"
   → Item qtyReceived = 700 (cumulative)
4. Receiving 3: Terima 300 unit (30%)
   → PO status = "Received" ✅
   → Item qtyReceived = 1000 (complete)
5. PO Detail shows 3 receiving documents
```

---

## 💻 Technical Implementation

### 1. Auto-Fill Receiving Form from PO

**PO Page (navigate with state):**
```tsx
<button
  onClick={() => {
    navigate('/purchasing/receiving', {
      state: {
        fromPO: true,
        poId: po.id,
        poNo: po.noPO,
        supplier: po.supplier,
        projectId: po.projectId,
        items: po.items,
      },
    });
  }}
>
  <Package size={18} />
</button>
```

**Receiving Page (useEffect to catch state):**
```tsx
useEffect(() => {
  if (locationState?.fromPO && locationState?.items) {
    setFormData({
      noPO: locationState.poNo || '',
      poId: locationState.poId || '',
      supplier: locationState.supplier || '',
      projectId: locationState.projectId || '',
      tanggal: new Date().toISOString().split('T')[0],
      notes: `Receiving untuk PO ${locationState.poNo}`,
    });

    const receivingItems: ReceivingItem[] = locationState.items.map((item, index) => ({
      id: `item-${index + 1}`,
      itemName: item.nama,
      qtyOrdered: item.qty,
      qtyReceived: 0,
      qtyPreviouslyReceived: item.qtyReceived || 0,
      unit: item.unit,
      condition: 'Good',
      notes: '',
    }));

    setItems(receivingItems);
    setShowModal(true);
  }
}, [locationState]);
```

### 2. Auto-Update PO Status

**Receiving Page (on save):**
```tsx
const handleSubmit = () => {
  // ... create receiving logic

  // Update PO status and qtyReceived
  if (formData.poId) {
    const po = poList.find(p => p.id === formData.poId);
    if (po) {
      // Update qtyReceived for each item
      const updatedItems = po.items.map(poItem => {
        const receivedItem = items.find(ri => ri.itemName === poItem.nama);
        if (receivedItem) {
          return {
            ...poItem,
            qtyReceived: (poItem.qtyReceived || 0) + receivedItem.qtyReceived,
          };
        }
        return poItem;
      });

      // Calculate PO status
      const poTotalOrdered = updatedItems.reduce((sum, item) => sum + item.qty, 0);
      const poTotalReceived = updatedItems.reduce((sum, item) => sum + (item.qtyReceived || 0), 0);
      const poReceivedPercentage = (poTotalReceived / poTotalOrdered) * 100;

      let poStatus: 'Draft' | 'Sent' | 'Partial' | 'Received' | 'Cancelled' = po.status;
      if (poReceivedPercentage >= 100) {
        poStatus = 'Received';
      } else if (poReceivedPercentage > 0) {
        poStatus = 'Partial';
      }

      updatePO(po.id, {
        items: updatedItems,
        status: poStatus,
      });
    }
  }
};
```

### 3. Receiving History Section (PO Detail)

```tsx
{/* Receiving History */}
{receivingList.filter(rcv => rcv.poId === selectedPO.id).length > 0 && (
  <div className="mb-6 print:hidden">
    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border-2 border-green-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">Receiving History</h3>
        <span className="badge">
          {receivingList.filter(rcv => rcv.poId === selectedPO.id).length} Receiving(s)
        </span>
      </div>

      {/* Progress Bars */}
      <div className="space-y-3">
        {selectedPO.items.map((item) => {
          const qtyReceived = item.qtyReceived || 0;
          const progress = (qtyReceived / item.qty) * 100;
          return (
            <div className="progress-item">
              <div className="flex justify-between">
                <span>{item.nama}</span>
                <span>{qtyReceived}/{item.qty} {item.unit}</span>
              </div>
              <div className="progress-bar">
                <div style={{ width: `${progress}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* List Receiving Docs */}
      <div className="space-y-2">
        {receivingList
          .filter(rcv => rcv.poId === selectedPO.id)
          .map(rcv => (
            <div className="receiving-card">
              <span>{rcv.noReceiving}</span>
              <button onClick={() => navigate('/purchasing/receiving')}>
                View →
              </button>
            </div>
          ))}
      </div>
    </div>
  </div>
)}
```

### 4. Navigation with Highlight

**Navigate from Receiving to PO:**
```tsx
<button
  onClick={() => navigate('/purchasing/purchase-order', {
    state: { highlightPO: receiving.poId }
  })}
>
  <LinkIcon /> {receiving.noPO}
</button>
```

**PO Page (handle highlight):**
```tsx
useEffect(() => {
  const state = location.state as { highlightPO?: string } | null;
  if (state?.highlightPO) {
    setHighlightedPOId(state.highlightPO);
    setTimeout(() => {
      const element = document.getElementById(`po-row-${state.highlightPO}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    setTimeout(() => setHighlightedPOId(null), 3000);
  }
}, [location.state]);
```

**PO Table Row:**
```tsx
<tr 
  id={`po-row-${po.id}`}
  className={highlightedPOId === po.id ? 'bg-yellow-100' : ''}
>
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      PROJECT MANAGEMENT                      │
│  BOQ Materials → Convert to PO → Navigate with BOQ data     │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                     PURCHASE ORDER (PO)                      │
│  • Create PO (manual or from BOQ)                           │
│  • Status: Draft → Sent → Partial → Received               │
│  • Button: Create Receiving (📦)                            │
│  • Show: Receiving History (if exists)                      │
└──────────────────────┬──────────────────────────────────────┘
                       ↓ (Click Package Button)
┌─────────────────────────────────────────────────────────────┐
│                        RECEIVING                             │
│  • Auto-fill form from PO data                              │
│  • Input qty received for each item                         │
│  • Save → Update PO (qtyReceived + status)                  │
│  • Link back to PO                                          │
└──────────────────────┬──────────────────────────────────────┘
                       ↓ (Auto-update)
┌─────────────────────────────────────────────────────────────┐
│                   PO STATUS UPDATED                          │
│  • qtyReceived cumulative                                    │
│  • Status auto-change based on % received                   │
│  • Receiving history visible in PO detail                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 UI Components

### PO List Table
```
┌─────────────────────────────────────────────────────────────┐
│ No PO        │ Date  │ Supplier   │ Total    │ Status      │
├─────────────────────────────────────────────────────────────┤
│ PO-2024-001  │ 20/01 │ PT Semen   │ Rp 100M  │ [Partial]   │
│              │       │            │          │ 🚚 2 recv.  │ ← Badge
├─────────────────────────────────────────────────────────────┤
│ PO-2024-002  │ 21/01 │ CV Besi    │ Rp 50M   │ [Sent]      │
│              │       │            │          │ 📦 Create   │ ← Button
└─────────────────────────────────────────────────────────────┘
```

### Receiving List Table
```
┌─────────────────────────────────────────────────────────────┐
│ No Recv.     │ No PO          │ Supplier   │ Progress      │
├─────────────────────────────────────────────────────────────┤
│ RCV-2024-001 │ 🔗 PO-2024-001 │ PT Semen   │ ████████ 80%  │
│              │    ↑ Link      │            │               │
└─────────────────────────────────────────────────────────────┘
```

### PO Detail - Receiving History Section
```
┌─────────────────────────────────────────────────────────────┐
│ 🚚 Receiving History                        2 Receiving(s)  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Semen Portland 50kg          800/1000 Sak                   │
│ ████████████████████░░░░░░░░ 80% received                   │
│                                                              │
│ Pasir Cor                    15/20 M3                       │
│ ███████████████░░░░░░░░░░░░░ 75% received                   │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Receiving Documents:                                        │
│                                                              │
│ 📦 RCV-2024-002    22/01/2024    [Partial]     View →      │
│ 📦 RCV-2024-001    20/01/2024    [Complete]    View →      │
│                                                              │
│ Overall PO Status:                            [Partial]     │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Integration Checklist

### PO Page:
- [x] Button Package (📦) untuk status Sent/Partial
- [x] Navigate dengan state data PO
- [x] Receiving history section di detail modal
- [x] Progress bars untuk each item
- [x] List receiving documents dengan links
- [x] Badge "X receiving(s)" di PO list
- [x] Handle highlight dari receiving page
- [x] Auto-scroll to highlighted row

### Receiving Page:
- [x] Auto-fill form dari PO navigation
- [x] Support partial receiving
- [x] Auto-update PO status on save
- [x] Auto-update qtyReceived cumulative
- [x] Link back to PO di receiving list
- [x] Link to Project (if exists)
- [x] ID row untuk highlight support

### AppContext:
- [x] receivingList available
- [x] updatePO function
- [x] Receiving type interface

---

## 🚀 Benefits

### 1. **Seamless Workflow**
- Satu click dari PO → Receiving form auto-filled
- No manual input supplier/items
- Save time & reduce errors

### 2. **Real-time Status Tracking**
- PO status auto-update berdasarkan receiving
- Visual progress bars untuk monitoring
- Clear visibility: berapa yang sudah diterima

### 3. **Full Traceability**
- Bisa lihat receiving history dari PO
- Bisa trace back ke PO dari receiving
- Complete audit trail

### 4. **Partial Receiving Support**
- Bisa terima material secara bertahap
- Multiple receivings untuk 1 PO
- Status otomatis adjust

### 5. **User-Friendly Navigation**
- Link navigation antar pages
- Auto-highlight target row
- Auto-scroll untuk visibility

---

## 📝 Modified Files

1. **`/pages/purchasing/PurchaseOrderPage.tsx`**
   - Added: TruckIcon import
   - Added: receivingList from useApp
   - Added: Receiving History section in detail modal
   - Added: Progress bars for each item
   - Added: List receiving documents
   - Added: Badge "X receiving(s)" in PO list

2. **`/pages/purchasing/ReceivingPage.tsx`**
   - Added: ID `rcv-row-${id}` for highlight support
   - Existing: Auto-fill from PO navigation
   - Existing: Auto-update PO on save
   - Existing: Link to PO in receiving list

3. **`/contexts/AppContext.tsx`**
   - Existing: receivingList, Receiving interface
   - Existing: updatePO function

---

## 🎉 Summary

| Feature | Status | Description |
|---------|--------|-------------|
| Create Receiving from PO | ✅ | Button Package di PO list → auto-fill form |
| Auto-update PO Status | ✅ | Status berubah otomatis saat receiving dibuat |
| Receiving History | ✅ | Tampil di PO detail dengan progress bars |
| Navigation PO ↔ Receiving | ✅ | Link bolak-balik dengan auto-highlight |
| Visual Indicators | ✅ | Badge, progress bars, color-coded status |
| Partial Receiving | ✅ | Support multiple receivings untuk 1 PO |
| Cumulative qtyReceived | ✅ | Total received dari semua receivings |

**Purchase Order dan Receiving sekarang fully integrated dengan seamless navigation dan real-time tracking!** 🔗✨
