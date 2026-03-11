# Responsive Design Implementation

## Overview
Sistem ERP "Premium Warehouse Ledger" telah dioptimalkan untuk responsive mobile dan tampilan UI yang lebih baik.

## Komponen Responsive yang Ditambahkan

### 1. Responsive Card Components (`/components/ui/ResponsiveCard.tsx`)

#### ResponsiveCard
Komponen card dasar dengan padding responsive:
```tsx
<ResponsiveCard>
  <h2>Title</h2>
  <p>Content</p>
</ResponsiveCard>
```

#### ResponsiveGrid
Grid responsive dengan automatic breakpoints:
```tsx
<ResponsiveGrid cols={3} gap="md">
  <Card1 />
  <Card2 />
  <Card3 />
</ResponsiveGrid>
```
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 2-4 columns (sesuai props)

#### ResponsiveStack
Vertical stack dengan spacing responsive:
```tsx
<ResponsiveStack gap="md">
  <Section1 />
  <Section2 />
</ResponsiveStack>
```

#### ResponsiveContainer
Container dengan max-width responsive:
```tsx
<ResponsiveContainer maxWidth="xl">
  <Content />
</ResponsiveContainer>
```

#### StatCard
Card statistik dengan icon dan trend indicator:
```tsx
<StatCard
  title="Total Revenue"
  value="Rp 1.2M"
  icon={<DollarSign />}
  color="green"
  trend={{ value: 12, isPositive: true }}
/>
```

#### PageHeader
Header halaman responsive dengan breadcrumbs:
```tsx
<PageHeader
  title="Dashboard"
  subtitle="Overview of your business"
  breadcrumbs={[
    { label: 'Home', path: '/' },
    { label: 'Dashboard' }
  ]}
  actions={<Button>New Item</Button>}
/>
```

#### ResponsiveTable
Table dengan horizontal scroll di mobile:
```tsx
<ResponsiveTable>
  <thead>...</thead>
  <tbody>...</tbody>
</ResponsiveTable>
```

#### MobileCardListItem
List item untuk mobile view (alternative dari table):
```tsx
<MobileCardListItem
  title="Item Name"
  subtitle="Description"
  badge={<span>Status</span>}
  leftIcon={<Icon />}
  actions={<Button>Edit</Button>}
/>
```

#### EmptyState
Empty state placeholder:
```tsx
<EmptyState
  icon={<Inbox />}
  title="No Data"
  description="Start by adding your first item"
  action={<Button>Add Item</Button>}
/>
```

## CSS Utilities yang Ditambahkan

### Responsive Classes

#### Card Grid
```css
.card-grid /* Auto responsive grid */
```

#### Modal Classes
```css
.responsive-modal /* Full screen on mobile */
.responsive-modal-content /* Scrollable content */
```

#### Table Classes
```css
.desktop-table-view /* Hide on mobile */
.mobile-card-list /* Show on mobile */
```

#### Visibility Classes
```css
.hide-mobile /* Hidden on mobile */
.show-mobile /* Visible only on mobile */
```

#### Layout Classes
```css
.stack-on-mobile /* Flex column on mobile */
.responsive-auto-grid /* Auto-fit grid */
.container-padding /* Responsive padding */
```

#### Touch-friendly
```css
.touch-target /* Min 44x44px tap target */
.btn-responsive /* Responsive button size */
```

#### Spacing
```css
.space-y-responsive /* Responsive vertical spacing */
.mobile-bottom-safe /* Safe area for bottom nav */
```

## Layout Responsive

### Sidebar Navigation
- Desktop: Fixed sidebar (264px)
- Mobile: Overlay sidebar (320px) dengan backdrop
- Auto-close on route change (mobile)
- Touch-friendly tap targets (44x44px minimum)

### Bottom Navigation (Mobile Only)
- Fixed bottom bar dengan 5 quick access items
- Safe area padding untuk notch/home indicator
- Active state highlighting

### Header
- Desktop: Logo + User info
- Mobile: Menu button + Title + Menu button
- Responsive padding and sizing

## Breakpoints

