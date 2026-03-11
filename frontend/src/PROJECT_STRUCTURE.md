# 📁 Project Structure Documentation

Complete guide to the ERP System project structure.

---

## 📋 Root Directory

```
/
├── .gitignore              # Git ignore rules
├── App.tsx                 # Main application component & routing
├── Attributions.md         # Third-party attributions
├── CHANGELOG.md            # Version history and changes
├── CONTRIBUTING.md         # Contribution guidelines
├── README.md               # Project overview
│
├── components/             # Reusable components
├── contexts/               # React Context providers
├── guidelines/             # Development guidelines
├── pages/                  # Page components
├── styles/                 # Global styles
└── utils/                  # Utility functions
```

---

## 🧩 Components Directory

```
components/
│
├── Layout.tsx                      # Main layout with sidebar
├── ProtectedRoute.tsx              # Authentication wrapper
│
├── dashboard/                      # Dashboard components
│   └── ProjectDetailModal.tsx
│
├── data-collection/                # Data collection components
│   ├── ManpowerModal.tsx          # Manpower CRUD modal
│   ├── ScheduleModal.tsx          # Schedule CRUD modal
│   ├── ConsumableModal.tsx        # Consumable CRUD modal
│   └── EquipmentModal.tsx         # Equipment CRUD modal
│
├── project/                        # Project components
│   └── BOQMaterialModal.tsx       # BOQ Material modal
│
├── mobile/                         # Mobile-optimized components
│   ├── BottomSheet.tsx
│   ├── MobileCard.tsx
│   ├── MobileTable.tsx
│   ├── ResponsiveView.tsx
│   └── StatsCard.tsx
│
├── figma/                          # Figma integration
│   └── ImageWithFallback.tsx      # Protected component
│
└── ui/                             # Reusable UI components (50+ components)
    ├── accordion.tsx
    ├── alert-dialog.tsx
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    ├── form.tsx
    ├── input.tsx
    ├── select.tsx
    ├── table.tsx
    └── ... (40+ more components)
```

### 📦 Component Usage Examples

**Layout:**
```typescript
import Layout from './components/Layout';
<Layout>{children}</Layout>
```

**Modals:**
```typescript
import { ManpowerModal } from './components/data-collection/ManpowerModal';
<ManpowerModal 
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onSave={handleSave}
  initialData={data}
/>
```

---

## 🎯 Contexts Directory

```
contexts/
│
├── AppContext.tsx          # Global application state
│   ├── All data lists (quotations, projects, etc.)
│   ├── CRUD operations
│   ├── Business logic
│   └── Data transformations
│
└── AuthContext.tsx         # Authentication state
    ├── Login/logout
    ├── Current user
    ├── Role permissions
    └── Session management
```

### 🔌 Context Usage

```typescript
// AppContext
import { useApp } from './contexts/AppContext';
const { quotationList, addQuotation, deleteQuotation } = useApp();

// AuthContext
import { useAuth } from './contexts/AuthContext';
const { currentUser, login, logout } = useAuth();
```

---

## 📄 Pages Directory

