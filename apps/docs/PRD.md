# 📋 Acadchestra - Product Requirements Document (PRD)

## Version: 1.0.0
## Date: April 2026
## Author: Acadchestra Engineering Team

---

## 1. Executive Summary

**Acadchestra** (Acad + Orchestra) is a comprehensive multi-tenant SaaS school management platform that orchestrates all educational institution operations. The platform serves K-12 schools with role-based dashboards, real-time analytics, and a modern dark/light UI built with Next.js 16 and NestJS.

---

## 2. Product Vision

> "To transform educational administration through intelligent automation, creating seamless experiences for students, teachers, parents, and administrators while enabling data-driven decisions for academic excellence."

---

## 3. User Personas

### 3.1 Super Admin (Platform Owner)
- **Goals**: Manage all tenants (schools), monitor platform health, manage global users
- **Access**: Full platform access, no school-specific context
- **Key Actions**: Create/manage tenants, view system metrics, manage global users, database administration

### 3.2 School Admin
- **Goals**: Manage their school operations end-to-end
- **Access**: Tenant-scoped access to all school modules
- **Key Actions**: Manage users, students, teachers, academic structure, fees, roles

### 3.3 Principal
- **Goals**: Oversee academic performance and school operations
- **Access**: Read-heavy access with some management capabilities
- **Key Actions**: View dashboards, manage academic years, view reports

### 3.4 Teacher
- **Goals**: Manage classes, students, grades, and attendance
- **Access**: Limited to assigned classes and subjects
- **Key Actions**: Mark attendance, enter grades, manage class activities

### 3.5 Student
- **Goals**: View academic progress, fees, timetable
- **Access**: Read-only for personal academic data
- **Key Actions**: View grades, fees status, timetable, announcements

### 3.6 Parent
- **Goals**: Monitor child's academic progress and fees
- **Access**: Read-only linked to child's profile
- **Key Actions**: View child's grades, attendance, fees, communicate with teachers

---

## 4. Feature Requirements

### 4.1 Authentication & Authorization (P0 - Must Have)

| Feature | Description | Priority |
|---------|-------------|----------|
| Email/Password Login | JWT-based authentication | P0 |
| Role-Based Access Control | Granular permission system | P0 |
| Multi-tenant Isolation | Data separation per school | P0 |
| Session Management | Token refresh, logout | P0 |
| Forgot Password | Email-based password reset | P1 |
| Two-Factor Auth | TOTP-based 2FA | P2 |

### 4.2 Welcome Screen & Navigation (P0)

| Feature | Description | Priority |
|---------|-------------|----------|
| Module Cards | Role-based module selection after login | P0 |
| Floating Dock | macOS-style dock navigation | P0 |
| Full Dock Mode | Expanded sidebar navigation | P0 |
| Responsive Layout | Adapts to all screen sizes | P0 |
| Theme System | Dark/Light/System mode | P0 |

### 4.3 Super Admin Module (P0)

| Feature | Description | Priority |
|---------|-------------|----------|
| Tenant Management | CRUD for schools/organizations | P0 |
| System Health | Monitor platform health metrics | P0 |
| Global User Management | Manage users across all tenants | P0 |
| Database Statistics | View database table stats | P0 |
| System Metrics | Growth analytics, login activity | P0 |
| Audit Logs | View system-wide audit trail | P1 |

### 4.4 School Admin Module (P0)

| Feature | Description | Priority |
|---------|-------------|----------|
| Dashboard | School-specific stats and charts | P0 |
| Student Management | Full CRUD with search/filter | P0 |
| Teacher Management | Full CRUD with qualifications | P0 |
| User Management | Manage school users and roles | P0 |
| Academic Management | Years, terms, classes, subjects | P0 |
| Role Management | Create custom roles, assign permissions | P0 |
| Fee Management | Structures, payments, tracking | P1 |
| Settings | School profile, tenant config | P0 |

### 4.5 Data Tables (P0)

| Feature | Description | Priority |
|---------|-------------|----------|
| Server-side Pagination | 10/25/50/100 per page | P0 |
| Search | Full-text search across columns | P0 |
| Column Sorting | Ascending/descending per column | P0 |
| Filtering | Dropdown filters per field | P0 |
| Bulk Actions | Select multiple, bulk delete/export | P1 |
| Export | CSV/Excel export | P1 |
| Column Visibility | Toggle columns | P2 |

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Page load time: < 2 seconds
- API response time: < 500ms (95th percentile)
- Lighthouse score: > 90

### 5.2 Security
- JWT with short-lived access tokens
- RBAC with permission granularity
- Input validation on all endpoints
- XSS/CSRF protection
- Rate limiting

### 5.3 Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatible
- Color contrast ratios > 4.5:1

### 5.4 Responsiveness
- Mobile: 320px - 768px
- Tablet: 768px - 1024px
- Desktop: 1024px+
- Floating dock collapses to bottom bar on mobile

---

## 6. Release Plan

### Phase 1: Foundation (Current)
- ✅ Backend API (NestJS + Prisma)
- ✅ Authentication system
- ✅ Multi-tenant architecture
- 🔄 Frontend design system
- 🔄 Core components
- 🔄 Auth pages
- 🔄 Dashboard layouts
- 🔄 Super Admin pages
- 🔄 Admin pages

### Phase 2: Academic Core
- [ ] Attendance management
- [ ] Timetable system
- [ ] Basic fee management
- [ ] Notification system

### Phase 3: Advanced Features
- [ ] Examination system
- [ ] Financial reports
- [ ] Parent portal
- [ ] Library management

---

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| User onboarding time | < 5 minutes |
| Page load speed | < 2s |
| System uptime | 99.9% |
| User satisfaction | > 4.5/5 |
| Feature adoption | > 70% within 30 days |

---

## 8. Constraints & Dependencies

- **Backend**: NestJS API running on port 3001
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: Next.js 16 with App Router
- **State**: Zustand + React Query
- **Styling**: TailwindCSS with custom design tokens
- **Icons**: Custom SVG icons (no external icon library imports)