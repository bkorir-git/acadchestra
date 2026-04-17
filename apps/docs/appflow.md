# 🔄 Acadchestra - Application Flow

## Version: 1.0.0

---

## 1. Authentication Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Landing    │────▶│  Login Page  │────▶│  POST /auth/login│
│   Page (/)   │     │  (email+pw)  │     │  → JWT token     │
└──────────────┘     └──────────────┘     └────────┬─────────┘
                                                    │
                                          ┌─────────▼─────────┐
                                          │  Store token in   │
                                          │  localStorage     │
                                          │  + fetch profile  │
                                          └─────────┬─────────┘
                                                    │
                              ┌──────────────────────┼──────────────────────┐
                              │                      │                      │
                    ┌─────────▼─────────┐  ┌────────▼────────┐  ┌─────────▼────────┐
                    │   SuperAdmin?     │  │    Admin?       │  │   Teacher/       │
                    │   → /dashboard    │  │   → /dashboard  │  │   Student?       │
                    │   (Platform view) │  │   (School view) │  │   → /dashboard   │
                    └───────────────────┘  └─────────────────┘  └──────────────────┘
```

### Login Sequence
1. User visits `/login`
2. Enters email + password
3. Frontend calls `POST /api/v1/auth/login`
4. Backend validates credentials, returns JWT + user object
5. Frontend stores token in `localStorage`
6. Frontend fetches full profile via `GET /api/v1/auth/profile`
7. Auth context populated with user data + roles + permissions
8. Router redirects to `/dashboard` based on role

### Token Management
- Access token stored in `localStorage` under `auth_token`
- User data cached under `auth_user`
- Axios interceptor attaches `Authorization: Bearer <token>` to all requests
- 401 response triggers automatic logout + redirect to `/login`

---

## 2. Welcome Screen / Dashboard Flow

```
┌────────────────────────────────────────────────────────┐
│                    WELCOME SCREEN                       │
│                                                        │
│   "Welcome back, [FirstName]!"                         │
│   "Select a module to get started"                     │
│                                                        │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│   │ 👨‍🎓      │ │ 👩‍🏫      │ │ 📚      │             │
│   │ Students │ │ Teachers │ │ Academic │             │
│   │ Manage   │ │ Manage   │ │ Setup    │             │
│   └──────────┘ └──────────┘ └──────────┘             │
│                                                        │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│   │ 💰      │ │ 👥      │ │ ⚙️      │             │
│   │ Fees    │ │ Users   │ │ Settings │             │
│   │ Manage  │ │ Manage  │ │ Config   │             │
│   └──────────┘ └──────────┘ └──────────┘             │
│                                                        │
│   ════════════════════════════════════════════          │
│   │ 🏠 │ 📊 │ 👨‍🎓 │ 👩‍🏫 │ 📚 │ ⚙️ │  ← Floating Dock  │
│   ════════════════════════════════════════════          │
└────────────────────────────────────────────────────────┘
```

### Module Cards (Role-Based Visibility)

| Module | SuperAdmin | Admin | Principal | Teacher | Student | Parent |
|--------|-----------|-------|-----------|---------|---------|--------|
| Platform Overview | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Tenant Management | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| System Health | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Dashboard | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Students | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Teachers | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Users | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Academic | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Fees | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Roles | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Settings | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Examinations | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 3. Navigation Flow

### Dock Navigation States

```
┌─ FLOATING DOCK (Default) ─────────────────────────────┐
│                                                        │
│  Minimized bottom bar with icon-only navigation        │
│  Hover to expand with tooltip labels                   │
│  macOS-style magnification on hover                    │
│  Auto-hides when scrolling down                        │
│  Shows on scroll up or mouse near bottom               │
│                                                        │
└────────────────────────────────────────────────────────┘

┌─ FULL DOCK (Expanded) ────────────────────────────────┐
│                                                        │
│  Left sidebar with icon + text labels                  │
│  Collapsible to icon-only mode                         │
│  Group navigation items by category                    │
│  Active item highlighted with accent color             │
│  Nested navigation with expand/collapse                │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Desktop Navigation
1. Floating dock at bottom (default)
2. Click "expand" icon → full left sidebar
3. Sidebar collapses to icon-only on narrow screens
4. Top navbar always visible with: search, notifications, theme toggle, user menu