```
pages/
│
├── LoginPage.tsx                   # Login page
├── ProjectQuotationPage.tsx        # Quotation management
├── ProjectManagementPage.tsx       # Project management
│
├── dashboard/
│   └── MainDashboard.tsx          # Main dashboard
│
├── data-collection/
│   └── DataCollection.tsx         # Data collection page
│
├── sales/                          # Sales module
│   ├── PenawaranPage.tsx
│   ├── RABProjectPage.tsx
│   ├── ProjectPage.tsx
│   └── InvoicePage.tsx
│
├── purchasing/                     # Purchasing module
│   ├── PurchaseOrderPage.tsx
│   └── ReceivingPage.tsx
│
├── inventory/                      # Inventory module
│   ├── StockInPage.tsx
│   ├── StockOutPage.tsx
│   └── StockReportPage.tsx
│
├── production/                     # Production module
│   ├── DashboardProduksi.tsx
│   ├── MaterialProduksi.tsx
│   └── ReportProduksi.tsx
│
├── hr/                            # Human Resources module
│   ├── KaryawanPage.tsx          # Employee management
│   ├── AbsensiPage.tsx           # Attendance
│   ├── CutiPage.tsx              # Leave management
│   ├── PayrollPage.tsx           # Payroll
│   ├── PenilaianKinerjaPage.tsx  # Performance review
│   ├── KaryawanOnlinePage.tsx    # Online employees
│   ├── RekapAbsensiPage.tsx
│   ├── ResignPage.tsx
│   ├── ShiftPage.tsx
│   └── THLPage.tsx
│
├── finance/                       # Finance module
│   ├── CashflowPage.tsx
│   ├── AccountsReceivablePage.tsx
│   ├── AccountsPayablePage.tsx
│   ├── ApprovalCenterPage.tsx
│   ├── BankReconciliationPage.tsx
│   ├── CashFlowCommandCenter.tsx
│   ├── DigitalArchivePage.tsx
│   ├── ExecutiveDashboardPage.tsx
│   ├── GeneralLedgerPage.tsx
│   ├── PaymentRegistryPage.tsx
│   ├── PayrollPage.tsx
│   ├── PettyCashPage.tsx
│   ├── PPNPage.tsx
│   ├── ProjectProfitLossPage.tsx
│   ├── VendorPaymentPage.tsx
│   ├── WorkingExpensePage.tsx
│   └── YearEndClosingPage.tsx
│
├── asset/                         # Asset module
│   ├── DaftarAsset.tsx
│   ├── MaintenancePage.tsx
│   ├── RentalOutPage.tsx
│   └── InternalUsagePage.tsx
│
├── correspondence/                # Mail module
│   ├── DashboardSurat.tsx
│   ├── SuratMasukPage.tsx
│   ├── SuratKeluarPage.tsx
│   └── TemplateSuratPage.tsx
│
└── settings/                      # Settings module
    └── UserManagementPage.tsx
```

### 📑 Page Structure Pattern

All pages follow this structure:

```typescript
export default function PageName() {
  // 1. Hooks & Context
  const { data, addData, updateData } = useApp();
  const [state, setState] = useState<Type>(initial);
  
  // 2. Event Handlers
  const handleAction = () => { /* ... */ };
  
  // 3. Calculations
  const total = calculateTotal(data);
  
  // 4. Render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1>Page Title</h1>
        <button>Action</button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {/* Stat cards */}
      </div>
      
      {/* Search */}
      <div className="bg-white p-4 rounded-lg">
        <input type="text" placeholder="Search..." />
      </div>
      
      {/* Table/Content */}
      <div className="bg-white rounded-lg">
        {/* Main content */}
      </div>
      
      {/* Modals */}
      {showModal && <Modal />}
    </div>
  );
}
```

---

## 🎨 Styles Directory

```
styles/
└── globals.css             # Global styles & Tailwind config
    ├── CSS custom properties
    ├── Tailwind directives
    ├── Custom utility classes
    └── Global element styles
```

---

## 🛠️ Utils Directory

```
utils/
└── exportToWord.ts         # Document export utilities
```

---

## 📖 Guidelines Directory

```
guidelines/
└── Guidelines.md           # Development guidelines
```

---

## 🗂️ Module Organization

### Module Pattern

Each module follows this pattern:

```
Module Name/
├── Main Page Component
├── Feature-specific components (optional)
├── Modal forms
└── Utility functions (if needed)
```

### Example: Data Collection Module

```
data-collection/
├── DataCollection.tsx          # Main page
└── (uses shared modals from /components/data-collection/)
```

---

## 🔄 Data Flow

```
┌─────────────┐
│  App.tsx    │  ← Entry point, routing
└──────┬──────┘
       │
┌──────▼──────────┐
│  AppContext     │  ← Global state
│  AuthContext    │  ← Auth state
└──────┬──────────┘
       │
┌──────▼──────────┐
│  Layout         │  ← Sidebar, header
└──────┬──────────┘
       │
┌──────▼──────────┐
│  Pages          │  ← Page components
└──────┬──────────┘
       │
┌──────▼──────────┐
│  Components     │  ← Reusable components
└─────────────────┘
```

---

## 📋 Key Files Explained

### App.tsx
```typescript
// Main application file
- React Router setup
- Route definitions
- Layout wrapper
- Protected routes
```

