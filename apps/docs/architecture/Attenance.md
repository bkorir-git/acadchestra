# Attendance Module — Acadchestra

Production-ready, academic-year-scoped **Attendance** module for the Acadchestra school management platform. Covers backend (NestJS + Prisma + PostgreSQL) and frontend (Next.js 14 App Router + TypeScript + Tailwind). Also ships the enhanced **tabbed Class Detail page**, a fully-implemented **Teacher Dashboard**, a live **AttendanceChart** (replacing the empty placeholder), and a **StudentAttendancePanel** that plugs into your existing student detail page.

---

## 1. What you get

### Backend (`backend/`)
| Area | File |
|---|---|
| Prisma schema patch | `prisma/attendance.schema.prisma.patch` |
| DTOs | `src/attendance/dto/attendance.dto.ts` |
| Service | `src/attendance/attendance.service.ts` |
| Controller | `src/attendance/attendance.controller.ts` |
| Module | `src/attendance/attendance.module.ts` |
| AppModule wiring notes | `src/app.module.patch.ts` |
| Updated DashboardService (teacher stats + todayAttendance) | `src/dashboard/dashboard.service.ts` |

### Frontend (`frontend/`)
| Area | File |
|---|---|
| Types | `lib/types/attendance.ts` |
| API client | `lib/api/services/attendance.service.ts` |
| Endpoints patch | `lib/api/endpoints.attendance.patch.ts` |
| **Register UI** | `components/attendance/attendance-register.tsx` |
| Stats cards | `components/attendance/attendance-stats-cards.tsx` |
| Session list table | `components/attendance/session-list.tsx` |
| **Live trend chart** (replaces the empty one) | `components/dashboard/charts/attendance-chart.tsx` |
| Student-side panel | `components/attendance/student-attendance-panel.tsx` |
| Attendance home | `app/(dashboard)/attendance/page.tsx` |
| Class attendance page | `app/(dashboard)/attendance/classes/[classId]/page.tsx` |
| Reports page | `app/(dashboard)/attendance/reports/page.tsx` |
| Year-scoped attendance page | `app/(dashboard)/academic/[yearId]/attendance/page.tsx` |
| **Enhanced tabbed Class Detail** (year-scoped) | `app/(dashboard)/academic/[yearId]/classes/[classId]/page.tsx` |
| **New Teacher Dashboard** | `app/(dashboard)/dashboard/page.tsx` |
| Sidebar (with Attendance entry) | `components/layout/sidebar.tsx` |
| Floating dock (with Attendance icon) | `components/layout/floating-dock.tsx` |
| WorkspaceSubNav (with Attendance tab) | `components/academic/workspace-sub-nav.tsx` |

---

## 2. Architecture

### Domain model

```
AttendanceSession (one per class per day)
├── status        DRAFT | FINALIZED | LOCKED
├── type          DAILY | SUBJECT | AM | PM
├── aggregates    totalStudents, presentCount, absentCount, lateCount, excusedCount
├── classId       → Class
├── academicYearId → AcademicYear
├── academicTermId → AcademicTerm (optional)
└── records[]     AttendanceRecord
                  ├── studentId → Student
                  ├── status    PRESENT | ABSENT | LATE | EXCUSED | SICK | HOLIDAY
                  └── remark    optional
```

Key invariants:
- **Session uniqueness** is `(classId, sessionDate, type, subjectId)`. Re-opening the same register is idempotent.
- **Default is PRESENT.** Teacher's only job is to toggle absentees.
- **Aggregates** are source-of-truth-recomputed from records on every mark/update — never drift.
- **Tenancy** is enforced in every query via `tenantId`.
- **Role gating**: Teachers can only operate on classes where they are the class teacher OR teach a subject.
- **Locks**: Admin-only `LOCKED` state prevents further edits, mirroring academic-year locks.

### Flow (teacher workflow)

```
1. Teacher opens /attendance
   → GET /attendance/teacher/me/today (classes + today's session state)

2. Teacher clicks "Take Attendance" on a class card
   → /attendance/classes/:classId
   → GET /attendance/classes/:classId/today?academicYearId=...
     · If session exists: returns it + all records
     · Otherwise: returns a prepared roster (no DB writes yet)

3. Teacher toggles absentees in <AttendanceRegister/> (purely local state)

4. Teacher clicks Save
   → POST /attendance/sessions (upsert — no-op if already open)
   → POST /attendance/sessions/:id/mark   (bulk upsert records, recomputes aggregates)

5. Teacher clicks Finalize
   → PATCH /attendance/sessions/:id/finalize

6. Admin (optionally)
   → PATCH /attendance/sessions/:id/lock   (no further edits)
```

