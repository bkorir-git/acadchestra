# 📅 2-Day Execution Plan

> **Constraint:** End-to-end working onboarding in 48 hours.
> **Strategy:** Foundation first (schema + utilities), then the critical path
> (curriculum → academic year → first student admission), then polish.

---

## 🔴 BLOCKING DEPENDENCIES (Must finish before next can start)

```
[1] Schema  →  [2] Migration  →  [3] Common Utilities  →  [4] Curriculum  →  [5] Onboarding  →  [6] Students
```

After step 5, modules can parallelize.

---

## 📆 DAY 1 — Foundation (Schema + Utilities + Curriculum)

### Morning Block 1 (08:00–10:00) — Schema
- [ ] **schema.prisma** — full normalized schema with all new tables
- [ ] Run `npx prisma migrate dev --name v2_normalized_schema`
- [ ] Run `npx prisma generate`
- [ ] Smoke-test: `npx prisma studio` and verify all relations

**Deliverables:** `prisma/schema.prisma`, generated client

### Morning Block 2 (10:00–12:00) — Common Utilities

| Module                         | Files                          |
| ------------------------------ | ------------------------------ |
| `common/config`                | service, controller, module, dto |
| `common/policy`                | service, module                |
| `common/email`                 | service, module, templates dir |
| `common/admission-counter`     | service, module                |

Each is **standalone & dependency-free** so the rest of the system can use them.

### Afternoon Block 1 (13:00–15:00) — Curriculum & Templates

| Module                             | Files                          |
| ---------------------------------- | ------------------------------ |
| `common/curriculum-templates`      | service, controller, module    |
| `curriculum`                       | service, controller, module, dto|
| **Seed**: 5 curriculum templates   | `prisma/seeds/curriculum-templates.seed.ts` |

**Templates seeded:**
1. CBC (Kenya) — PP1, PP2, Grade 1–9
2. K-8-4-4 (Legacy Kenya) — Std 1–8, Form 1–4
3. British — Year 1–13
4. IGCSE — Y7, Y8, Y9, Y10, Y11
5. University Semester — Sem 1–8

### Afternoon Block 2 (15:00–17:00) — Onboarding Orchestrator

| Module        | Files                                    |
| ------------- | ---------------------------------------- |
| `onboarding`  | service (extended), controller, module   |
| **Tenants**   | refactor `bootstrap` to seed Config + AdmissionCounter |

**The flow:**
- `POST /tenants` (SuperAdmin) → bootstraps everything (Tenant, Admin User, Roles,
  TenantSettings, Default Configs, AdmissionCounter, Welcome Email)
- `GET /onboarding/checklist` → returns 6-step list with `currentStep` pointer
- `POST /onboarding/curriculum/adopt` → adopt a template (or POST custom)
- `PATCH /onboarding/configs/bulk` → write multiple configs at once
- `POST /onboarding/complete` → mark onboarded (banner disappears)

### Evening Block (17:00–19:00) — Guardian Module + Frontend Wizard

| Module       | Files                                |
| ------------ | ------------------------------------ |
| `common/guardians` | service, controller, module, dto |
| Frontend     | `app/(dashboard)/onboarding/page.tsx` (mandatory wizard) |

---

## 📆 DAY 2 — Domain Refactors + Frontend Wiring

### Morning Block 1 (08:00–10:00) — Students Refactor

- [ ] `students.service.ts` — uses `AdmissionCounterService`, `ConfigService`
- [ ] `students.controller.ts` — accepts guardians inline on creation
- [ ] DTO updates — optional email, optional userId
- [ ] Frontend `students/create/page.tsx` — guardian sub-form

### Morning Block 2 (10:00–12:00) — Classes & Streams

- [ ] `classes.service.ts` — uses `gradeId` instead of `gradeLevel`
- [ ] **NEW:** `streams` module (CRUD on Stream table)
- [ ] Frontend `classes/create/page.tsx` — picks Grade from dropdown, manages Streams as a sub-form

### Afternoon Block 1 (13:00–15:00) — Fee Engine Refactor