```css
Mobile: < 768px
Tablet: 768px - 1023px
Desktop: ≥ 1024px
```

## Best Practices

### 1. Gunakan Responsive Components
```tsx
// ✅ Good
<ResponsiveGrid cols={3}>
  <Card />
</ResponsiveGrid>

// ❌ Avoid
<div className="grid grid-cols-3">
  <Card />
</div>
```

### 2. Mobile-first Approach
```tsx
// Mobile first, then enhance for larger screens
className="text-sm lg:text-base"
className="p-4 lg:p-6"
className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
```

### 3. Touch-friendly Targets
```tsx
// Minimum 44x44px tap target
className="p-2 touch-target touch-manipulation"
```

### 4. Conditional Rendering
```tsx
// Show different components for mobile/desktop
{isMobile ? <MobileView /> : <DesktopView />}
```

### 5. Table vs Card List
```tsx
// Desktop: Table
<div className="desktop-table-view">
  <ResponsiveTable>...</ResponsiveTable>
</div>

// Mobile: Card List
<div className="mobile-card-list">
  {items.map(item => (
    <MobileCardListItem key={item.id} {...item} />
  ))}
</div>
```

## Typography

### Mobile-first Typography
- Base font: 14px (mobile) → 16px (desktop)
- h1: 24px (mobile) → 32px (desktop)
- h2: 20px (mobile) → 24px (desktop)
- h3: 18px (mobile) → 20px (desktop)

### Form Inputs
- Minimum 16px font size on mobile (prevents iOS zoom)

## Performance

### CSS
- Mobile-first approach reduces CSS bloat
- Only load what's needed for current breakpoint

### Images
- Use `object-fit: contain/cover` for responsive images
- Consider lazy loading for images below fold

## Accessibility

### Focus Styles
- Visible focus indicators for keyboard navigation
- 2px outline with offset

### Touch Targets
- Minimum 44x44px for all interactive elements
- Adequate spacing between tap targets

### Safe Areas
- Respect device safe areas (notch, home indicator)
- Use `env(safe-area-inset-*)` variables

## Testing Checklist

- [ ] Test on mobile (< 768px)
- [ ] Test on tablet (768px - 1023px)
- [ ] Test on desktop (≥ 1024px)
- [ ] Test touch interactions
- [ ] Test keyboard navigation
- [ ] Test with screen reader
- [ ] Test landscape orientation
- [ ] Test with browser zoom (150%, 200%)
- [ ] Test dark mode (if applicable)

## Updates Made

### MainDashboard
- ✅ Imported responsive components
- ✅ Responsive grid layout
- ✅ Mobile-friendly cards
- ✅ Touch-friendly buttons

### Layout
- ✅ Responsive sidebar
- ✅ Mobile bottom navigation
- ✅ Touch-friendly menu items
- ✅ Auto-close on mobile

### QuotationPage
- ✅ Responsive modals
- ✅ Mobile-friendly forms
- ✅ Touch-friendly buttons
- ✅ Async logo loading for Word export

### Globals CSS
- ✅ Added 15+ responsive utility classes
- ✅ Mobile-first typography
- ✅ Touch-friendly interactions
- ✅ Safe area support

## Next Steps untuk Developer

1. **Terapkan ResponsiveCard di semua pages**
   ```tsx
   import { ResponsiveCard, ResponsiveGrid } from '../components/ui/ResponsiveCard';
   ```

2. **Gunakan mobile-card-list pattern untuk tables**
   - Desktop: Show table
   - Mobile: Show card list

3. **Test semua forms di mobile**
   - Ensure 16px minimum font size
   - Use stack-on-mobile class

4. **Add loading states**
   - Use skeleton class for loading
   - Add pull-to-refresh for mobile

5. **Optimize images**
   - Use appropriate sizes
   - Lazy load below fold

## Support

Untuk pertanyaan atau masalah terkait responsive design:
1. Check komponen di `/components/ui/ResponsiveCard.tsx`
2. Check utility classes di `/styles/globals.css`
3. Reference existing implementation di MainDashboard dan Layout