### Layout.tsx
```typescript
// Main layout component
- Sidebar navigation
- Header
- Content area
- Role-based menu filtering
- Mobile responsive
```

### AppContext.tsx
```typescript
// Global state management
- All data lists (30+ states)
- CRUD operations (100+ functions)
- Business logic
- Data transformations
- Integration functions
```

### AuthContext.tsx
```typescript
// Authentication management
- Login/logout
- Current user state
- Role permissions
- Session persistence
- Protected route logic
```

---

## 🎯 Feature Organization

### CRUD Features
Each CRUD feature includes:
```typescript
1. State management
   - List data
   - Form data
   - Modal states
   
2. CRUD functions
   - Create (Add)
   - Read (List/View)
   - Update (Edit)
   - Delete (Remove)
   
3. UI components
   - List/Table view
   - Create/Edit form
   - Detail view
   - Delete confirmation
   
4. Business logic
   - Validation
   - Calculations
   - Transformations
```

### 5 Component System

Components shared across modules:
```typescript
1. Materials (BOQ)
2. Manpower
3. Schedule
4. Consumables
5. Equipment
```

Used in:
- Data Collection
- Project Quotation
- Project Management

---

## 📱 Mobile Components

Optimized for responsive design:
```
mobile/
├── BottomSheet.tsx      # Mobile modal
├── MobileCard.tsx       # Card layout
├── MobileTable.tsx      # Table layout
├── ResponsiveView.tsx   # Adaptive view
└── StatsCard.tsx        # Stat display
```

---

## 🎨 UI Component Library

50+ reusable components in `/components/ui/`:

**Form Components:**
- Input, Textarea, Select
- Checkbox, Radio, Switch
- Button, Form

**Layout Components:**
- Card, Accordion, Tabs
- Dialog, Sheet, Drawer
- Separator, Scroll Area

**Display Components:**
- Badge, Avatar, Alert
- Table, Calendar, Chart
- Progress, Skeleton

**Navigation Components:**
- Breadcrumb, Pagination
- Menu, Dropdown, Command

---

## 🔍 Finding Components

**Need a form?**
→ Check `/components/ui/` for base components
→ Check module pages for examples

**Need a modal?**
→ Check `/components/data-collection/` for reusable modals
→ Check page files for page-specific modals

**Need mobile layout?**
→ Check `/components/mobile/`

**Need page template?**
→ Check any page in `/pages/` for reference

---

## 📚 Best Practices

### Component Placement

```
/components/ui/           → Reusable UI primitives
/components/[module]/     → Module-specific shared components
/pages/[module]/          → Page components
/pages/[module]/components/ → Page-specific components (if needed)
```

### Import Paths

```typescript
// Components
import Layout from './components/Layout';
import { Button } from './components/ui/button';
import { ManpowerModal } from './components/data-collection/ManpowerModal';

// Contexts
import { useApp } from './contexts/AppContext';
import { useAuth } from './contexts/AuthContext';

// Utils
import { exportToWord } from './utils/exportToWord';
```

### File Naming

```
Components:     PascalCase.tsx  (e.g., DataCollection.tsx)
Utilities:      camelCase.ts    (e.g., exportToWord.ts)
Styles:         kebab-case.css  (e.g., globals.css)
```

---

## 🚀 Quick Reference

**Need to add a new page?**
1. Create file in `/pages/[module]/PageName.tsx`
2. Add route in `App.tsx`
3. Add menu item in `Layout.tsx`

**Need to add a new modal?**
1. Create component in `/components/[module]/ModalName.tsx`
2. Import and use in page
3. Handle state and callbacks

**Need to add state?**
1. Add to `AppContext.tsx`
2. Create CRUD functions
3. Export in context value
4. Use in components with `useApp()`

**Need to add route permission?**
1. Update role permissions in `AuthContext.tsx`
2. Update menu filtering in `Layout.tsx`
3. Wrap route with `ProtectedRoute` in `App.tsx`

---

## 📞 Need Help?

Refer to:
- 📖 README.md - Project overview
- 🤝 CONTRIBUTING.md - Development guidelines  
- 📜 CHANGELOG.md - Version history
- 📋 Guidelines.md - Detailed guidelines

---

**Happy Coding! 🎉**
