/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Greenfield CBC Primary School — Comprehensive Test Seed
 *  Run: ts-node prisma/seeds/seed-cbc-school.ts
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  What this creates
 *  ─────────────────
 *  • Tenant   : Greenfield CBC Primary School (greenfield.acadchestra.com)
 *  • Roles    : Admin, Principal, Teacher, Student, Parent, SuperAdmin
 *  • Users    : 1 admin + 1 principal + 12 class teachers + 240 students
 *  • Academic : Year 2026 · Term 1 (locked/completed) · Term 2 (active) · Term 3
 *  • Periods  : Terms, holidays, mid-term breaks, exam weeks
 *  • Classes  : Grade 1–6 × East & West = 12 classes (20 students each)
 *  • Subjects : Full CBC-aligned curriculum per grade (Lower & Upper Primary)
 *  • Attendance: 10 school days × 12 classes = 120 sessions, 2 400 records (Term 1)
 *  • Exams    : End-of-Term 1 examinations per grade
 *
 *  Password for EVERY user: Admin123!
 * ═══════════════════════════════════════════════════════════════════════
 */

import {
  PrismaClient,
  Gender,
  AcademicYearStatus,
  ClassType,
  SubjectCategory,
  StudentStatus,
  EmploymentStatus,
  AttendanceStatus,
  AttendanceSessionStatus,
  AttendanceSessionType,
  ExamType,
  AcademicPeriodType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════
// ① MASTER DATA
// ═══════════════════════════════════════════════════════════════════════

/** 20 male first names — one per male student slot in each class */
const MALE_FIRST = [
  'Amani',   'Baraka',  'Chidi',   'Daudi',   'Elias',
  'Fadhili', 'Gabriel', 'Hassan',  'Ibrahim', 'Jabari',
  'Kamau',   'Lewis',   'Mwenda',  'Nathan',  'Obinna',
  'Patrick', 'Reuben',  'Samuel',  'Titus',   'Yusuf',
];

/** 20 female first names — one per female student slot in each class */
const FEMALE_FIRST = [
  'Aisha',    'Beatrice', 'Carol',   'Diana',   'Esther',
  'Fatuma',   'Grace',    'Hannah',  'Irene',   'Jane',
  'Kezia',    'Lilian',   'Mary',    'Nancy',   'Olive',
  'Patricia', 'Rose',     'Sarah',   'Tabitha', 'Winnie',
];

/** 40 last names — rotated across classes to minimise repeats */
const LAST_NAMES = [
  'Kamau',    'Wanjiku',   'Ochieng',  'Mutua',     'Kipchoge',
  'Otieno',   'Mwangi',    'Njoroge',  'Waweru',    'Karimi',
  'Omondi',   'Akinyi',    'Mbeki',    'Koech',     'Rotich',
  'Chebet',   'Njogu',     'Macharia', 'Gitau',     'Kimani',
  'Okello',   'Adhiambo',  'Nyambura', 'Gicheru',   'Maina',
  'Wairimu',  'Kipkoech',  'Chepkorir','Musyoka',   'Kilonzo',
  'Muema',    'Nzau',      'Ogola',    'Onyango',   'Achieng',
  'Were',     'Simiyu',    'Wekesa',   'Barasa',    'Masinde',
];

/** One class teacher per class, matched by classKey */
const TEACHER_PROFILES = [
  { firstName: 'Jane',   lastName: 'Wanjiku',  gender: Gender.FEMALE, classKey: 'G1E', designation: 'Class Teacher',  dept: 'Lower Primary' },
  { firstName: 'David',  lastName: 'Kamau',    gender: Gender.MALE,   classKey: 'G1W', designation: 'Class Teacher',  dept: 'Lower Primary' },
  { firstName: 'Mary',   lastName: 'Otieno',   gender: Gender.FEMALE, classKey: 'G2E', designation: 'Class Teacher',  dept: 'Lower Primary' },
  { firstName: 'James',  lastName: 'Mwangi',   gender: Gender.MALE,   classKey: 'G2W', designation: 'Class Teacher',  dept: 'Lower Primary' },
  { firstName: 'Grace',  lastName: 'Njoroge',  gender: Gender.FEMALE, classKey: 'G3E', designation: 'Class Teacher',  dept: 'Lower Primary' },
  { firstName: 'Peter',  lastName: 'Ochieng',  gender: Gender.MALE,   classKey: 'G3W', designation: 'Class Teacher',  dept: 'Lower Primary' },
  { firstName: 'Faith',  lastName: 'Mutua',    gender: Gender.FEMALE, classKey: 'G4E', designation: 'Class Teacher',  dept: 'Upper Primary' },
  { firstName: 'John',   lastName: 'Kipchoge', gender: Gender.MALE,   classKey: 'G4W', designation: 'Class Teacher',  dept: 'Upper Primary' },
  { firstName: 'Rose',   lastName: 'Akinyi',   gender: Gender.FEMALE, classKey: 'G5E', designation: 'Class Teacher',  dept: 'Upper Primary' },
  { firstName: 'Paul',   lastName: 'Rotich',   gender: Gender.MALE,   classKey: 'G5W', designation: 'Class Teacher',  dept: 'Upper Primary' },
  { firstName: 'Sarah',  lastName: 'Karimi',   gender: Gender.FEMALE, classKey: 'G6E', designation: 'Senior Teacher', dept: 'Upper Primary' },
  { firstName: 'Samuel', lastName: 'Omondi',   gender: Gender.MALE,   classKey: 'G6W', designation: 'Senior Teacher', dept: 'Upper Primary' },
] as const;

/** 12 classes — Grade 1–6 × East & West */
const CLASS_CONFIGS = [
  { grade: 1, stream: 'East', key: 'G1E' },
  { grade: 1, stream: 'West', key: 'G1W' },
  { grade: 2, stream: 'East', key: 'G2E' },
  { grade: 2, stream: 'West', key: 'G2W' },
  { grade: 3, stream: 'East', key: 'G3E' },
  { grade: 3, stream: 'West', key: 'G3W' },
  { grade: 4, stream: 'East', key: 'G4E' },
  { grade: 4, stream: 'West', key: 'G4W' },
  { grade: 5, stream: 'East', key: 'G5E' },
  { grade: 5, stream: 'West', key: 'G5W' },
  { grade: 6, stream: 'East', key: 'G6E' },
  { grade: 6, stream: 'West', key: 'G6W' },
] as const;

type SubjectDef = {
  name: string;
  code: string;
  category: SubjectCategory;
  isCompulsory: boolean;
  periodsPerWeek: number;
};

/** CBC Lower Primary subjects (Grades 1–3) */
function lpSubjects(grade: number): SubjectDef[] {
  const g = `G${grade}`;
  return [
    { name: 'Literacy Activities',             code: `${g}-LIT`, category: SubjectCategory.LANGUAGE,   isCompulsory: true, periodsPerWeek: 10 },
    { name: 'Kiswahili Language Activities',    code: `${g}-KSW`, category: SubjectCategory.LANGUAGE,   isCompulsory: true, periodsPerWeek: 7  },
    { name: 'Mathematical Activities',          code: `${g}-MAT`, category: SubjectCategory.CORE,       isCompulsory: true, periodsPerWeek: 7  },
    { name: 'Environmental Activities',         code: `${g}-ENV`, category: SubjectCategory.SCIENCE,    isCompulsory: true, periodsPerWeek: 5  },
    { name: 'Creative Arts Activities',         code: `${g}-ART`, category: SubjectCategory.ARTS,       isCompulsory: true, periodsPerWeek: 5  },
    { name: 'Religious Education Activities',   code: `${g}-RE`,  category: SubjectCategory.CORE,       isCompulsory: true, periodsPerWeek: 3  },
    { name: 'Physical & Health Education',      code: `${g}-PHE`, category: SubjectCategory.SPORTS,     isCompulsory: true, periodsPerWeek: 3  },
  ];
}

/** CBC Upper Primary subjects (Grades 4–6) */
function upSubjects(grade: number): SubjectDef[] {
  const g = `G${grade}`;
  const base: SubjectDef[] = [
    { name: 'English Language',        code: `${g}-ENG`,  category: SubjectCategory.LANGUAGE,   isCompulsory: true, periodsPerWeek: 7  },
    { name: 'Kiswahili Language',      code: `${g}-KSW`,  category: SubjectCategory.LANGUAGE,   isCompulsory: true, periodsPerWeek: 5  },
    { name: 'Mathematics',             code: `${g}-MAT`,  category: SubjectCategory.CORE,       isCompulsory: true, periodsPerWeek: 7  },
    { name: 'Integrated Science',      code: `${g}-SCI`,  category: SubjectCategory.SCIENCE,    isCompulsory: true, periodsPerWeek: 5  },
    { name: 'Social Studies',          code: `${g}-SS`,   category: SubjectCategory.CORE,       isCompulsory: true, periodsPerWeek: 4  },
    { name: 'Religious Education',     code: `${g}-RE`,   category: SubjectCategory.CORE,       isCompulsory: true, periodsPerWeek: 3  },
    { name: 'Creative Arts & Sports',  code: `${g}-CAS`,  category: SubjectCategory.ARTS,       isCompulsory: true, periodsPerWeek: 4  },
    { name: 'Agriculture & Nutrition', code: `${g}-AGRI`, category: SubjectCategory.VOCATIONAL, isCompulsory: true, periodsPerWeek: 4  },
    { name: 'Life Skills Education',   code: `${g}-LSE`,  category: SubjectCategory.CORE,       isCompulsory: true, periodsPerWeek: 2  },
  ];
  if (grade >= 5) {
    base.push({ name: 'Pre-Technical Studies', code: `${g}-PTS`, category: SubjectCategory.VOCATIONAL, isCompulsory: true, periodsPerWeek: 4 });
  }
  return base;
}

// ═══════════════════════════════════════════════════════════════════════
// ② HELPERS
// ═══════════════════════════════════════════════════════════════════════

const pad = (n: number, w = 3): string => String(n).padStart(w, '0');

/**
 * Deterministic but varied attendance — ≈90% PRESENT, 5% ABSENT,
 * 3% LATE, 2% EXCUSED — spread naturally across students & days.
 */
function attendanceFor(
  classIdx: number,
  studentIdx: number,
  dayIdx: number,
): AttendanceStatus {
  const r = ((classIdx + 1) * 7 + (studentIdx + 1) * 13 + (dayIdx + 1) * 17) % 100;
  if (r < 90) return AttendanceStatus.PRESENT;
  if (r < 95) return AttendanceStatus.ABSENT;
  if (r < 98) return AttendanceStatus.LATE;
  return AttendanceStatus.EXCUSED;
}

/**
 * Term 1 2026 attendance dates:
 *   Week 1 (Jan 5–9) and Week 2 (Jan 12–16)
 * Jan 5 is a Monday in 2026.
 */
const TERM1_ATTENDANCE_DATES: Date[] = [
  // Week 1 — school opens
  new Date('2026-01-05'), new Date('2026-01-06'), new Date('2026-01-07'),
  new Date('2026-01-08'), new Date('2026-01-09'),
  // Week 2
  new Date('2026-01-12'), new Date('2026-01-13'), new Date('2026-01-14'),
  new Date('2026-01-15'), new Date('2026-01-16'),
];

// ═══════════════════════════════════════════════════════════════════════
// ③ MAIN SEED
// ═══════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('\n🌱  Seeding Greenfield CBC Primary School…\n');

  const hashedPassword = await bcrypt.hash('Admin123!', 12);

  // ─────────────────────────────────────────────────────────────────────
  // A. TENANT
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [1/14] Tenant & settings…');

  const tenant = await prisma.tenant.upsert({
    where: { domain: 'greenfield.acadchestra.com' },
    update: {},
    create: {
      name: 'Greenfield CBC Primary School',
      domain: 'greenfield.acadchestra.com',
      subdomain: 'greenfield',
      email: 'admin@greenfield.acadchestra.com',
      phone: '+254712345678',
      address: 'Greenfield Estate, Nairobi, Kenya',
      planType: 'PROFESSIONAL',
      maxStudents: 500,
      termStructure: 'THREE_TERMS',
      gradeStructure: {
        grades: [1, 2, 3, 4, 5, 6],
        streams: ['East', 'West'],
        type: 'CBC',
      },
    },
  });

  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      currency: 'KES',
      currencySymbol: 'KSh',
      timezone: 'Africa/Nairobi',
      locale: 'en-KE',
      dateFormat: 'DD/MM/YYYY',
      primaryColor: '#16a34a',
      secondaryColor: '#166534',
      brandTagline: 'Nurturing Future Leaders Through CBC',
      defaultGradingScale: 'PERCENTAGE',
      passingGrade: 50,
      attendanceThreshold: 75,
    },
  });

  // ─────────────────────────────────────────────────────────────────────
  // B. ROLES
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [2/14] Roles…');

  const roleMap: Record<string, string> = {};
  for (const name of ['SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student', 'Parent']) {
    const role = await prisma.role.upsert({
      where: { name_tenantId: { name, tenantId: tenant.id } },
      update: {},
      create: { name, tenantId: tenant.id, isSystem: true },
    });
    roleMap[name] = role.id;
  }

  // ─────────────────────────────────────────────────────────────────────
  // C. ADMIN USER
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [3/14] Admin user…');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@greenfield.acadchestra.com' },
    update: {},
    create: {
      email: 'admin@greenfield.acadchestra.com',
      password: hashedPassword,
      firstName: 'School',
      lastName: 'Admin',
      gender: Gender.MALE,
      isEmailVerified: true,
      isActive: true,
      tenantId: tenant.id,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: roleMap['Admin'] } },
    update: {},
    create: { userId: adminUser.id, roleId: roleMap['Admin'] },
  });

  // ─────────────────────────────────────────────────────────────────────
  // D. PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [4/14] Principal…');

  const principalUser = await prisma.user.upsert({
    where: { email: 'principal@greenfield.acadchestra.com' },
    update: {},
    create: {
      email: 'principal@greenfield.acadchestra.com',
      password: hashedPassword,
      firstName: 'Michael',
      lastName: 'Gitau',
      gender: Gender.MALE,
      isEmailVerified: true,
      isActive: true,
      tenantId: tenant.id,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: principalUser.id, roleId: roleMap['Principal'] } },
    update: {},
    create: { userId: principalUser.id, roleId: roleMap['Principal'] },
  });

  // ─────────────────────────────────────────────────────────────────────
  // E. ACADEMIC YEAR 2026
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [5/14] Academic year…');

  const academicYear = await prisma.academicYear.upsert({
    where: { name_tenantId: { name: '2026', tenantId: tenant.id } },
    update: {},
    create: {
      name: '2026',
      startDate: new Date('2026-01-05'),
      endDate: new Date('2026-11-27'),
      isCurrent: true,
      termStructure: 'THREE_TERMS',
      totalTerms: 3,
      status: AcademicYearStatus.ACTIVE,
      streamsByGrade: {
        1: ['East', 'West'],
        2: ['East', 'West'],
        3: ['East', 'West'],
        4: ['East', 'West'],
        5: ['East', 'West'],
        6: ['East', 'West'],
      },
      tenantId: tenant.id,
    },
  });

  // ─────────────────────────────────────────────────────────────────────
  // F. TERMS
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [6/14] Academic terms…');

  const term1 = await prisma.academicTerm.upsert({
    where: { name_academicYearId: { name: 'Term 1', academicYearId: academicYear.id } },
    update: {},
    create: {
      name: 'Term 1',
      shortName: 'T1',
      termNumber: 1,
      startDate: new Date('2026-01-05'),
      endDate: new Date('2026-04-03'),
      isActive: false,
      hasExams: true,
      hasFees: true,
      examWeeks: 2,
      // Term 1 is done — lock it
      isLocked: true,
      lockedAt: new Date('2026-04-07'),
      lockedReason: 'Term 1 completed and records locked',
      billingLocked: true,
      billingGeneratedAt: new Date('2026-01-05'),
      academicYearId: academicYear.id,
      tenantId: tenant.id,
    },
  });

  const term2 = await prisma.academicTerm.upsert({
    where: { name_academicYearId: { name: 'Term 2', academicYearId: academicYear.id } },
    update: {},
    create: {
      name: 'Term 2',
      shortName: 'T2',
      termNumber: 2,
      startDate: new Date('2026-04-27'),
      endDate: new Date('2026-08-07'),
      isActive: true,        // ← currently active
      hasExams: true,
      hasFees: true,
      examWeeks: 2,
      academicYearId: academicYear.id,
      tenantId: tenant.id,
    },
  });

  const term3 = await prisma.academicTerm.upsert({
    where: { name_academicYearId: { name: 'Term 3', academicYearId: academicYear.id } },
    update: {},
    create: {
      name: 'Term 3',
      shortName: 'T3',
      termNumber: 3,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-11-27'),
      isActive: false,
      hasExams: true,
      hasFees: true,
      examWeeks: 2,
      academicYearId: academicYear.id,
      tenantId: tenant.id,
    },
  });

  // ─────────────────────────────────────────────────────────────────────
  // G. ACADEMIC PERIODS
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [7/14] Academic periods…');

  const periodDefs: Array<{
    name: string;
    type: AcademicPeriodType;
    start: string;
    end: string;
    termId: string | null;
  }> = [
    // Teaching periods
    { name: 'Term 1',           type: AcademicPeriodType.TERM,           start: '2026-01-05', end: '2026-04-03', termId: term1.id  },
    { name: 'Term 2',           type: AcademicPeriodType.TERM,           start: '2026-04-27', end: '2026-08-07', termId: term2.id  },
    { name: 'Term 3',           type: AcademicPeriodType.TERM,           start: '2026-09-01', end: '2026-11-27', termId: term3.id  },
    // Long holidays
    { name: 'April Holiday',    type: AcademicPeriodType.HOLIDAY,        start: '2026-04-04', end: '2026-04-26', termId: null      },
    { name: 'August Holiday',   type: AcademicPeriodType.HOLIDAY,        start: '2026-08-08', end: '2026-08-31', termId: null      },
    { name: 'December Holiday', type: AcademicPeriodType.HOLIDAY,        start: '2026-11-28', end: '2026-12-31', termId: null      },
    // Mid-term breaks
    { name: 'T1 Mid-Break',     type: AcademicPeriodType.MID_TERM_BREAK, start: '2026-02-13', end: '2026-02-22', termId: term1.id  },
    { name: 'T2 Mid-Break',     type: AcademicPeriodType.MID_TERM_BREAK, start: '2026-06-05', end: '2026-06-14', termId: term2.id  },
    { name: 'T3 Mid-Break',     type: AcademicPeriodType.MID_TERM_BREAK, start: '2026-10-02', end: '2026-10-11', termId: term3.id  },
    // Exam weeks
    { name: 'T1 Exams',         type: AcademicPeriodType.EXAM_WEEK,      start: '2026-03-23', end: '2026-04-03', termId: term1.id  },
    { name: 'T2 Exams',         type: AcademicPeriodType.EXAM_WEEK,      start: '2026-07-27', end: '2026-08-07', termId: term2.id  },
    { name: 'T3 Exams',         type: AcademicPeriodType.EXAM_WEEK,      start: '2026-11-16', end: '2026-11-27', termId: term3.id  },
  ];

  for (const p of periodDefs) {
    try {
      await prisma.academicPeriod.create({
        data: {
          name: p.name,
          type: p.type,
          startDate: new Date(p.start),
          endDate: new Date(p.end),
          academicYearId: academicYear.id,
          ...(p.termId ? { academicTermId: p.termId } : {}),
          tenantId: tenant.id,
        },
      });
    } catch {
      // Already seeded — skip
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // H. SUBJECTS  (CBC curriculum, grade-specific codes)
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [8/14] CBC subjects…');

  /** subjectIdsByGrade[grade] = array of Subject IDs */
  const subjectIdsByGrade: Record<number, string[]> = {};

  for (let grade = 1; grade <= 6; grade++) {
    const defs = grade <= 3 ? lpSubjects(grade) : upSubjects(grade);
    const ids: string[] = [];

    for (const def of defs) {
      const subject = await prisma.subject.upsert({
        where: { code_tenantId: { code: def.code, tenantId: tenant.id } },
        update: {},
        create: {
          name: def.name,
          code: def.code,
          gradeLevel: grade,
          category: def.category,
          isCompulsory: def.isCompulsory,
          credits: 1,
          department: grade <= 3 ? 'Lower Primary' : 'Upper Primary',
          tenantId: tenant.id,
        },
      });
      ids.push(subject.id);
    }

    subjectIdsByGrade[grade] = ids;
  }

  // ─────────────────────────────────────────────────────────────────────
  // I. TEACHERS  (12 class teachers)
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [9/14] Class teachers…');

  /** teacherMap[classKey] = { userId, teacherId } */
  const teacherMap: Record<string, { userId: string; teacherId: string }> = {};

  for (let i = 0; i < TEACHER_PROFILES.length; i++) {
    const tp = TEACHER_PROFILES[i];
    const slug = `${tp.firstName.toLowerCase()}.${tp.lastName.toLowerCase()}`;
    const email = `teacher.${slug}@greenfield.acadchestra.com`;
    const empId = `GF-TCH-${pad(i + 1)}`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: hashedPassword,
        firstName: tp.firstName,
        lastName: tp.lastName,
        gender: tp.gender,
        isEmailVerified: true,
        isActive: true,
        tenantId: tenant.id,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleMap['Teacher'] } },
      update: {},
      create: { userId: user.id, roleId: roleMap['Teacher'] },
    });

    const teacher = await prisma.teacher.upsert({
      where: { employeeId_tenantId: { employeeId: empId, tenantId: tenant.id } },
      update: {},
      create: {
        employeeId: empId,
        joiningDate: new Date('2024-01-08'),
        designation: tp.designation,
        department: tp.dept,
        qualification: 'Bachelor of Education (B.Ed)',
        experience: 3 + (i % 9),
        salary: 45000 + i * 2000,
        employmentStatus: EmploymentStatus.ACTIVE,
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    teacherMap[tp.classKey] = { userId: user.id, teacherId: teacher.id };
  }

  // ─────────────────────────────────────────────────────────────────────
  // J. CLASSES
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [10/14] Classes (Grade 1–6, East & West)…');

  /** classMap[classKey] = classId */
  const classMap: Record<string, string> = {};

  for (const cfg of CLASS_CONFIGS) {
    const { teacherId } = teacherMap[cfg.key];
    const className = `Grade ${cfg.grade} ${cfg.stream}`;

    const cls = await prisma.class.upsert({
      where: {
        name_academicYearId_tenantId: {
          name: className,
          academicYearId: academicYear.id,
          tenantId: tenant.id,
        },
      },
      update: {},
      create: {
        name: className,
        displayName: `Gr.${cfg.grade} ${cfg.stream[0]}`,
        gradeLevel: cfg.grade,
        stream: cfg.stream,
        section: cfg.stream === 'East' ? 'A' : 'B',
        capacity: 20,
        classType: ClassType.REGULAR,
        classTeacherId: teacherId,
        academicYearId: academicYear.id,
        tenantId: tenant.id,
      },
    });

    classMap[cfg.key] = cls.id;
  }

  // ─────────────────────────────────────────────────────────────────────
  // K. CLASS SUBJECTS
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [11/14] Class–subject links…');

  for (const cfg of CLASS_CONFIGS) {
    const classId = classMap[cfg.key];
    const { teacherId } = teacherMap[cfg.key];
    const subjectIds = subjectIdsByGrade[cfg.grade] ?? [];
    const subjectDefs = cfg.grade <= 3 ? lpSubjects(cfg.grade) : upSubjects(cfg.grade);

    for (let si = 0; si < subjectIds.length; si++) {
      try {
        await prisma.classSubject.create({
          data: {
            classId,
            subjectId: subjectIds[si],
            teacherId,
            periodsPerWeek: subjectDefs[si]?.periodsPerWeek ?? 5,
          },
        });
      } catch {
        // Already exists — skip
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // L. STUDENTS  (20 per class = 240 total)
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [12/14] Students (240 total)…');

  /** studentsByClass[classKey] = array of { userId, studentId } */
  const studentsByClass: Record<string, Array<{ userId: string; studentId: string }>> = {};
  let admissionCounter = 1;

  for (let ci = 0; ci < CLASS_CONFIGS.length; ci++) {
    const cfg = CLASS_CONFIGS[ci];
    const classId = classMap[cfg.key];
    const classStudents: Array<{ userId: string; studentId: string }> = [];

    for (let si = 0; si < 20; si++) {
      const isMale = si < 10;
      const firstName = isMale ? MALE_FIRST[si] : FEMALE_FIRST[si - 10];

      // Rotate last names so different classes get different surnames
      const lastName = LAST_NAMES[(ci * 20 + si) % LAST_NAMES.length];
      const gender = isMale ? Gender.MALE : Gender.FEMALE;

      // Email includes class key to guarantee global uniqueness
      const emailSlug = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${cfg.key.toLowerCase()}`;
      const email = `${emailSlug}@greenfield.acadchestra.com`;

      const admissionNumber = `GF-2026-${pad(admissionCounter++)}`;
      const rollNumber = `${cfg.key}-${pad(si + 1, 2)}`;

      // Age-appropriate DOB — Grade 1 ≈ 6 yrs old, Grade 6 ≈ 11 yrs old
      const birthYear = 2026 - 5 - cfg.grade;
      const birthMonth = pad((si % 12) + 1, 2);
      const birthDay = pad((si % 28) + 1, 2);
      const dob = new Date(`${birthYear}-${birthMonth}-${birthDay}`);

      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          gender,
          dateOfBirth: dob,
          isEmailVerified: true,
          isActive: true,
          tenantId: tenant.id,
        },
      });

      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: roleMap['Student'] } },
        update: {},
        create: { userId: user.id, roleId: roleMap['Student'] },
      });

      const student = await prisma.student.upsert({
        where: { admissionNumber_tenantId: { admissionNumber, tenantId: tenant.id } },
        update: {},
        create: {
          admissionNumber,
          rollNumber,
          admissionDate: new Date('2026-01-05'),
          academicStatus: StudentStatus.ACTIVE,
          userId: user.id,
          classId,
          tenantId: tenant.id,
        },
      });

      // StudentClassHistory — check before inserting to stay idempotent
      const existingHistory = await prisma.studentClassHistory.findFirst({
        where: {
          studentId: student.id,
          academicYearId: academicYear.id,
          classId,
        },
      });
      if (!existingHistory) {
        await prisma.studentClassHistory.create({
          data: {
            studentId: student.id,
            classId,
            academicYearId: academicYear.id,
            stream: cfg.stream,
            startDate: new Date('2026-01-05'),
            isCurrent: true,
            reason: 'Initial enrolment for Academic Year 2026',
            tenantId: tenant.id,
          },
        });
      }

      classStudents.push({ userId: user.id, studentId: student.id });
    }

    studentsByClass[cfg.key] = classStudents;
    process.stdout.write(`    ${cfg.key}: ${classStudents.length} students ✓\n`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // M. ATTENDANCE SESSIONS & RECORDS  (Term 1 — weeks 1 & 2)
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [13/14] Term 1 attendance sessions & records…');

  for (let ci = 0; ci < CLASS_CONFIGS.length; ci++) {
    const cfg = CLASS_CONFIGS[ci];
    const classId = classMap[cfg.key];
    const { userId: teacherUserId } = teacherMap[cfg.key];
    const students = studentsByClass[cfg.key];

    for (let di = 0; di < TERM1_ATTENDANCE_DATES.length; di++) {
      const sessionDate = TERM1_ATTENDANCE_DATES[di];
      const dateStr = sessionDate.toISOString().slice(0, 10);

      // Create session
      let session: { id: string };
      try {
        session = await prisma.attendanceSession.create({
          data: {
            sessionDate,
            type: AttendanceSessionType.DAILY,
            status: AttendanceSessionStatus.FINALIZED,
            totalStudents: 20,
            presentCount: 0, // updated after records
            absentCount: 0,
            lateCount: 0,
            excusedCount: 0,
            classId,
            academicYearId: academicYear.id,
            academicTermId: term1.id,
            takenById: teacherUserId,
            takenAt: new Date(`${dateStr}T06:00:00.000Z`),
            finalizedById: teacherUserId,
            finalizedAt: new Date(`${dateStr}T07:00:00.000Z`),
            tenantId: tenant.id,
          },
        });
      } catch {
        // Session already exists — find it
        session = await prisma.attendanceSession.findFirstOrThrow({
          where: {
            classId,
            sessionDate,
            type: AttendanceSessionType.DAILY,
            subjectId: null,
          },
        });
      }

      // Create records & tally aggregates
      let present = 0, absent = 0, late = 0, excused = 0;

      for (let si = 0; si < students.length; si++) {
        const status = attendanceFor(ci, si, di);
        if (status === AttendanceStatus.PRESENT)      present++;
        else if (status === AttendanceStatus.ABSENT)  absent++;
        else if (status === AttendanceStatus.LATE)    late++;
        else                                          excused++;

        await prisma.attendanceRecord.upsert({
          where: {
            sessionId_studentId: {
              sessionId: session.id,
              studentId: students[si].studentId,
            },
          },
          update: { status },
          create: {
            status,
            sessionId: session.id,
            studentId: students[si].studentId,
            markedById: teacherUserId,
            markedAt: new Date(`${dateStr}T06:30:00.000Z`),
            tenantId: tenant.id,
          },
        });
      }

      // Update aggregate counts on the session
      await prisma.attendanceSession.update({
        where: { id: session.id },
        data: { presentCount: present, absentCount: absent, lateCount: late, excusedCount: excused },
      });
    }

    process.stdout.write(`    ${cfg.key}: ${TERM1_ATTENDANCE_DATES.length} sessions ✓\n`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // N. EXAMINATIONS  (End-of-Term 1, one per grade)
  // ─────────────────────────────────────────────────────────────────────
  console.log('  [14/14] Term 1 examinations…');

  for (let grade = 1; grade <= 6; grade++) {
    try {
      await prisma.examination.create({
        data: {
          name: `Grade ${grade} End of Term 1 Examination`,
          type: ExamType.TERM_EXAM,
          startDate: new Date('2026-03-23'),
          endDate: new Date('2026-04-03'),
          duration: grade <= 3 ? 90 : 120,
          maxMarks: 100,
          passingMarks: 50,
          academicTermId: term1.id,
          tenantId: tenant.id,
        },
      });
    } catch {
      // Already exists — skip
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────
  const sessionCount = TERM1_ATTENDANCE_DATES.length * CLASS_CONFIGS.length;
  const recordCount  = sessionCount * 20;

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║          ✅  Greenfield CBC Primary School — Seed Done           ║
╠══════════════════════════════════════════════════════════════════╣
║  Tenant   : Greenfield CBC Primary School                        ║
║  Domain   : greenfield.acadchestra.com                           ║
╠══════════════════════════════════════════════════════════════════╣
║  ACCOUNTS  (password: Admin123!)                                 ║
║  Admin     : admin@greenfield.acadchestra.com                    ║
║  Principal : principal@greenfield.acadchestra.com                ║
║  Teachers  : teacher.jane.wanjiku@greenfield.acadchestra.com     ║
║              teacher.david.kamau@greenfield.acadchestra.com      ║
║              teacher.mary.otieno@greenfield.acadchestra.com      ║
║              … (12 class teachers total, T1 = TCH-001…012)      ║
║  Students  : firstname.lastname.g1e@greenfield.acadchestra.com   ║
║              (240 students, 20 per class, GF-2026-001…240)       ║
╠══════════════════════════════════════════════════════════════════╣
║  Academic Year 2026                                              ║
║  Term 1  : Jan 5  – Apr 3  2026  ← LOCKED (completed)           ║
║  Term 2  : Apr 27 – Aug 7  2026  ← ACTIVE  (current term)       ║
║  Term 3  : Sep 1  – Nov 27 2026  ← upcoming                     ║
╠══════════════════════════════════════════════════════════════════╣
║  Classes     : 12  (Grade 1–6 × East & West)                    ║
║  Students    : 240 (20 per class)                                ║
║  Subjects    : CBC-aligned per grade (7 LP · 9–10 UP)            ║
║  Attendance  : ${String(sessionCount).padEnd(3)} sessions  ·  ${String(recordCount).padEnd(5)} records  (Term 1, Wks 1–2)  ║
║  Examinations: 6   (End-of-Term 1, one per grade)                ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

// ─────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────
main()
  .catch((e) => {
    console.error('\n❌  Seeding failed:\n', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });