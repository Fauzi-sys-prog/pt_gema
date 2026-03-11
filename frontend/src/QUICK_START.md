# ⚡ Quick Start Guide

Get up and running with the ERP System in 5 minutes!

---

## 🎯 Prerequisites

```bash
# Check you have Node.js installed
node --version
# Should show v18.0.0 or higher

npm --version
# Should show v9.0.0 or higher
```

**Don't have Node.js?** [Download here](https://nodejs.org/)

---

## 🚀 Installation

### Step 1: Clone & Install

```bash
# Clone the repository
git clone <repository-url>

# Navigate to project
cd erp-system

# Install dependencies
npm install
```

### Step 2: Start Development Server

```bash
npm run dev
```

**Server should start at:** `http://localhost:5173`

---

## 🔐 First Login

### Option 1: Quick Demo (Recommended)

**Super Admin Access:**
```
Email:    admin@erp.com
Password: admin123
```

### Option 2: Try Different Roles

Pick any role to test:

| Role | Email | Password | Access |
|------|-------|----------|--------|
| 🔑 Super Admin | admin@erp.com | admin123 | Full access |
| 💰 Finance | finance@erp.com | finance123 | Finance modules |
| 👥 HR | hr@erp.com | hr123 | HR modules |
| 📊 Sales | sales@erp.com | sales123 | Sales modules |
| 📦 Warehouse | warehouse@erp.com | warehouse123 | Inventory |
| 🎯 Project | project@erp.com | project123 | Projects |
| 🏭 Production | production@erp.com | production123 | Production |
| 👀 Viewer | viewer@erp.com | viewer123 | Read-only |

---

## 🎮 Try Core Features

### 1️⃣ Test Data Collection → Quotation → Project Workflow

**Step A: View Sample Data Collection**
```
1. Login as admin@erp.com
2. Go to "Sales & Project" → "Data Collection"
3. Click "View" on "DC-001"
4. See 5 components: Materials, Manpower, Schedule, Consumables, Equipment
```

**Step B: Transfer to Quotation**
```
1. While viewing DC-001
2. Click "Kirim ke Quotation" button
3. Navigate to "Sales & Project" → "Project Quotation"
4. Modal opens with all data pre-filled!
5. Review and click "Simpan Quotation"
```

**Step C: Create Project**
```
1. In Project Quotation list
2. Click "View" on your new quotation
3. Click "Convert to Project"
4. Navigate to "Sales & Project" → "Project Management"
5. See your new project created!
```

🎉 **Congratulations!** You've completed the full workflow!

---

### 2️⃣ Test CRUD Operations

**Create New Quotation:**
```
1. Go to "Project Quotation"
2. Click "Buat Quotation Baru"
3. Fill in Overview tab (Customer, Perihal)
4. Add Materials in "BOQ Materials" tab
5. Add Manpower, Schedule, Consumables, Equipment
6. Click "Simpan Quotation"
```

**Edit Quotation:**
```
1. Click Edit (✏️) button on any quotation
2. Modify any data
3. Click "Update Quotation"
```

**Delete Quotation:**
```
1. Click Delete (🗑️) button
2. Confirm deletion
```

---

### 3️⃣ Explore Dashboard

```
1. Go to "Dashboard"
2. See real-time statistics:
   - Active Projects
   - Pending Invoices
   - Total Revenue
   - Online Employees
3. View charts and graphs
4. Check recent activities
```

---

### 4️⃣ Test Different Modules

**Sales:**
- Penawaran (Offers)
- RAB Project (Budget)
- Invoice

**Purchasing:**
- Purchase Orders
- Receiving Goods

**Inventory:**
- Stock In/Out
- Stock Reports

**HR:**
- Employee Management
- Attendance
- Payroll

**Finance:**
- Cashflow
- Payments
- Tax Management

---

## 🎨 UI Tour

### Navigation

**Sidebar Menu:**
- Click module name to expand
- Click submenu to navigate
- Hover for tooltips
- Mobile: Hamburger menu