### Endpoints

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/attendance/sessions` | SuperAdmin, Admin, Principal, Teacher | Open / upsert session |
| GET | `/attendance/sessions` | same | Paginated list (filters: class, year, term, status, date range) |
| GET | `/attendance/sessions/:id` | same | Session detail + records |
| POST | `/attendance/sessions/:id/mark` | same | Bulk upsert records |
| PATCH | `/attendance/sessions/:id/records/:rid` | same | Edit one record |
| PATCH | `/attendance/sessions/:id/finalize` | same | Finalize |
| PATCH | `/attendance/sessions/:id/lock` | Admin+ | Lock |
| DELETE | `/attendance/sessions/:id` | Admin+ | Delete |
| GET | `/attendance/classes/:classId/today` | same | Today or prepared roster |
| GET | `/attendance/classes/:classId/stats` | same | Date-window stats + trend |
| GET | `/attendance/classes/:classId/report` | same | CSV-ready matrix |
| GET | `/attendance/students/:studentId/summary` | same | Per-student rate + recent |
| GET | `/attendance/dashboard/today` | same | Tenant today rollup |
| GET | `/attendance/dashboard/trend` | same | Daily series for chart |
| GET | `/attendance/teacher/me/today` | same | My classes today |

---

## 3. Installation

### 3a. Prisma — schema additions

Open `backend/prisma/attendance.schema.prisma.patch` and **append** the enums + models to your existing `schema.prisma`. Then add the relation fields to the existing models as instructed inside that file:

```prisma
model Tenant {
  // existing fields...
  attendanceSessions AttendanceSession[]
  attendanceRecords  AttendanceRecord[]
}

model Class {
  // existing fields...
  attendanceSessions AttendanceSession[]
}

model Student {
  // existing fields...
  attendanceRecords  AttendanceRecord[]
}

model AcademicYear {
  // existing fields...
  attendanceSessions AttendanceSession[]
}

model AcademicTerm {
  // existing fields...
  attendanceSessions AttendanceSession[]
}
```

Also **add two members to `ActivityEntityType`**:
```prisma
enum ActivityEntityType {
  // existing values...
  ATTENDANCE_SESSION
  ATTENDANCE_RECORD
}
```

Run the migration:
```bash
npx prisma migrate dev --name add_attendance_module
npx prisma generate
```

### 3b. Nest — register the module

Copy `backend/src/attendance/` (4 files) into `src/attendance/` in your project. Then in `src/app.module.ts`:

```ts
import { AttendanceModule } from './attendance/attendance.module';

