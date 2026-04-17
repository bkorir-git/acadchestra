# 🎨 Acadchestra - UI/UX Design Guidelines

## Version: 1.0.0

---

## 1. Design Philosophy

Acadchestra's design follows the principle of **"Orchestrated Simplicity"**:
- Clean, modern interfaces that don't overwhelm
- Dark-first design with excellent light mode support
- macOS-inspired dock navigation for efficiency
- Material Design influence with custom interpretation
- Consistent visual language across all modules

---

## 2. Color System

### 2.1 Dark Mode (Primary Theme)

The dark mode draws inspiration from premium software interfaces with deep navy backgrounds and bright accent colors.

#### Backgrounds
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(0.12 0.03 240)` | Page background (deep navy) |
| `--surface` | `oklch(0.16 0.03 240)` | Card/panel surfaces |
| `--surface-hover` | `oklch(0.19 0.03 240)` | Hover state for surfaces |
| `--surface-active` | `oklch(0.22 0.04 240)` | Active/pressed surfaces |
| `--elevated` | `oklch(0.20 0.04 240)` | Elevated elements (modals, dropdowns) |

#### Text Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--foreground` | `oklch(0.95 0.01 240)` | Primary text |
| `--foreground-muted` | `oklch(0.65 0.03 240)` | Secondary/helper text |
| `--foreground-subtle` | `oklch(0.45 0.02 240)` | Placeholder, disabled text |

#### Brand Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `oklch(0.65 0.15 250)` | Primary actions, links, accent |
| `--primary-hover` | `oklch(0.70 0.16 250)` | Primary hover state |
| `--primary-muted` | `oklch(0.65 0.15 250 / 15%)` | Primary backgrounds |
| `--success` | `oklch(0.65 0.18 150)` | Success states |
| `--warning` | `oklch(0.75 0.15 85)` | Warning states |
| `--destructive` | `oklch(0.65 0.24 27)` | Error/delete actions |
| `--info` | `oklch(0.65 0.12 230)` | Informational states |

#### Borders & Dividers
| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `oklch(1 0 0 / 8%)` | Default borders |
| `--border-hover` | `oklch(1 0 0 / 15%)` | Hover borders |
| `--border-focus` | `oklch(0.65 0.15 250)` | Focus ring color |
| `--ring` | `oklch(0.65 0.15 250 / 40%)` | Focus ring shadow |

### 2.2 Light Mode

#### Backgrounds
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(0.97 0.005 250)` | Page background |
| `--surface` | `oklch(1 0 0)` | Card surfaces (white) |
| `--surface-hover` | `oklch(0.96 0.005 250)` | Hover surfaces |

#### Text Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--foreground` | `oklch(0.20 0.03 250)` | Primary text |
| `--foreground-muted` | `oklch(0.45 0.02 250)` | Secondary text |

#### Brand Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `oklch(0.50 0.15 250)` | Primary actions |
| `--primary-hover` | `oklch(0.45 0.16 250)` | Primary hover |

---

## 3. Typography

### Font Family
- **Primary**: Geist Sans (--font-geist-sans)
- **Mono**: Geist Mono (--font-geist-mono)

### Type Scale
| Name | Size | Weight | Usage |
|------|------|--------|-------|
| Display | 36px | 700 | Page titles, hero text |
| Heading 1 | 30px | 700 | Section headings |
| Heading 2 | 24px | 600 | Card titles |
| Heading 3 | 20px | 600 | Sub-section titles |
| Body Large | 18px | 400 | Important body text |
| Body | 16px | 400 | Default body text |
| Body Small | 14px | 400 | Secondary text, table cells |
| Caption | 12px | 500 | Labels, badges, metadata |
| Overline | 11px | 600 | Category labels, uppercase |

---

## 4. Spacing System

Based on a 4px grid:
```
1 = 4px    (micro spacing)
2 = 8px    (tight spacing)
3 = 12px   (compact spacing)
4 = 16px   (default spacing)
5 = 20px   (comfortable spacing)
6 = 24px   (section spacing)
8 = 32px   (large spacing)
10 = 40px  (extra large)
12 = 48px  (section gaps)
16 = 64px  (page margins)
```

---

## 5. Component Guidelines

### 5.1 Buttons

| Variant | Usage | Style |
|---------|-------|-------|
| Primary | Main actions (Save, Create) | Filled, primary color |
| Secondary | Alternative actions | Bordered, subtle fill |
| Ghost | Tertiary actions | No border, text only |
| Destructive | Delete, remove | Red filled/bordered |
| Icon | Icon-only actions | Circle/square, no text |

