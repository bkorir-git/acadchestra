# 🔍 Flaws Audit — Old Schema → New Schema

This document is the **before-and-after** record of every structural problem we found
in the legacy schema, why it was a problem, and exactly how the new design fixes it.

> Read this with `prisma/schema.prisma` open in another tab. Every fix referenced
> here is implemented and committed.

---

## 🚨 SEVERITY LEGEND

| Symbol | Severity     | Impact                                              |
| ------ | ------------ | --------------------------------------------------- |
| 🔴     | Critical     | Blocks scaling / forces hacks / data corruption     |
| 🟠     | High         | Wrong data model / hard to evolve                   |
| 🟡     | Medium       | Bloat / redundancy / weak typing                    |

---

## 🔴 FLAW 1 — `Class` Model Is Overloaded

### Old
```prisma
model Class {
  gradeLevel  Int          // ← grade lives here as an int
  stream      String?      // ← stream is a string
  curriculum  String?      // ← curriculum is a string
  ...
}
```

### Why it's broken
- A `Class` should describe **a section of a grade**, not the grade itself.
- `gradeLevel: Int` can't represent PP1, PP2, Form 1, Year 7, Sem 3.
- `stream: String` defeats referential integrity. Two classes can't share
  a stream's capacity rule. Renaming a stream means a `findMany` + `updateMany`.
- `curriculum: String` means every class drags around the curriculum identity.

### New
```prisma
model Class {
  id             String   @id @default(cuid())
  name           String          // "Grade 1 East", "Form 3 Blue", "Sem 2 Group A"
  displayName    String?
  capacity       Int      @default(40)
  classType      ClassType @default(REGULAR)

  gradeId        String          // ← FK to Grade
  grade          Grade    @relation(fields: [gradeId], references: [id])

  academicYearId String
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])

  classTeacherId String?
  classTeacher   Teacher? @relation(fields: [classTeacherId], references: [id])

  streams        Stream[]
  students       Student[]
  // ...
}
```

The `Curriculum` is reachable via `class.grade.curriculum` — no duplication.

---

## 🔴 FLAW 2 — `gradeLevel: Int` Is Hardcoded for K-12 Numeric Schools

### Old
```prisma
gradeLevel  Int   // assumes "1, 2, 3, ..."
```

### Why it's broken
- CBC: PP1, PP2, Grade 1, Grade 2, ...
- British: Year 1, Year 2, ..., Year 13
- Kenya 8-4-4: Std 1, ..., Std 8, Form 1, ..., Form 4
- University: Sem 1, ..., Sem 8 (or Year 1.1, 1.2)
- Vocational: Module A, Module B, ...

A single `Int` can't represent any of those.

### New
```prisma
model Grade {
  id           String     @id @default(cuid())
  name         String     // ← "PP1", "Grade 1", "Form 3", "Sem 2"
  displayName  String?    // ← "Pre-Primary 1"
  levelOrder   Int        // ← used ONLY for promotion sorting
  curriculumId String
  tenantId     String

  curriculum   Curriculum @relation(...)
  classes      Class[]
  feeStructures FeeStructure[]

  @@unique([tenantId, curriculumId, levelOrder])
  @@unique([tenantId, curriculumId, name])
}
```

`levelOrder` is **internal**, never displayed. UI uses `name` / `displayName`.

---

## 🔴 FLAW 3 — `stream: String` Loses Referential Integrity

### Old
```prisma
model Class {
  stream  String?   // "A", "Red", "Science"
}
```

### Why it's broken
- No way to enforce `capacity` per stream.
- Renaming a stream is a string-replace nightmare.
- No way to attach a stream to a teacher, schedule, or fee.
- Streams configuration shoved into JSON (`streamsByGrade`).

### New
```prisma
model Stream {
  id        String  @id @default(cuid())
  name      String  // "A", "Red", "Science"
  capacity  Int?
  color     String? // for UI

  classId   String
  class     Class   @relation(fields: [classId], references: [id], onDelete: Cascade)

  tenantId  String
  tenant    Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  students  Student[]

  @@unique([classId, name])
}
```

Now stream config is just `Class.streams` — a relation, not JSON.

---

## 🔴 FLAW 4 — `streamsByGrade: Json` On AcademicYear

### Old
```prisma
model AcademicYear {
  streamsByGrade  Json?  @default("{}")
  //  e.g. { "1": ["A", "B"], "3": [] }
}
```

### Why it's broken
- Grade IDs are strings now, not Ints (so the keys break).
- No FK validation — a grade can be deleted without cleaning the JSON.
- Can't query "which years allow stream Red in Grade 3?" without parsing JSON.
- Migration nightmare on schema changes.

### New
**DELETED.** Streams now live in the `Stream` table, scoped to a `Class` which is
already scoped to an `AcademicYear` (via `Class.academicYearId`). The data is
implicit in the existing relations.