- [ ] `fees.service.ts` — resolves structure via stream → class → grade → school
- [ ] **NEW:** `fees/payment-rules` module (FeePaymentRule CRUD)
- [ ] Frontend `fees/structures/create/page.tsx` — scope picker (school/curriculum/grade/class/stream)
- [ ] Frontend `fees/payment-rules/page.tsx`

### Afternoon Block 2 (15:00–17:00) — Settings Page Refactor

- [ ] Frontend `settings/page.tsx` — split into tabs:
  - General (I18N + branding) → reads/writes TenantSettings
  - Academic Rules → reads/writes Config(category=academic)
  - Student Rules → reads/writes Config(category=student)
  - Guardian Rules → reads/writes Config(category=guardian)
  - Fee Rules → reads/writes Config(category=fee)
  - Security → reads/writes Config(category=security)
  - Notifications → reads/writes Config(category=comms)
  - Features → reads/writes Config(category=features)
- [ ] Reusable `<ConfigCategoryEditor />` component

### Evening Block (17:00–19:00) — Polish

- [ ] Email templates: welcome, password-reset, fee-reminder, term-starting
- [ ] Run end-to-end flow test:
  1. SuperAdmin creates school
  2. Admin logs in, sees wizard
  3. Adopts CBC template
  4. Creates academic year
  5. Sets configs in bulk
  6. Creates first class (auto-creates Stream A by default)
  7. Admits first student (admission #20260001 generated)
  8. Adds guardian inline
  9. Creates fee structure for Grade 1
  10. Generates first invoice
- [ ] Fix bugs found during E2E
- [ ] Final commit & deploy

---

## 🏁 Definition of Done — End of Day 2

A SuperAdmin can:
1. ✅ Create a tenant with `POST /tenants`
2. ✅ Receive temp password / welcome email

The new Admin can:
1. ✅ Log in, see the onboarding wizard
2. ✅ Adopt CBC curriculum (or pick another, or custom)
3. ✅ Create academic year + terms
4. ✅ Configure 5 categories of rules in one bulk save
5. ✅ Create classes (one per grade) with default Stream A
6. ✅ Admit a student (with optional email, optional roll number, with guardians)
7. ✅ See the auto-issued admission number `20260001`
8. ✅ Create a fee structure scoped to Grade 1
9. ✅ Configure term payment rules ("50% by week 2")
10. ✅ Generate invoices

UI:
- ✅ Onboarding banner shows progress and disappears when complete
- ✅ All settings pages render & save
- ✅ Year switcher chip works
- ✅ Capacity progress bar on tenant detail page

---

## 🚧 Out of Scope for 2 Days (Backlog)

- Bulk import (CSV) — Day 3
- Parent portal frontend — Day 3
- Online payments integration — Day 4
- SMS/Push notifications — Day 5
- Report builder — Week 2
- Mobile app — Week 3+

---

## 🛠 Conventions

- Every file starts with the file header (description + commit message)
- Every service method has JSDoc
- Every controller has Swagger `@ApiOperation`
- Every mutation logs to `ActivityLog`
- Every financial mutation logs to `FeeLedger`
- Every email send logs to `EmailDelivery`


## What's NEXT (Day 2 of plan)

These domain refactors **follow exactly the same pattern** as Students. Each one:
1. Reads its rules via `ConfigService.getCategory()`
2. Validates inputs against config-driven rules
3. Mutates inside a transaction
4. Logs to `ActivityService`
5. Emits an event
6. Optionally sends email via `EmailService`

The wizard hub (`onboarding/page.tsx`) links to these pages via the `step.href`
returned by `GET /onboarding/checklist` (the backend already returns the correct paths).

## 🗑 To delete

- `apps/backend/src/academic/academic-years/streams-config.helper.ts` — gone in v2
- `apps/backend/src/academic/academic-years/dto/streams-config.dto.ts` — gone in v2
- Any frontend import of `streams-config` helpers

## 🔧 What's still pending after this pack (Day-2 work, mechanical)

- Refactor `FeeStructure` resolution waterfall (stream → class → grade → curriculum → school)
- Fee structures FE pages aligned to scope picker