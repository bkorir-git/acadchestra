## Backend endpoints required

| Endpoint                                       | Source module                |
| ---------------------------------------------- | ---------------------------- |
| `GET /students?...filters`                     | StudentsModule               |
| `GET /students/:id`                            | StudentsModule               |
| `POST /students`                               | StudentsModule               |
| `PATCH /students/:id`                          | StudentsModule               |
| `DELETE /students/:id`                         | StudentsModule               |
| `POST /students/:id/transfer`                  | StudentsModule (Day-2 add)   |
| `GET /academic/class-history/student/:id`      | StudentClassHistoryModule    |
| `GET /fees/student-fees?studentId=…`           | FeesModule                   |
| `GET /admission-counter`                       | AdmissionCounterModule       |
| `GET /admission-counter/peek`                  | AdmissionCounterModule       |
| `GET /guardians?...`                           | GuardiansModule              |
| `GET /guardians/:id`                           | GuardiansModule              |
| `GET /guardians/:id/students`                  | GuardiansModule              |
| `POST /guardians`                              | GuardiansModule              |
| `PATCH /guardians/:id`                         | GuardiansModule              |
| `DELETE /guardians/:id`                        | GuardiansModule              |
| `POST /guardians/link/:studentId`              | GuardiansModule              |
| `DELETE /guardians/link/:studentId/:guardianId`| GuardiansModule              |
| `GET /academic/classes?...`                    | ClassesModule                |
| `GET /academic/classes/:id`                    | ClassesModule                |
| `GET /academic/classes/:id/streams`            | ClassesModule (Day-2 add)    |
| `GET /curriculum`                              | CurriculumModule             |
| `GET /config/category/:category`               | ConfigModule                 |

## Backend gaps to close (Day-2 work)

1. **`POST /students/:id/transfer`** — accepts `{ classId, streamId?, reason? }`,
   creates a new StudentClassHistory row, closes the previous one, updates
   denormalised `Student.classId/streamId`. Pattern: same as the existing
   `StudentClassHistoryService.createEntry`.

2. **`GET /academic/classes/:id/streams`** — returns the streams for a class.
   Trivial controller adding `@Get(':id/streams')` to `ClassesController`,
   delegating to `prisma.stream.findMany({ where: { classId } })`.

## Smoke test checklist

After integrating:

- [ ] `/students` loads without error
- [ ] Filters work (class, status, search)
- [ ] `/students/create` shows the admission preview card with a real number
- [ ] Required-field stars (*) appear or disappear based on your config
- [ ] Cascading picker: pick grade → classes filter; pick class → streams load
- [ ] Inline guardian creation works; "Find existing" search returns matches
- [ ] Submitting creates the student AND shows the success modal with the issued admission number
- [ ] `/students/[id]` shows all 6 tabs
- [ ] Edit, change status, transfer modals all save and refresh
- [ ] Guardian unlink works
- [ ] Bulk import page renders the stub (no errors)


# 🎯 NEXT STEP — What to Build After Students

You now have:
- ✅ Complete v2 schema
- ✅ Onboarding wizard (curriculum / academic year / configuration)
- ✅ Backend Students module (with admission counter + guardians + email)
- ✅ **Frontend Students module** (this delivery)

## Your Critical Path Forward

```
1. CLASSES + STREAMS-DONE
        ↓
2. FEE STRUCTURES + PAYMENT RULES - START HERE
        ↓
3. STUDENT FEES + BILLING RUN UI
        ↓
4. PAYMENTS + INVOICES
        ↓
5. ATTENDANCE (already partly built)
```

---

## STEP 1 — Classes + Streams (1 day)

The Students module DEPENDS on the cascading class picker. Right now the
hook degrades gracefully if `/academic/classes/:id/streams` is missing,
but you'll want it for production.

### Backend DONE

**1.1 — Streams CRUD module** (NEW: `src/academic/streams/`)

```
streams.service.ts      — list, create, update, remove (per class)
streams.controller.ts   — GET/POST/PATCH/DELETE /academic/streams[/...]
                          + GET /academic/classes/:id/streams (delegate)
streams.module.ts
dto/stream.dto.ts
```

Schema is already in place (`Stream` model). Service is ~80 lines —
copy the `GuardiansService` pattern.

**1.2 — Add `transfer` endpoint to StudentsController**

```ts
@Post(':id/transfer')
@Roles('SuperAdmin', 'Admin', 'Principal')
transfer(
  @Param('id') id: string,
  @Body() dto: TransferStudentDto,
  @CurrentUser() user: any,
) {
  return this.service.transfer(id, dto, user);
}
```

The service calls `StudentClassHistoryService.createEntry(...)` then updates
`Student.classId/streamId`. ~30 lines.

### Frontend gaps to close

**1.3 — Refactor `app/(dashboard)/academic/[yearId]/classes/create/page.tsx`**

The legacy page uses `gradeLevel: Int` + `stream: String`. Refactor to:
- Pick `grade` from dropdown (loaded from `/curriculum/{defaultId}`)
- Add a "Streams" section with add-row UX (like the guardians sub-form)
- POST `/academic/classes` with `gradeId` + `streams: [{name, capacity}]`