**Search:**
- Available on most pages
- Real-time filtering
- Search by multiple fields

**Actions:**
- 👁️ View = View details
- ✏️ Edit = Edit data
- 🗑️ Delete = Delete data
- 🖨️ Print = Print document

---

## 📱 Mobile Testing

### Desktop Browser

```
1. Open DevTools (F12)
2. Click "Toggle Device Toolbar" (Ctrl+Shift+M)
3. Select device: iPhone, iPad, etc.
4. Test mobile UI
```

### Responsive Breakpoints

```
Mobile:  < 768px
Tablet:  768px - 1024px
Desktop: > 1024px
```

---

## 🔧 Common Tasks

### Add New User

```
1. Login as Super Admin
2. Go to "Settings" → "User Management"
3. Click "Tambah User"
4. Fill in details
5. Select role
6. Click "Simpan"
```

### Change User Role

```
1. Go to "User Management"
2. Click Edit on user
3. Change role dropdown
4. Click "Update"
```

### Export Data

```
1. View any document (Quotation, Project, etc.)
2. Click "Print" or "Export"
3. Select format
4. Download file
```

---

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Kill process on port 5173
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

### Module Not Found Error

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build Errors

```bash
# Clear build cache
rm -rf dist
npm run build
```

---

## 🎯 Next Steps

### Learn the System

1. **Explore Documentation:**
   - 📖 README.md - Overview
   - 📁 PROJECT_STRUCTURE.md - File organization
   - 🤝 CONTRIBUTING.md - Development guide

2. **Try All Modules:**
   - Test each module's CRUD operations
   - Explore different user roles
   - Test mobile responsiveness

3. **Understand Workflow:**
   - Data Collection → Quotation → Project
   - Integration between modules
   - Data flow and relationships

### Customize for Your Needs

1. **Modify Theme:**
   - Edit `/styles/globals.css`
   - Change colors, fonts, spacing

2. **Add Your Logo:**
   - Update company info in components
   - Replace logo images

3. **Customize Modules:**
   - Add/remove fields
   - Modify business logic
   - Adjust calculations

---

## 📚 Resources

### Documentation

- 📖 [README](./README.md) - Project overview
- 📁 [Project Structure](./PROJECT_STRUCTURE.md) - File organization
- 🤝 [Contributing](./CONTRIBUTING.md) - Development guide
- 📜 [Changelog](./CHANGELOG.md) - Version history

### External Links

- [React Documentation](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Router](https://reactrouter.com)

---

## ⚡ Quick Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Code Quality
npm run lint             # Run linter (if configured)
npm run type-check       # Check TypeScript types

# Utilities
npm run clean            # Clean build files
npm install              # Install dependencies
npm update               # Update dependencies
```

---

## 💡 Pro Tips

### Keyboard Shortcuts

```
Ctrl + /     - Toggle sidebar (in development)
Ctrl + K     - Quick search (if implemented)
Ctrl + S     - Save form (browser default)
Esc          - Close modal
```

### Performance Tips

1. **Use search/filter** instead of scrolling large lists
2. **Clear browser cache** if data seems stale
3. **Use Chrome DevTools** to check network requests
4. **Test on real devices** for mobile experience

### Development Tips

1. **Keep DevTools open** to see console logs
2. **Use React DevTools** extension for debugging
3. **Check Network tab** for API calls (when backend is connected)
4. **Use TypeScript** for better IDE support

---

## 🎉 You're Ready!

You now have:
- ✅ System up and running
- ✅ Tested core features
- ✅ Explored different modules
- ✅ Know where to find help

**Start building amazing things!** 🚀

---

## ❓ Need Help?

**Having issues?** Check:

1. 📖 Documentation files
2. 🐛 Console for errors
3. 🔍 GitHub issues
4. 💬 Contact support: support@erp.com

**Want to contribute?** See [CONTRIBUTING.md](./CONTRIBUTING.md)

---

**Happy coding! 🎊**
