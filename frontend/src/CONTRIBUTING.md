# Contributing to ERP System

First off, thank you for considering contributing to this ERP System! 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Component Guidelines](#component-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

---

## 📜 Code of Conduct

By participating in this project, you agree to abide by our code of conduct:

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Maintain professionalism

---

## 🚀 Getting Started

### Prerequisites

```bash
# Node.js 18+ and npm
node --version
npm --version
```

### Setup

```bash
# Clone repository
git clone <repository-url>
cd erp-system

# Install dependencies
npm install

# Run development server
npm run dev

# Access application
http://localhost:5173
```

---

## 💻 Development Process

### 1. Create Feature Branch

```bash
# Create branch from main
git checkout -b feature/your-feature-name

# Or for bugfixes
git checkout -b fix/bug-description
```

### 2. Branch Naming Convention

```
feature/     - New features
fix/         - Bug fixes
refactor/    - Code refactoring
docs/        - Documentation updates
style/       - UI/styling changes
test/        - Test additions/updates
chore/       - Maintenance tasks
```

Examples:
```
feature/add-dark-mode
fix/quotation-calculation-error
refactor/improve-data-collection
docs/update-readme
```

### 3. Development Guidelines

**File Structure:**
```typescript
// New component structure
/components/
  module-name/
    ComponentName.tsx       // Main component
    ComponentName.test.tsx  // Tests (if applicable)
    types.ts               // Type definitions
    utils.ts               // Helper functions
```

**Page Structure:**
```typescript
/pages/
  module-name/
    PageName.tsx           // Main page
    components/            // Page-specific components
```

---

## 📏 Coding Standards

### TypeScript Guidelines

**1. Always use TypeScript types:**
```typescript
// ✅ Good
interface UserData {
  id: string;
  name: string;
  role: UserRole;
}

const user: UserData = { id: '1', name: 'John', role: 'admin' };

// ❌ Bad
const user = { id: '1', name: 'John', role: 'admin' };
```

**2. Use functional components with hooks:**
```typescript
// ✅ Good
export default function ComponentName() {
  const [state, setState] = useState<Type>(initialValue);
  
  return <div>...</div>;
}

// ❌ Bad - don't use class components
class ComponentName extends React.Component {
  render() { return <div>...</div>; }
}
```

**3. Proper prop types:**
```typescript
// ✅ Good
interface Props {
  title: string;
  onSave: (data: FormData) => void;
  isLoading?: boolean;
}

export default function Component({ title, onSave, isLoading = false }: Props) {
  // ...
}
```

### React Guidelines

**1. Component naming:**
```typescript
// ✅ Good - PascalCase for components
export default function DataCollectionPage() {}
export function MaterialModal() {}

// ❌ Bad
export default function dataCollectionPage() {}
export function material_modal() {}
```

**2. Use destructuring:**
```typescript
// ✅ Good
const { customerName, location, materials } = formData;

// ❌ Bad
const customerName = formData.customerName;
const location = formData.location;
```

**3. Conditional rendering:**
```typescript
// ✅ Good
{isLoading && <LoadingSpinner />}
{error ? <ErrorMessage error={error} /> : <SuccessContent />}

// ❌ Bad
{isLoading === true && <LoadingSpinner />}
```

### Tailwind CSS Guidelines

**1. Use utility classes:**
```tsx
// ✅ Good
<div className="flex items-center justify-between p-4 bg-white rounded-lg">

// ❌ Bad - don't use inline styles
<div style={{ display: 'flex', padding: '16px' }}>
```

**2. Responsive design:**
```tsx
// ✅ Good - mobile first
<div className="w-full md:w-1/2 lg:w-1/3">

// Use breakpoints: sm, md, lg, xl, 2xl
```

**3. Component classes:**
```tsx
// ✅ Good - extract repeated patterns
const buttonClass = "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700";
<button className={buttonClass}>Save</button>
```

---

## 🧩 Component Guidelines

### Creating New Components

**1. Component Template:**
```typescript
import { useState } from 'react';
import { Icon } from 'lucide-react';

interface ComponentNameProps {
  title: string;
  data: DataType[];
  onAction: (id: string) => void;
}

export default function ComponentName({ 
  title, 
  data, 
  onAction 
}: ComponentNameProps) {
  const [state, setState] = useState<StateType>(initialValue);
  
  const handleAction = (id: string) => {
    // Handle action
    onAction(id);
  };
  
  return (
    <div className="component-container">
      <h2 className="component-title">{title}</h2>
      {/* Component content */}
    </div>
  );
}
```

**2. Modal Template:**
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DataType) => void;
  initialData?: DataType;
}

