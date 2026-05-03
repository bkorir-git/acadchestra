/**
 * @file prisma/seeds/demo-school-population.seed.ts
 *
 * Populates Demo School with a full CBC school cohort:
 *
 *   Curriculum  : Demo School CBC  (PP1, PP2, Grade 1–9)
 *   Classes     : 1 per grade  (11 total) in AY 2024-2025
 *   Streams     : Red & Blue per class  (22 streams)
 *   Students    : 10 per stream → 20 per grade → 220 total
 *   Teachers    : 11 class teachers (one per grade) + 3 subject teachers
 *
 * ✘ No fee structures, invoices, or financial data.
 * ✔ Idempotent — safe to re-run; uses upsert throughout.
 *
 * Default teacher login password: Teacher123!
 */

import { PrismaClient, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_DOMAIN         = 'demo.acadchestra.com';
const ACADEMIC_YEAR_NAME  = '2026';
const STUDENTS_PER_STREAM = 10;

const STREAMS = [
  { name: 'Red',  color: '#ef4444' },
  { name: 'Blue', color: '#3b82f6' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CBC GRADE DEFINITIONS  (PP1 → Grade 9)
// ─────────────────────────────────────────────────────────────────────────────

const GRADE_DEFS = [
  { name: 'PP1',     displayName: 'Pre-Primary 1',  levelOrder: 1,  birthYear: 2020 },
  { name: 'PP2',     displayName: 'Pre-Primary 2',  levelOrder: 2,  birthYear: 2019 },
  { name: 'Grade 1', displayName: 'Grade One',       levelOrder: 3,  birthYear: 2018 },
  { name: 'Grade 2', displayName: 'Grade Two',       levelOrder: 4,  birthYear: 2017 },
  { name: 'Grade 3', displayName: 'Grade Three',     levelOrder: 5,  birthYear: 2016 },
  { name: 'Grade 4', displayName: 'Grade Four',      levelOrder: 6,  birthYear: 2015 },
  { name: 'Grade 5', displayName: 'Grade Five',      levelOrder: 7,  birthYear: 2014 },
  { name: 'Grade 6', displayName: 'Grade Six',       levelOrder: 8,  birthYear: 2013 },
  { name: 'Grade 7', displayName: 'Grade Seven',     levelOrder: 9,  birthYear: 2012 },
  { name: 'Grade 8', displayName: 'Grade Eight',     levelOrder: 10, birthYear: 2011 },
  { name: 'Grade 9', displayName: 'Grade Nine',      levelOrder: 11, birthYear: 2010 },
] as const;

type GradeName = (typeof GRADE_DEFS)[number]['name'];

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER DEFINITIONS
//   TCH001–TCH011 : class teachers (one per grade, assigned as classTeacher)
//   TCH012–TCH014 : subject / support teachers
// ─────────────────────────────────────────────────────────────────────────────

const TEACHER_DEFS: Array<{
  empId:       string;
  firstName:   string;
  lastName:    string;
  email:       string;
  designation: string;
  department:  string;
  gradeName:   GradeName | null;
}> = [
  {
    empId: 'TCH001', firstName: 'James',     lastName: 'Mwangi',
    email: 'james.mwangi@demo.acadchestra.com',
    designation: 'Class Teacher',        department: 'Early Years',      gradeName: 'PP1',
  },
  {
    empId: 'TCH002', firstName: 'Grace',     lastName: 'Wanjiku',
    email: 'grace.wanjiku@demo.acadchestra.com',
    designation: 'Class Teacher',        department: 'Early Years',      gradeName: 'PP2',
  },
  {
    empId: 'TCH003', firstName: 'Peter',     lastName: 'Ochieng',
    email: 'peter.ochieng@demo.acadchestra.com',
    designation: 'Class Teacher',        department: 'Lower Primary',    gradeName: 'Grade 1',
  },
  {
    empId: 'TCH004', firstName: 'Mary',      lastName: 'Akinyi',
    email: 'mary.akinyi@demo.acadchestra.com',
    designation: 'Class Teacher',        department: 'Lower Primary',    gradeName: 'Grade 2',
  },
  {
    empId: 'TCH005', firstName: 'John',      lastName: 'Kamau',
    email: 'john.kamau@demo.acadchestra.com',
    designation: 'Class Teacher',        department: 'Lower Primary',    gradeName: 'Grade 3',
  },
  {
    empId: 'TCH006', firstName: 'Sarah',     lastName: 'Njeri',
    email: 'sarah.njeri@demo.acadchestra.com',
    designation: 'Class Teacher',        department: 'Upper Primary',    gradeName: 'Grade 4',
  },
  {
    empId: 'TCH007', firstName: 'David',     lastName: 'Otieno',
    email: 'david.otieno@demo.acadchestra.com',
    designation: 'Class Teacher',        department: 'Upper Primary',    gradeName: 'Grade 5',
  },
  {
    empId: 'TCH008', firstName: 'Elizabeth', lastName: 'Wambui',
    email: 'elizabeth.wambui@demo.acadchestra.com',
    designation: 'Class Teacher',        department: 'Upper Primary',    gradeName: 'Grade 6',
  },
  {
    empId: 'TCH009', firstName: 'Michael',   lastName: 'Kipchoge',
    email: 'michael.kipchoge@demo.acadchestra.com',
    designation: 'Senior Class Teacher', department: 'Junior Secondary', gradeName: 'Grade 7',
  },
  {
    empId: 'TCH010', firstName: 'Catherine', lastName: 'Muthoni',
    email: 'catherine.muthoni@demo.acadchestra.com',
    designation: 'Senior Class Teacher', department: 'Junior Secondary', gradeName: 'Grade 8',
  },
  {
    empId: 'TCH011', firstName: 'Robert',    lastName: 'Omondi',
    email: 'robert.omondi@demo.acadchestra.com',
    designation: 'Senior Class Teacher', department: 'Junior Secondary', gradeName: 'Grade 9',
  },
  // ── Subject / support teachers ─────────────────────────────────────────────
  {
    empId: 'TCH012', firstName: 'Agnes',     lastName: 'Chebet',
    email: 'agnes.chebet@demo.acadchestra.com',
    designation: 'Science Teacher',      department: 'Sciences',         gradeName: null,
  },
  {
    empId: 'TCH013', firstName: 'Francis',   lastName: 'Kariuki',
    email: 'francis.kariuki@demo.acadchestra.com',
    designation: 'Mathematics Teacher',  department: 'Mathematics',      gradeName: null,
  },
  {
    empId: 'TCH014', firstName: 'Beatrice',  lastName: 'Adhiambo',
    email: 'beatrice.adhiambo@demo.acadchestra.com',
    designation: 'English Teacher',      department: 'Languages',        gradeName: null,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT NAME POOLS  (authentic Kenyan names)
// ─────────────────────────────────────────────────────────────────────────────

const MALE_FIRST = [
  'James',   'John',    'David',   'Michael', 'Brian',   'Kevin',
  'Samuel',  'Daniel',  'Joseph',  'Alex',    'Paul',    'Mark',
  'Nathan',  'Felix',   'Adrian',  'Patrick', 'Timothy', 'Kenneth',
  'Dennis',  'George',  'Edwin',   'Victor',
];

const FEMALE_FIRST = [
  'Mary',    'Grace',   'Sarah',   'Elizabeth', 'Catherine', 'Agnes',
  'Beatrice','Esther',  'Joyce',   'Mercy',     'Faith',     'Hope',
  'Lydia',   'Ruth',    'Naomi',   'Stella',    'Monica',    'Diana',
  'Susan',   'Vivian',  'Sharon',  'Caroline',
];

const LAST_NAMES = [
  'Mwangi',   'Kamau',    'Ochieng',  'Otieno',   'Kipchoge', 'Mutua',
  'Maina',    'Karanja',  'Njoroge',  'Akinyi',   'Adhiambo', 'Chebet',
  'Wambui',   'Muthoni',  'Kariuki',  'Gitau',    'Kimani',   'Omondi',
  'Owino',    'Simiyu',   'Barasa',   'Musyoka',  'Mutuku',   'Ndungu',
  'Ngugi',    'Wekesa',   'Makokha',  'Gacheru',  'Wangari',  'Naliaka',
  'Jepkemoi', 'Atieno',   'Njoroge',  'Wafula',   'Nekesa',   'Nanjala',
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Zero-pad a number to `len` digits */
function pad(n: number, len = 4): string {
  return String(n).padStart(len, '0');
}

/**
 * Deterministic name for a global student index.
 * Even index → male, odd → female.
 * Uses prime-ish multipliers so names spread across the pools without obvious
 * repetition within the same class.
 */
function resolveStudentName(idx: number): {
  firstName: string;
  lastName:  string;
  gender:    Gender;
} {
  if (idx % 2 === 0) {
    return {
      firstName: MALE_FIRST[idx % MALE_FIRST.length],
      lastName:  LAST_NAMES[(idx * 7) % LAST_NAMES.length],
      gender:    'MALE',
    };
  }
  return {
    firstName: FEMALE_FIRST[idx % FEMALE_FIRST.length],
    lastName:  LAST_NAMES[(idx * 7 + 11) % LAST_NAMES.length],
    gender:    'FEMALE',
  };
}

/** Spread birthdays across the year to avoid unrealistic Jan-01 walls */
function birthDate(year: number, seed: number): Date {
  const month = (seed % 12) + 1;
  const day   = (seed % 28) + 1;
  return new Date(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDemoSchoolPopulation(prisma: PrismaClient): Promise<void> {
  console.log('\n  👥  Seeding Demo School population…');

  // ── 1. Tenant ──────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { domain: DEMO_DOMAIN },
  });

  // ── 2. CBC Curriculum ─────────────────────────────────────────────────────
  // Link to the system CBC template when it exists (seeded by seedCurriculumTemplates)
  const cbcTemplate = await prisma.curriculumTemplate.findFirst({
    where: { code: 'cbc' },
  });

  const curriculum = await prisma.curriculum.upsert({
    where:  { tenantId_name: { tenantId: tenant.id, name: 'Demo School CBC' } },
    update: {},
    create: {
      name:        'Demo School CBC',
      code:        'cbc',
      description: 'Competency Based Curriculum – Demo School',
      isActive:    true,
      isDefault:   true,
      templateId:  cbcTemplate?.id ?? null,
      tenantId:    tenant.id,
    },
  });

  // ── 3. Grades (PP1 … Grade 9) ─────────────────────────────────────────────
  const gradeIdByName: Record<string, string> = {};

  for (const gd of GRADE_DEFS) {
    const grade = await prisma.grade.upsert({
      where: {
        tenantId_curriculumId_levelOrder: {
          tenantId:     tenant.id,
          curriculumId: curriculum.id,
          levelOrder:   gd.levelOrder,
        },
      },
      update: { displayName: gd.displayName },
      create: {
        name:         gd.name,
        displayName:  gd.displayName,
        levelOrder:   gd.levelOrder,
        curriculumId: curriculum.id,
        tenantId:     tenant.id,
      },
    });
    gradeIdByName[gd.name] = grade.id;
  }
  console.log(`  ✓ ${GRADE_DEFS.length} grades  (PP1 → Grade 9)`);

  // ── 4. Academic Year ──────────────────────────────────────────────────────
  const ay = await prisma.academicYear.findUniqueOrThrow({
    where: { name_tenantId: { name: ACADEMIC_YEAR_NAME, tenantId: tenant.id } },
  });

  // ── 5. Teachers ───────────────────────────────────────────────────────────
  const teacherPassword = await bcrypt.hash('Teacher123!', 12);

  const teacherRole = await prisma.role.findFirst({
    where: { name: 'Teacher', tenantId: tenant.id },
  });

  /** empId → teacher.id */
  const teacherIdByEmpId: Record<string, string> = {};

  for (const td of TEACHER_DEFS) {
    // User account
    const user = await prisma.user.upsert({
      where:  { email: td.email },
      update: {},
      create: {
        email:           td.email,
        password:        teacherPassword,
        firstName:       td.firstName,
        lastName:        td.lastName,
        isEmailVerified: true,
        tenantId:        tenant.id,
      },
    });

    // Teacher profile
    const teacher = await prisma.teacher.upsert({
      where:  { employeeId_tenantId: { employeeId: td.empId, tenantId: tenant.id } },
      update: {},
      create: {
        employeeId:  td.empId,
        designation: td.designation,
        department:  td.department,
        joiningDate: new Date('2023-01-10'),
        userId:      user.id,
        tenantId:    tenant.id,
      },
    });
    teacherIdByEmpId[td.empId] = teacher.id;

    // Role assignment
    if (teacherRole) {
      await prisma.userRole.upsert({
        where:  { userId_roleId: { userId: user.id, roleId: teacherRole.id } },
        update: {},
        create: { userId: user.id, roleId: teacherRole.id },
      });
    }
  }
  console.log(`  ✓ ${TEACHER_DEFS.length} teachers  (${TEACHER_DEFS.length - 3} class teachers + 3 subject teachers)`);

  // Map: gradeName → teacher.id (class teachers only)
  const classTeacherByGrade: Record<string, string> = {};
  for (const td of TEACHER_DEFS) {
    if (td.gradeName) {
      classTeacherByGrade[td.gradeName] = teacherIdByEmpId[td.empId];
    }
  }

  // ── 6. Classes → Streams → Students ──────────────────────────────────────
  let admissionSeq   = 0;   // drives admission number
  let studentGlobIdx = 0;   // drives name + birthday selection
  let totalStudents  = 0;

  for (const gd of GRADE_DEFS) {
    const gradeId        = gradeIdByName[gd.name];
    const classTeacherId = classTeacherByGrade[gd.name] ?? null;

    // ── Class (one per grade) ───────────────────────────────────────────────
    const cls = await prisma.class.upsert({
      where: {
        name_academicYearId_tenantId: {
          name:           gd.name,
          academicYearId: ay.id,
          tenantId:       tenant.id,
        },
      },
      update: {},
      create: {
        name:           gd.name,
        displayName:    gd.displayName,
        capacity:       STUDENTS_PER_STREAM * STREAMS.length,
        gradeId,
        academicYearId: ay.id,
        ...(classTeacherId ? { classTeacherId } : {}),
        tenantId:       tenant.id,
      },
    });

    // ── Two streams ────────────────────────────────────────────────────────
    for (const sd of STREAMS) {
      const stream = await prisma.stream.upsert({
        where:  { classId_name: { classId: cls.id, name: sd.name } },
        update: {},
        create: {
          name:     sd.name,
          color:    sd.color,
          capacity: STUDENTS_PER_STREAM,
          classId:  cls.id,
          tenantId: tenant.id,
        },
      });

      // ── 10 students per stream ───────────────────────────────────────────
      for (let i = 0; i < STUDENTS_PER_STREAM; i++) {
        admissionSeq++;
        const admissionNumber = pad(admissionSeq);
        const { firstName, lastName, gender } = resolveStudentName(studentGlobIdx);
        const dateOfBirth = birthDate(gd.birthYear, studentGlobIdx);
        studentGlobIdx++;

        const student = await prisma.student.upsert({
          where:  {
            admissionNumber_tenantId: {
              admissionNumber,
              tenantId: tenant.id,
            },
          },
          update: {},
          create: {
            admissionNumber,
            firstName,
            lastName,
            dateOfBirth,
            gender,
            academicStatus: 'ACTIVE',
            classId:        cls.id,
            streamId:       stream.id,
            tenantId:       tenant.id,
          },
        });

        // StudentClassHistory — one current record per student per year
        const existingHistory = await prisma.studentClassHistory.findFirst({
          where: { studentId: student.id, academicYearId: ay.id, isCurrent: true },
        });
        if (!existingHistory) {
          await prisma.studentClassHistory.create({
            data: {
              studentId:      student.id,
              classId:        cls.id,
              academicYearId: ay.id,
              streamId:       stream.id,
              isCurrent:      true,
              tenantId:       tenant.id,
            },
          });
        }

        totalStudents++;
      }
    }
  }

  console.log(
    `  ✓ ${totalStudents} students` +
    `  (${GRADE_DEFS.length} grades × ${STREAMS.length} streams × ${STUDENTS_PER_STREAM} each)`,
  );

  // ── 7. Admission Counter ──────────────────────────────────────────────────
  await prisma.admissionCounter.upsert({
    where:  { tenantId: tenant.id },
    update: { currentSequence: admissionSeq, lastIssuedAt: new Date() },
    create: {
      tenantId:        tenant.id,
      currentSequence: admissionSeq,
      paddingLength:   4,
      strategy:        'SEQUENTIAL',
      lastIssuedAt:    new Date(),
    },
  });
  console.log(`  ✓ AdmissionCounter set to ${pad(admissionSeq)}`);
  console.log('  🎓  Demo school population complete!\n');
}