---




WE ARE STARTING HERE ::::::::


## STEP 2 — Fee Structures + Payment Rules (1.5 days)

This is the second-most-complex flow after Students.

### What needs building

**2.1 — Fee Structure form** with the cascading SCOPE picker:

```
Scope:  ◯ School-wide  ◯ Curriculum  ◯ Grade  ◯ Class  ◯ Stream
        └─ Picker appears based on choice (reuses our cascading hook)

Components: [add multiple]
  • Tuition         KES 25,000   Compulsory  Academic
  • Transport       KES 5,000    Optional    Transport
  • ...
```

**2.2 — Fee Payment Rules manager** (NEW page)

The schema is in place (`FeePaymentRule` table). Build:
- `lib/api/services/fee-payment-rules.service.ts`
- `app/(dashboard)/fees/payment-rules/page.tsx` with a simple table:

```
| Term      | By Week | Min %  |   |
|-----------|---------|--------|---|
| Term 1    | 2       | 50%    | ✏️ |
| Term 1    | 6       | 100%   | ✏️ |
| All terms | 4       | 75%    | ✏️ |
```

Drives the `fee_due_soon` / `fee_overdue` notifications.

**2.3 — Refactor existing Fee Structure pages**

Your `app/(dashboard)/fees/structures/create/page.tsx` exists but uses
the old `gradeLevel` shape. Update its DTO, scope picker, and submit
payload to match the v2 schema.

### Backend gaps

- `POST /fees/payment-rules` CRUD
- `GET /fees/structures/resolve?studentId=…` — returns the most-specific
  fee structure (stream → class → grade → curriculum → school) for a student.
  This is the **resolution waterfall** described in `docs/README.md` §10.

---

## STEP 3 — Student Fees + Billing Run UI (1 day)

### What needs building

**3.1 — Student Fees list page** is already in your repo, but needs the new
filters: by class, by stream, by status (PENDING / PARTIAL / PAID / OVERDUE).

**3.2 — Billing Run wizard** (`app/(dashboard)/fees/billing/page.tsx` already exists)

Step 1: Pick scope (term, class, fee structure)
Step 2: Preview — table of "X students will be billed Y total"
Step 3: Confirm → server creates StudentFee rows + invoices in batch

The backend BillingService likely exists in your repo — wire the UI to it.

**3.3 — Per-student fee detail** with payment history + outstanding tabs.

---

## STEP 4 — Payments + Invoices (1 day)

Your repo already has the directory structure for these. The schema is
in place. The work is mostly UI:

- Record payment modal (already exists, may need DTO updates)
- Invoice detail page with print view
- Payment allocation visualization (which components got paid first)

---

## STEP 5 — Attendance (existing, polish only)

You already have a working attendance module. After Students refactor,
the only update needed is:
- The teacher's "My classes today" widget should fetch from the new
  classes-with-streams endpoint
- Attendance reports gain a stream filter

---

## Suggested 5-day timeline from here

| Day | Morning              | Afternoon                  |
| --- | -------------------- | -------------------------- |
| 1   | Streams CRUD backend | Classes form refactor (FE) |
| 2   | Transfer endpoint    | Fee structure form (FE)    |
| 3   | Fee payment rules    | Billing run wizard         |
| 4   | Resolution waterfall | Payment + invoice polish   |
| 5   | E2E test + bug fixes | Demo prep                  |

---

## Pattern Library (already established — just copy)

Every domain refactor follows the SAME 6 steps:

1. **Service** consumes `ConfigService.getCategory()` for rules
2. **Validate** inputs against config + DB constraints
3. **Mutate** inside a `prisma.$transaction()`
4. **Log** to `ActivityService`
5. **Emit** event via `EventEmitter2`
6. **Optional** email via `EmailService`

Frontend:

1. **Service** in `lib/api/services/`
2. **Types** in `lib/types/`
3. **Hooks** for stateful logic (`use-cascading-*`, `use-*-config`)
4. **Form sections** as separate Card-based components
5. **Pages** orchestrate sections and handle submit/error/toast
6. **Modals** for in-context actions (status change, transfer, delete)

If you stick to this pattern, the next 5 days are mostly typing.

---

## Don't forget

- Add an "Onboarding Required" guard to `app/(dashboard)/layout.tsx` so
  fresh admins are auto-pushed to `/onboarding`: THIS IS DONE ALREADY

```tsx
useEffect(() => {
  if (user?.userRoles?.some(r => r.role?.name === 'SuperAdmin')) return;
  onboardingService.getChecklist().then(c => {
    if (!c.blockingComplete && !pathname.startsWith('/onboarding')) {
      router.push('/onboarding');
    }
  });
}, [user, pathname]);
```

- Add to sidebar after Students:
  - **Streams** (NEW) — `/academic/[yearId]/streams` DONE ALREADY
  - **Fee Payment Rules** (NEW) — `/fees/payment-rules`

---

> **Mantra:** Every domain refactor follows the same 6-step pattern.
> Same shape, different data. Ship one a day.