export function Modal({ isOpen, onClose, onSave, initialData }: ModalProps) {
  const [formData, setFormData] = useState<DataType>(
    initialData || defaultData
  );
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        {/* Modal content */}
      </div>
    </div>
  );
}
```

### Form Handling

**1. Form state:**
```typescript
const [formData, setFormData] = useState<FormType>({
  field1: '',
  field2: 0,
  field3: []
});

const handleChange = (field: keyof FormType, value: any) => {
  setFormData(prev => ({ ...prev, [field]: value }));
};
```

**2. Form validation:**
```typescript
const validateForm = (): boolean => {
  if (!formData.field1) {
    alert('Field 1 is required');
    return false;
  }
  return true;
};

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!validateForm()) return;
  // Submit data
};
```

---

## 📝 Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `style`: UI/styling changes
- `docs`: Documentation
- `test`: Tests
- `chore`: Maintenance

**Examples:**
```bash
# Feature
git commit -m "feat(quotation): add delete functionality"

# Bug fix
git commit -m "fix(data-collection): correct total calculation"

# Refactor
git commit -m "refactor(components): extract modal into reusable component"

# Documentation
git commit -m "docs(readme): update installation instructions"

# Style
git commit -m "style(quotation): improve mobile responsiveness"
```

### Detailed Commit
```bash
feat(quotation): add delete functionality

- Add deleteQuotation function to AppContext
- Implement handleDelete with confirmation dialog
- Update UI with delete button
- Add success notification

Closes #123
```

---

## 🔄 Pull Request Process

### 1. Before Creating PR

```bash
# Update your branch
git checkout main
git pull origin main
git checkout feature/your-feature
git rebase main

# Run tests (if available)
npm run test

# Check TypeScript errors
npm run type-check

# Build to ensure no errors
npm run build
```

### 2. PR Title Format

```
[Type] Brief description

Examples:
[Feature] Add dark mode support
[Fix] Correct quotation calculation
[Refactor] Improve data collection structure
```

### 3. PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
How was this tested?
- [ ] Manual testing
- [ ] Unit tests added
- [ ] Integration tests added

## Screenshots (if applicable)
[Add screenshots]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No console.log() left in code
- [ ] TypeScript types are correct
```

### 4. Review Process

1. Create PR with clear description
2. Request review from maintainers
3. Address review comments
4. Wait for approval
5. Squash and merge

---

## 🧪 Testing Guidelines

### Manual Testing Checklist

**For New Features:**
- [ ] Feature works as expected
- [ ] Mobile responsive
- [ ] All user roles can access (if applicable)
- [ ] No console errors
- [ ] Data persists correctly
- [ ] Error handling works
- [ ] Loading states work

**For Bug Fixes:**
- [ ] Bug is fixed
- [ ] No new bugs introduced
- [ ] Edge cases tested
- [ ] Works across different scenarios

---

## 🎨 UI/UX Guidelines

### Design Principles

1. **Consistency**: Use existing components and patterns
2. **Accessibility**: Ensure keyboard navigation and screen reader support
3. **Performance**: Optimize for fast loading
4. **Mobile-first**: Design for mobile, enhance for desktop

### Color Scheme

```css
Primary: Blue (#2563eb)
Success: Green (#10b981)
Warning: Yellow (#f59e0b)
Error: Red (#ef4444)
Gray: (#6b7280, #9ca3af, #d1d5db)
```

### Spacing

```css
Small: 0.25rem, 0.5rem (1, 2)
Medium: 1rem, 1.5rem (4, 6)
Large: 2rem, 3rem (8, 12)
```

---

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Router Documentation](https://reactrouter.com)

---

## ❓ Questions?

If you have questions about contributing:

1. Check existing documentation
2. Search existing issues
3. Ask in discussions
4. Contact maintainers

---

## 🙏 Thank You!

Your contributions make this project better for everyone. Thank you for taking the time to contribute! 🎉

---

**Happy Coding! 🚀**
