# 🛠️ Acadchestra - Technology Stack Overview

## Version: 1.0.0

---

## Frontend Stack

### Core Framework
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16.x | React framework with App Router, SSR, ISR |
| **React** | 19.x | UI library with Server Components |
| **TypeScript** | 5.7+ | Type safety across entire codebase |

### Styling & Design
| Technology | Version | Purpose |
|-----------|---------|---------|
| **TailwindCSS** | 4.x | Utility-first CSS framework |
| **tw-animate-css** | latest | Animation utilities for Tailwind |
| **Custom CSS Variables** | - | Design token system (oklch color space) |
| **Custom SVG Icons** | - | Hand-crafted Material-style icons |

### State Management
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Zustand** | 5.x | Lightweight global state (auth, theme, sidebar) |
| **React Query** | 5.x | Server state management, caching, sync |
| **React Hook Form** | 7.x | Performant form management |
| **Zod** | 3.x | Schema validation for forms and API data |

### Data Display
| Technology | Version | Purpose |
|-----------|---------|---------|
| **@tanstack/react-table** | 8.x | Headless table primitives |
| **Recharts** | 2.x | Chart components for dashboards |

### Fonts
| Font | Usage |
|------|-------|
| **Geist Sans** | Primary UI font |
| **Geist Mono** | Code and monospace content |

---

## Backend Stack

### Core Framework
| Technology | Version | Purpose |
|-----------|---------|---------|
| **NestJS** | 11.x | Enterprise Node.js framework |
| **TypeScript** | 5.x | Type safety |
| **Prisma** | 6.x | Type-safe ORM |
| **PostgreSQL** | 16.x | Primary database |

### Authentication & Security
| Technology | Purpose |
|-----------|---------|
| **JWT** | Token-based authentication |
| **Passport.js** | Authentication middleware |
| **bcrypt** | Password hashing (12 salt rounds) |
| **Helmet** | HTTP security headers |
| **Throttler** | Rate limiting (100 req/min) |

### API Documentation
| Technology | Purpose |
|-----------|---------|
| **Swagger/OpenAPI** | Auto-generated API docs at `/docs` |
| **class-validator** | DTO validation |
| **class-transformer** | Request/response transformation |

---

## Design System Architecture

### Color System (oklch)
We use the oklch color space for perceptually uniform colors:

```
Light Mode:
  Primary:     oklch(0.55 0.15 150) → Rich green
  Secondary:   oklch(0.75 0.1 150)  → Lighter green
  Accent:      oklch(0.82 0.18 150) → Lime accent
  Background:  oklch(0.98 0 0)      → Near white
  Foreground:  oklch(0.22 0.05 150) → Dark green text

Dark Mode:
  Primary:     oklch(0.7 0.12 150)  → Brighter green
  Background:  oklch(0.12 0.03 240) → Deep navy
  Surface:     oklch(0.16 0.03 240) → Card surface
  Foreground:  oklch(0.95 0.01 150) → Light text
  Accent Blue: oklch(0.65 0.15 250) → Bright blue accent
```

### Spacing Scale
```
4px  → xs    (gap-1)
8px  → sm    (gap-2)
12px → md    (gap-3)
16px → base  (gap-4)
20px → lg    (gap-5)
24px → xl    (gap-6)
32px → 2xl   (gap-8)
48px → 3xl   (gap-12)
64px → 4xl   (gap-16)
```

### Border Radius Scale
```
4px  → sm
6px  → md
8px  → lg
12px → xl
16px → 2xl
9999px → full (pills)
```

### Typography Scale
```
xs:   0.75rem / 1rem      (12px)
sm:   0.875rem / 1.25rem  (14px)
base: 1rem / 1.5rem       (16px)
lg:   1.125rem / 1.75rem  (18px)
xl:   1.25rem / 1.75rem   (20px)
2xl:  1.5rem / 2rem       (24px)
3xl:  1.875rem / 2.25rem  (30px)
4xl:  2.25rem / 2.5rem    (36px)
```

---

## Component Architecture

### Custom Icon System
Instead of importing Material UI icons, we create custom SVG components:

```tsx
// Each icon is a React component with size and color props
interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

// Icons follow Material Design guidelines:
// - 24x24 viewBox
// - 2px stroke width
// - Rounded line caps and joins
// - Consistent visual weight
```

### Component Naming Conventions
```
components/
  ui/           → Atomic UI primitives (button, input, card)
  common/       → Shared composite components
  layout/       → Layout shells and navigation
  forms/        → Domain-specific form components
  data-tables/  → Table configurations per entity
  modals/       → Dialog/modal components
  dashboard/    → Dashboard-specific widgets
```

### File Structure Convention
```tsx
/**
 * @component ComponentName
 * @description Brief description of the component
 * @commit feat(component): add ComponentName with [features]
 */

// Imports
// Types/Interfaces
// Component implementation
// Export
```

---

## API Integration Pattern

### Service Layer
```
lib/api/
  client.ts       → Axios instance with interceptors
  endpoints.ts    → API endpoint constants
  types.ts        → Shared API types
  services/       → Domain-specific service modules
    auth.service.ts
    students.service.ts
    teachers.service.ts
    ...
```

### React Query Integration
```tsx
// Custom hooks wrap React Query with service calls
function useStudents(filters) {
  return useQuery({
    queryKey: ['students', filters],
    queryFn: () => studentService.getAll(filters),
  });
}
```

---

## Performance Strategies

1. **Route-level Code Splitting**: Next.js App Router automatic splitting
2. **React Query Caching**: Stale-while-revalidate pattern
3. **Debounced Search**: 300ms debounce on search inputs
4. **Virtual Scrolling**: For large data lists (future)
5. **Image Optimization**: Next.js Image component
6. **Bundle Analysis**: Regular bundle size monitoring

---

## Security Measures

### Frontend
- No sensitive data in localStorage (except JWT)
- XSS prevention via React's built-in escaping
- CSRF protection via SameSite cookies (future)
- Input sanitization before API calls

### Backend
- JWT with configurable expiry
- bcrypt password hashing (12 rounds)
- Rate limiting (100 req/minute)
- Helmet security headers
- CORS whitelist
- Input validation on all endpoints
- Multi-tenant data isolation via tenantId

---

## Development Workflow

### Environment Setup
```bash
# Frontend (Next.js)
cd frontend
npm install
npm run dev  # → http://localhost:3000

# Backend (NestJS)
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev  # → http://localhost:3001
```

### Environment Variables
```env
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/acadchestra
JWT_SECRET=your-secret-key
JWT_EXPIRATION=7d
PORT=3001
API_PREFIX=api/v1
```