If a year-wide stream config is needed (e.g. "in 2026, every Class in Grade 3 must
offer Streams Red & Blue"), that's a **policy** (`Policy` table), not data.

---

## 🟠 FLAW 5 — `Student.userId` Is Mandatory

### Old
```prisma
model Student {
  userId String @unique
  user   User   @relation(...)
}
```

### Why it's broken
- A 4-year-old in PP1 has no email and no login.
- Forces creation of "fake" User rows just to satisfy the FK.
- Login concerns leak into student admission flow.

### New
```prisma
model Student {
  // Personal info lives ON Student (not User)
  firstName  String
  lastName   String
  ...

  // Optional User link — only for students with login
  userId     String? @unique
  user       User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

A `User` is created **lazily** — only when the student is enrolled in a portal-eligible
grade or when a parent registers their child for online access.

---

## 🟠 FLAW 6 — Mandatory `rollNumber` and `email`

### Old
```prisma
model Student {
  rollNumber  String?  // sometimes required, sometimes not — service-level chaos
  ...
}
model User {
  email  String  @unique  // always required
}
```

### Why it's broken
- Lower-primary students don't have emails. Forcing one creates fake data.
- Some schools use roll numbers, others don't. Forcing one creates noise.

### New
- `email` on `Student` is `String?` (optional)
- `email` on `User` remains required (User = login identity)
- `rollNumber` is `String?` and **only auto-generated if** `config.student.autoGenerateRollNumber === true`
- Validation enforced via `ConfigService` at the service layer, not at the DB layer

---

## 🟠 FLAW 7 — `FeeStructure.gradeLevel: Int` Same Hardcoding

### Old
```prisma
model FeeStructure {
  gradeLevel  Int?
}
```

### Why it's broken
- Same problem as Flaw 2 — Int doesn't represent string grades.
- Can't fee a curriculum-wide structure (e.g. "All CBC students pay X").

### New
```prisma
model FeeStructure {
  gradeId      String?    // FK to Grade
  classId      String?    // FK to Class (most specific)
  streamId     String?    // FK to Stream (even more specific)

  scope        FeeStructureScope
  // SCHOOL_WIDE | CURRICULUM_WIDE | GRADE | CLASS | STREAM
}
```

Resolution at billing time: stream → class → grade → curriculum → school.

---

## 🟡 FLAW 8 — `TenantSettings` Is a 60-Column God Table

### Old
```prisma
model TenantSettings {
  // Localization
  currency, currencySymbol, currencyPosition, currencyDecimals, timezone, locale, dateFormat, timeFormat, firstDayOfWeek
  // Branding
  logoUrl, faviconUrl, primaryColor, secondaryColor, brandTagline
  // Academic
  defaultGradingScale, passingGrade, attendanceThreshold
  // Fees
  receiptPrefix, invoicePrefix, enableLateFees, lateFeePercentage, lateFeeGraceDays, enabledPaymentMethods, allowPartialPayments, allowOverpayment, requirePaymentReference, defaultAllocationStrategy, autoCarryForwardArrears
  // Notifications
  enableEmailNotifications, enableSmsNotifications, enablePushNotifications, feeReminderDays, termActivationReminderDays
  // Security
  sessionTimeoutMinutes, passwordMinLength, passwordRequireUppercase, passwordRequireNumber, passwordRequireSymbol, requireTwoFactor, maxLoginAttempts, lockoutDurationMinutes
  // Comms
  emailSenderName, emailSenderAddress, smsProvider, smsSenderId
  // Features
  enableParentPortal, enableStudentPortal, enableOnlinePayments, enableBulkImport, enableAutoPromotion
  // Custom
  customFields  Json?
}
```

### Why it's broken
- Every new rule needs a migration.
- Mixing **stable I18N** (read on every request) with **rare overrides** (security
  policies, edited once a year) gives the worst of both worlds for caching.
- A single page that updates "fee reminder days" rewrites a 60-column row.

### New — Hybrid Split

**`TenantSettings` keeps ONLY I18N + Branding** (stable, read on every request, typed):

```prisma
model TenantSettings {
  currency, currencySymbol, currencyPosition, currencyDecimals
  timezone, locale, dateFormat, timeFormat, firstDayOfWeek
  logoUrl, faviconUrl, primaryColor, secondaryColor, brandTagline
}
```

**Everything else moves to `Config`** (category/key/value):

```prisma
model Config {
  id        String   @id @default(cuid())
  tenantId  String
  category  String   // 'academic' | 'student' | 'guardian' | 'fee' | 'security' | 'comms' | 'features'
  key       String   // 'requireEmail', 'enableLateFees', etc.
  value     Json     // primitive | array | object

  @@unique([tenantId, category, key])
  @@index([tenantId, category])
}
```

### Why this is better
- ✅ Add a config in 0 migrations
- ✅ Bulk-load by category in one query (cached)
- ✅ Type safety preserved at service boundary via Zod schemas
- ✅ Settings page becomes "Settings + N Config Categories" — modular UI

---

## 🟠 FLAW 9 — No Curriculum Tables At All

### Old
```prisma
// curriculum: String   on Class — a free-text field. That's it.
```

### Why it's broken
- Two schools using "CBC" might spell it differently → can't compare.
- No way to define "what grades does CBC have?"
- No way for SuperAdmin to ship templates.
- No way for Admin to fork & customize.

### New
```prisma
// SuperAdmin-managed (system-wide)
model CurriculumTemplate {
  id           String  @id @default(cuid())
  name         String  @unique          // "CBC", "British", "IGCSE", ...
  code         String  @unique
  country      String?
  description  String?
  isPublished  Boolean @default(true)

  defaultTermStructure TermStructure?

  grades       GradeTemplate[]
}

model GradeTemplate {
  id                   String @id @default(cuid())
  name                 String          // "PP1", "Grade 1", "Form 3"
  displayName          String?
  levelOrder           Int

  curriculumTemplateId String
  curriculumTemplate   CurriculumTemplate @relation(...)

  @@unique([curriculumTemplateId, levelOrder])
  @@unique([curriculumTemplateId, name])
}

// Tenant-adopted (per-school, customizable)
model Curriculum {
  id            String  @id @default(cuid())
  tenantId      String
  name          String
  code          String?
  description   String?
  isActive      Boolean @default(true)
  isDefault     Boolean @default(false)

  // Provenance — null if custom-built
  templateId    String?
  template      CurriculumTemplate? @relation(...)

  grades        Grade[]

  @@unique([tenantId, name])
}
```

Onboarding flow:
1. Admin sees template list
2. Picks "CBC", optionally caps at "Grade 6"
3. System forks → creates `Curriculum` + `Grade[]`
4. Admin can rename, add, remove grades freely (no template coupling)

---

## 🔴 FLAW 10 — No Guardian Table

### Old
```prisma
model Student {
  emergencyContact String?
  emergencyPhone   String?
}
```

### Why it's broken
- A student can have **multiple** guardians (mother + father + uncle)
- One guardian can have **multiple** students (siblings)
- A guardian needs their own profile (occupation, address, optional login)
- Free-text `emergencyContact` is impossible to deduplicate, search, or contact

### New
```prisma
model Guardian {
  id          String   @id @default(cuid())
  firstName   String
  lastName    String
  email       String?
  phone       String
  occupation  String?
  address     String?
  nationalId  String?

  // Optional User link — for parent portal login
  userId      String?  @unique
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  students    StudentGuardian[]
}

model StudentGuardian {
  id                 String   @id @default(cuid())
  studentId          String
  guardianId         String
  relationship       GuardianRelationship  // MOTHER | FATHER | GUARDIAN | UNCLE | ...
  isPrimary          Boolean  @default(false)
  isEmergencyContact Boolean  @default(false)
  canPickup          Boolean  @default(true)
  receivesFinancials Boolean  @default(true)

  student            Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  guardian           Guardian @relation(fields: [guardianId], references: [id], onDelete: Cascade)

  @@unique([studentId, guardianId])
}
```

---

## 🔴 FLAW 11 — Admission Numbers Are Race-Unsafe

### Old
```prisma
model Student {
  admissionNumber  String  // unique per tenant, but how is it generated?
}
```

The service code did something like:
```ts
const last = await prisma.student.findFirst({ orderBy: { admissionNumber: 'desc' }});
const next = parseInt(last.admissionNumber) + 1;
await prisma.student.create({ data: { admissionNumber: String(next) }});
```

### Why it's broken
- Two simultaneous admissions → both compute the same `next` → duplicate key error
- No way to set a year prefix or padding without code changes
- No way to migrate from legacy data
- No audit of issuance

### New
```prisma
model AdmissionCounter {
  id              String            @id @default(cuid())
  tenantId        String            @unique  // ONE counter per tenant
  prefix          String            @default("")
  yearPrefix      String?
  currentSequence Int               @default(0)
  paddingLength   Int               @default(4)
  strategy        AdmissionStrategy @default(SEQUENTIAL)
  lastIssuedAt    DateTime?

  tenant          Tenant            @relation(...)
}

enum AdmissionStrategy {
  SEQUENTIAL        // 0001
  YEAR_PREFIXED     // 20260001
  CUSTOM_PREFIXED   // GW0001
}
```

Service uses `SELECT ... FOR UPDATE` inside a transaction. **No race possible.**

---

## 🔴 FLAW 12 — No Configuration Engine

### Old
Business rules were either:
1. Hardcoded in services (`if (!email) throw`)
2. Stored as columns on `TenantSettings` (60+ of them)
3. Stuffed into `Tenant.feeConfiguration: Json` (no schema, no validation)

### Why it's broken
- Adding a rule = code change + migration + redeploy
- No tenant-level overrides
- Frontend has no single source of truth for "what's required?"

### New
```prisma
model Config {
  id        String   @id @default(cuid())
  tenantId  String
  category  String   // namespace
  key       String
  value     Json     // any shape
  isLocked  Boolean  @default(false)  // SuperAdmin can lock critical configs
  description String?

  @@unique([tenantId, category, key])
  @@index([tenantId, category])
}

model Policy {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  category  String
  rules     Json     // expression tree (JSONLogic / custom DSL)
  isActive  Boolean  @default(true)
  priority  Int      @default(100)
}
```

Frontend asks `GET /config/category/student` → renders the dynamic form.
Adding a new rule = `INSERT INTO configs ...` — zero migrations.

---

## 🟡 FLAW 13 — Redundant `Tenant.gradeStructure` and `Tenant.feeConfiguration`

### Old
```prisma
model Tenant {
  gradeStructure   Json?
  feeConfiguration Json?
}
```

### Why it's broken
- `gradeStructure` is now in `Curriculum` + `Grade`
- `feeConfiguration` is now in `Config` (category=`fee`)
- Two sources of truth → bugs

### New
**DELETED.** Both columns gone.

---

## ➕ NEW TABLES ADDED (Summary)

| Table                  | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `CurriculumTemplate`   | SuperAdmin-managed master curricula                    |
| `GradeTemplate`        | Master grades inside a template                        |
| `Curriculum`           | Per-tenant curriculum (often forked from a template)   |
| `Grade`                | Per-tenant grades (replaces `gradeLevel: Int`)         |
| `Stream`               | Replaces `Class.stream: String`                        |
| `Guardian`             | Parent / guardian profile                              |
| `StudentGuardian`      | M:N join with relationship metadata                    |
| `AdmissionCounter`     | Race-safe admission number issuance                    |
| `Config`               | Category/key/value tenant rules                        |
| `Policy`               | Conditional rules (advanced)                           |
| `FeePaymentRule`       | Term payment % schedule (e.g. "50% by week 2")         |
| `EmailTemplate`        | Reusable email bodies (welcome, fee reminder, …)       |
| `EmailDelivery`        | Audit log of every email sent                          |

---

## ❌ TABLES / COLUMNS DELETED

| What                              | Why                                   |
| --------------------------------- | ------------------------------------- |
| `Tenant.gradeStructure: Json`     | Replaced by `Grade` table             |
| `Tenant.feeConfiguration: Json`   | Replaced by `Config` (category=fee)   |
| `AcademicYear.streamsByGrade: Json`| Replaced by `Stream` table           |
| `Class.gradeLevel: Int`           | Replaced by `Class.gradeId`           |
| `Class.stream: String`            | Replaced by `Stream` table            |
| `Class.curriculum: String`        | Reachable via `Class.grade.curriculum`|
| `FeeStructure.gradeLevel: Int`    | Replaced by `FeeStructure.gradeId`    |
| `Student.emergencyContact/Phone`  | Replaced by Guardian table            |
| 50+ columns on `TenantSettings`   | Moved to `Config` table               |

---

## ✅ MIGRATION PATH (Production)

This is a structural rewrite, but here's a safe phased approach:

1. **Phase A — Additive**
   - Add new tables: `Curriculum`, `Grade`, `Stream`, `Guardian`, `StudentGuardian`,
     `AdmissionCounter`, `Config`, `FeePaymentRule`, `EmailTemplate`
   - Add new optional columns: `Class.gradeId`, `FeeStructure.gradeId/streamId`
   - Backfill: for each tenant create a "Legacy" Curriculum and one Grade per
     existing `gradeLevel`. Map `Class.gradeLevel` → `Class.gradeId`.
   - Backfill: for each `Class.stream` value, create a Stream row.
   - Backfill: copy `TenantSettings` non-I18N columns into `Config` rows.
   - Backfill: initialize an `AdmissionCounter` for each tenant from the max
     existing `Student.admissionNumber`.

2. **Phase B — Dual-write**
   - Services write to BOTH old and new fields for one release.
   - Read from new fields only.
   - Run consistency checks via a daily job.

3. **Phase C — Drop**
   - Drop old columns: `Class.gradeLevel`, `Class.stream`, `Class.curriculum`,
     `FeeStructure.gradeLevel`, `Tenant.gradeStructure`, `Tenant.feeConfiguration`,
     `AcademicYear.streamsByGrade`, the 50+ `TenantSettings` columns.

For greenfield (this project): just apply the new schema directly.

---

> Every flaw above is fixed in the new `prisma/schema.prisma`. Every fix is
> exercised by the new modules under `src/`. Tests follow.