**Sizes**: `sm` (32px), `md` (40px), `lg` (48px)

### 5.2 Cards

```
┌─────────────────────────────────────┐
│  ┌─ Header ──────────────────────┐  │
│  │ Title          Action Button  │  │
│  │ Subtitle                      │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ Content ─────────────────────┐  │
│  │                               │  │
│  │    Main card content          │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌─ Footer ──────────────────────┐  │
│  │  Secondary info    Actions    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

- Border radius: 12px (xl)
- Border: 1px solid var(--border)
- Background: var(--surface)
- Shadow: subtle in light mode, none in dark mode
- Hover: border-color transition, slight elevation

### 5.3 Data Tables

```
┌─────────────────────────────────────────────────────┐
│ [Search...          ]  [Filter ▾]  [+ Add New]     │
├────┬──────────┬──────────┬─────────┬────────────────┤
│ □  │ Name ↕   │ Email ↕  │ Role    │ Actions       │
├────┼──────────┼──────────┼─────────┼────────────────┤
│ □  │ John Doe │ john@... │ Admin   │ [👁] [✏] [🗑] │
│ □  │ Jane Doe │ jane@... │ Teacher │ [👁] [✏] [🗑] │
│ □  │ ...      │ ...      │ ...     │ ...            │
├────┴──────────┴──────────┴─────────┴────────────────┤
│ Showing 1-10 of 150   [10▾]  [◀ 1 2 3 ... 15 ▶]   │
└─────────────────────────────────────────────────────┘
```

- Alternating row colors in light mode
- Hover highlight on rows
- Sticky header on scroll
- Column sorting indicators
- Responsive: horizontal scroll on mobile

### 5.4 Floating Dock

```
Desktop (Bottom Center):
╔══════════════════════════════════════════════╗
║  🏠  📊  👨‍🎓  👩‍🏫  📚  💰  👥  🔐  ⚙️      ║
╚══════════════════════════════════════════════╝
  ↑ Active indicator (dot below icon)
  ↑ Hover: scale(1.3) + tooltip label
  ↑ Click: navigate to module

Mobile (Bottom Fixed):
┌─────────────────────────────────────┐
│  🏠   📊   👨‍🎓   👩‍🏫   •••          │
│ Home  Dash  Stu  Tea  More         │
└─────────────────────────────────────┘
```

### 5.5 Form Fields

- Label above input (always visible)
- 40px input height (default)
- 12px border radius
- Focus: blue ring + border color change
- Error: red border + error message below
- Helper text: muted color below input

---

## 6. Animation Guidelines

### Transitions
| Property | Duration | Easing |
|----------|----------|--------|
| Colors | 150ms | ease-in-out |
| Transform | 200ms | ease-out |
| Opacity | 200ms | ease-in-out |
| Layout | 300ms | ease-out |

### Dock Animations
| Action | Animation |
|--------|-----------|
| Hover icon | scale(1.2) with spring easing |
| Active icon | scale(1.1) + glow effect |
| Dock show/hide | translateY with ease-out |
| Tooltip | fadeIn + translateY(-4px) |

### Page Transitions
- Fade in on mount (opacity 0 → 1, 200ms)
- Content slides up slightly (translateY 8px → 0)
- Skeleton loading states while data fetches

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|-----------|-------|----------------|
| Mobile | < 640px | Stack layout, bottom nav, full-width cards |
| Tablet | 640-1024px | 2-column grid, collapsed sidebar |
| Desktop | 1024-1440px | Full layout, floating dock or sidebar |
| Wide | > 1440px | Max-width container, larger spacing |

---

## 8. Accessibility

- All interactive elements keyboard navigable
- Focus indicators visible and high-contrast
- Color is never the only indicator of state
- Minimum touch targets: 44x44px on mobile
- ARIA labels on icon-only buttons
- Semantic HTML structure (nav, main, aside, etc.)
- Reduced motion support via `prefers-reduced-motion`

---

## 9. Dark Mode Best Practices

1. **Never use pure black** (#000) - use deep navy/charcoal
2. **Reduce white text opacity** for secondary content
3. **Elevation = lighter**, not darker (opposite of light mode)
4. **Accent colors slightly brighter** than light mode equivalents
5. **Borders are translucent white**, not solid colors
6. **Shadows minimal** - rely on surface color differences
7. **Images/icons slightly desaturated** in dark mode