@Module({
  imports: [
    // ...existing
    AcademicModule,
    AttendanceModule,  // ← add this
    // ...rest
  ],
})
export class AppModule {}
```

Also **replace** `src/dashboard/dashboard.service.ts` with the file from this package (adds teacher stats + today's attendance rate).

### 3c. Frontend — drop-in files

Copy the frontend files into the matching paths:
```
frontend/lib/types/attendance.ts
frontend/lib/api/services/attendance.service.ts
frontend/components/attendance/*
frontend/components/dashboard/charts/attendance-chart.tsx
frontend/app/(dashboard)/attendance/**
frontend/app/(dashboard)/academic/[yearId]/attendance/page.tsx
frontend/app/(dashboard)/academic/[yearId]/classes/[classId]/page.tsx
frontend/app/(dashboard)/dashboard/page.tsx
frontend/components/layout/sidebar.tsx
frontend/components/layout/floating-dock.tsx
frontend/components/academic/workspace-sub-nav.tsx
```

In `lib/api/endpoints.ts`, add the `ATTENDANCE` namespace as shown in `endpoints.attendance.patch.ts`.

> **Icon requirement** — the components use `ClockIcon` and `AlertIcon` from your `@/components/icons`. If those aren't exported, alias them:
> ```tsx
> export { Clock as ClockIcon, AlertCircle as AlertIcon } from "lucide-react";
> ```

> **Student detail integration** — drop `<StudentAttendancePanel studentId={student.id} />` inside your existing `app/(dashboard)/students/[id]/page.tsx` (behind a tab is best, to keep it lazy).

---

## 4. Design & performance notes

1. **Lazy loading everywhere.** Every tab, chart and table only fetches data when mounted. The `AttendanceChart` component even accepts a pre-fetched `trend` prop so pages that already have stats don't refetch.
2. **Indexed queries.** All hot paths (list by date window, dashboard rollups) rely on the composite indexes declared in the Prisma models — `(tenantId, sessionDate)`, `(tenantId, classId, sessionDate)`, `(tenantId, academicYearId, sessionDate)`.
3. **Aggregate columns.** `presentCount / absentCount / lateCount / excusedCount / totalStudents` are maintained on `AttendanceSession`, so dashboards, lists and stats never need a per-record COUNT/SUM.
4. **No N+1.** `TeacherDashboard` and `AdminDashboard` each issue at most two requests; the teacher view uses a single Prisma query with nested `include` for today's session.
5. **Upsert-safe marks.** Marking is idempotent via `(sessionId, studentId)` unique constraint + Prisma `upsert`.
6. **Multi-tenant safe.** Every query includes `tenantId`; every role check is centralized in `assertCanOperate`.
7. **Year-scoped UI.** The workspace sub-nav has a new **Attendance** tab; the flat `/attendance` is role-aware for teachers.

---

## 5. Testing checklist

- [ ] `npm run prisma:migrate` applies the new schema cleanly
- [ ] Login as **Admin** → /dashboard shows the live `AttendanceChart` and "Attendance Today" stat
- [ ] Login as **Teacher** → /dashboard shows progress widget + My Classes Today cards
- [ ] Click a class card → can toggle PRESENT↔ABSENT, Save, Finalize
- [ ] Refresh: the session + marks persist; reopening yields the same session (idempotent)
- [ ] /academic/{yearId}/classes/{classId} shows tabs, Attendance tab renders 30-day stats
- [ ] /academic/{yearId}/attendance shows year rollup + trend + history
- [ ] /attendance/reports generates and exports CSV correctly
- [ ] Admin locks a session → teacher cannot edit records anymore

---

## 6. Extending

- **Subject-period attendance**: set `type=SUBJECT` + `subjectId` on session creation. The unique tuple already supports this.
- **Parent portal**: `GET /attendance/students/:id/summary` already returns student-level rates. Plug it into a parent dashboard.
- **Push notifications**: on `ABSENT` record creation, emit an event (e.g. `EVENTS.ATTENDANCE_ABSENT`) and hook it into your existing NotificationService.
- **Timetable integration**: once you ship the timetable module, link `subjectId` on `AttendanceSession` to a `TimetableSlot` for per-period registers.

---

## 7. File tree

```
attendance-module/
├── README.md
├── backend/
│   ├── prisma/
│   │   └── attendance.schema.prisma.patch
│   └── src/
│       ├── app.module.patch.ts
│       ├── attendance/
│       │   ├── attendance.controller.ts
│       │   ├── attendance.module.ts
│       │   ├── attendance.service.ts
│       │   └── dto/
│       │       └── attendance.dto.ts
│       └── dashboard/
│           └── dashboard.service.ts
└── frontend/
    ├── app/(dashboard)/
    │   ├── attendance/
    │   │   ├── page.tsx
    │   │   ├── classes/[classId]/page.tsx
    │   │   └── reports/page.tsx
    │   ├── academic/[yearId]/
    │   │   ├── attendance/page.tsx
    │   │   └── classes/[classId]/page.tsx
    │   └── dashboard/page.tsx
    ├── components/
    │   ├── academic/workspace-sub-nav.tsx
    │   ├── attendance/
    │   │   ├── attendance-register.tsx
    │   │   ├── attendance-stats-cards.tsx
    │   │   ├── session-list.tsx
    │   │   └── student-attendance-panel.tsx
    │   ├── dashboard/charts/attendance-chart.tsx
    │   └── layout/
    │       ├── floating-dock.tsx
    │       └── sidebar.tsx
    └── lib/
        ├── api/
        │   ├── endpoints.attendance.patch.ts
        │   └── services/attendance.service.ts
        └── types/attendance.ts
```

---

## 8. License

Internal — Acadchestra. Not for public redistribution.