### Mobile Navigation
1. Bottom navigation bar (fixed)
2. Hamburger menu → slide-out drawer
3. Maximum 5 items in bottom bar
4. "More" option for additional items

---

## 4. CRUD Operation Flow

### Create Entity
```
User clicks "Add New" → Modal/Page opens → Fill form →
Validate with Zod → POST to API → Success toast →
Refresh table data → Close modal/Navigate back
```

### Update Entity
```
User clicks row/edit icon → Modal/Page opens with data →
Edit fields → Validate → PATCH to API → Success toast →
Refresh data → Close modal/Navigate back
```

### Delete Entity
```
User clicks delete → Confirmation modal appears →
User confirms → DELETE to API → Success toast →
Refresh data → Update pagination if needed
```

### Bulk Operations
```
User selects rows via checkboxes → Bulk action bar appears →
User selects action (delete/export) → Confirmation if destructive →
Execute batch operation → Success/error summary → Refresh data
```

---

## 5. Error Handling Flow

```
API Request → Error Response?
  │
  ├─ 400 Bad Request → Show field-level validation errors
  ├─ 401 Unauthorized → Clear token, redirect to /login
  ├─ 403 Forbidden → Show "Access Denied" message
  ├─ 404 Not Found → Show "Not Found" page/message
  ├─ 409 Conflict → Show conflict message (e.g., email exists)
  ├─ 429 Rate Limited → Show "Too many requests" with retry timer
  ├─ 500 Server Error → Show generic error with retry option
  └─ Network Error → Show offline indicator, queue retry
```

---

## 6. Theme Flow

```
App Load → Check localStorage for theme preference
  │
  ├─ "light" → Apply light CSS variables
  ├─ "dark" → Apply dark CSS variables
  └─ "system" → Check prefers-color-scheme
       ├─ matches dark → Apply dark
       └─ matches light → Apply light

Theme Change → User clicks theme toggle
  → Update Zustand store
  → Persist to localStorage
  → Apply data-theme attribute to <html>
  → All CSS variables update automatically
```

---

## 7. Data Table Flow

```
Page Load → Fetch page 1 with default limit (10)
  │
  ├─ User changes page → Fetch new page
  ├─ User changes limit → Reset to page 1, fetch with new limit
  ├─ User types search → Debounce 300ms → Reset to page 1, fetch
  ├─ User clicks column header → Toggle sort direction, fetch
  ├─ User selects filter → Apply filter, reset page, fetch
  └─ User clicks export → Fetch all matching records → Generate file
```

### Pagination Display
```
Showing 1-10 of 150 results    [10 ▾]  [◀ 1 2 3 ... 15 ▶]
                                 ↑
                          Per-page selector:
                          10 | 25 | 50 | 100
```

---

## 8. State Management Flow

```
┌─────────────────────────────────────────┐
│              ZUSTAND STORES             │
├─────────────┬───────────┬───────────────┤
│ auth-store  │ theme-    │ sidebar-      │
│ (user,      │ store     │ store         │
│  token,     │ (theme,   │ (isOpen,      │
│  roles)     │  mode)    │  isCollapsed) │
├─────────────┤           │               │
│ notification│           │               │
│ -store      │           │               │
│ (toasts)    │           │               │
└─────────────┴───────────┴───────────────┘

┌─────────────────────────────────────────┐
│           REACT QUERY CACHE             │
├─────────────────────────────────────────┤
│ ['students', filters] → students list   │
│ ['student', id] → single student        │
│ ['teachers', filters] → teachers list   │
│ ['users', filters] → users list         │
│ ['roles'] → roles list                  │
│ ['academic-years'] → years list         │
│ ['dashboard-stats'] → dashboard data    │
│ ['tenants', filters] → tenants list     │
│ ['system-health'] → health metrics      │
└─────────────────────────────────────────┘
```