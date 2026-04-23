import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * CBC School Seed File - Greenfield Academy
 * Kenya Competency Based Curriculum (CBC)
 * Grades: PP1, PP2, Grade 1–6
 * Structure: Each grade has 2 streams (A & B), 20 students per stream = 40 per grade
 * Run: ts-node prisma/seeds/seed-cbc-school.ts
 */

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomDOB(minAge: number, maxAge: number): Date {
  const now = new Date();
  const year =
    now.getFullYear() -
    Math.floor(Math.random() * (maxAge - minAge + 1) + minAge);
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(year, month, day);
}

function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}

// Real Kenyan names pool
const MALE_FIRST = [
  'Amani', 'Brian', 'Calvin', 'Daniel', 'Edwin', 'Felix', 'George', 'Hassan',
  'Ian', 'James', 'Kevin', 'Levi', 'Martin', 'Nathan', 'Oliver', 'Patrick',
  'Quincy', 'Robert', 'Samuel', 'Timothy', 'Umar', 'Victor', 'Walter',
  'Xavier', 'Yusuf', 'Zawadi', 'Alex', 'Benson', 'Collins', 'Dennis',
];
const FEMALE_FIRST = [
  'Aisha', 'Beatrice', 'Caroline', 'Diana', 'Esther', 'Faith', 'Grace',
  'Hannah', 'Irene', 'Joy', 'Karen', 'Lydia', 'Mary', 'Naomi', 'Olivia',
  'Priscilla', 'Queen', 'Ruth', 'Sharon', 'Tabitha', 'Umi', 'Violet',
  'Wendy', 'Xenia', 'Yasmin', 'Zipporah', 'Agnes', 'Betty', 'Cynthia', 'Doris',
];
const LAST_NAMES = [
  'Kamau', 'Omondi', 'Wanjiru', 'Kipchoge', 'Mwangi', 'Otieno', 'Njoroge',
  'Mutua', 'Achieng', 'Kariuki', 'Njenga', 'Owino', 'Kimani', 'Auma',
  'Gitau', 'Onyango', 'Waweru', 'Adhiambo', 'Kenyatta', 'Odinga', 'Mureithi',
  'Simiyu', 'Wekesa', 'Chebet', 'Ruto', 'Korir', 'Langat', 'Bett', 'Sang', 'Too',
];

let maleIdx = 0;
let femaleIdx = 0;
let lastIdx = 0;

function nextName(gender: 'MALE' | 'FEMALE'): { first: string; last: string } {
  const first =
    gender === 'MALE'
      ? MALE_FIRST[maleIdx++ % MALE_FIRST.length]
      : FEMALE_FIRST[femaleIdx++ % FEMALE_FIRST.length];
  const last = LAST_NAMES[lastIdx++ % LAST_NAMES.length];
  return { first, last };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Greenfield Academy (CBC)...\n');

  const hashedPassword = await bcrypt.hash('Admin123!', 12);

  // ── 1. Tenant ────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { domain: 'greenfield.acadchestra.com' },
    update: {},
    create: {
      name: 'Greenfield Academy',
      domain: 'greenfield.acadchestra.com',
      subdomain: 'greenfield',
      email: 'info@greenfieldacademy.ac.ke',
      phone: '+254712345678',
      address: 'Westlands, Nairobi, Kenya',
      planType: 'PROFESSIONAL',
      maxStudents: 500,
      termStructure: 'THREE_TERMS',
    },
  });
  console.log('✅ Tenant:', tenant.name);

  // ── 2. Academic Year ─────────────────────────────────────────────────────
  const academicYear = await prisma.academicYear.upsert({
    where: { name_tenantId: { name: '2024-2025', tenantId: tenant.id } },
    update: {},
    create: {
      name: '2024-2025',
      startDate: new Date('2025-01-06'),
      endDate: new Date('2025-11-28'),
      isCurrent: true,
      termStructure: 'THREE_TERMS',
      totalTerms: 3,
      status: 'ACTIVE',
      tenantId: tenant.id,
    },
  });
  console.log('✅ Academic Year:', academicYear.name);

  // ── 3. Academic Terms ────────────────────────────────────────────────────
  const termsData = [
    { name: 'Term 1 2025', shortName: 'T1', termNumber: 1, startDate: new Date('2025-01-06'), endDate: new Date('2025-04-04'), isActive: false },
    { name: 'Term 2 2025', shortName: 'T2', termNumber: 2, startDate: new Date('2025-04-29'), endDate: new Date('2025-08-01'), isActive: true },
    { name: 'Term 3 2025', shortName: 'T3', termNumber: 3, startDate: new Date('2025-09-01'), endDate: new Date('2025-11-28'), isActive: false },
  ];

  const terms: any[] = [];
  for (const t of termsData) {
    const term = await prisma.academicTerm.upsert({
      where: { name_academicYearId: { name: t.name, academicYearId: academicYear.id } },
      update: {},
      create: { ...t, academicYearId: academicYear.id, tenantId: tenant.id, hasExams: true, hasFees: true, examWeeks: 2 },
    });
    terms.push(term);
  }
  console.log('✅ Academic Terms: Term 1, Term 2, Term 3');

  // ── 4. Permissions ───────────────────────────────────────────────────────
  const permissionDefs = [
    'users', 'students', 'teachers', 'classes', 'subjects',
    'fees', 'payments', 'examinations', 'reports',
  ].flatMap((r) =>
    ['create', 'read', 'update', 'delete'].map((a) => ({ resource: r, action: a, description: `${a} ${r}` })),
  );

  for (const p of permissionDefs) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: {},
      create: p,
    });
  }
  console.log('✅ Permissions created');

  // ── 5. Roles ─────────────────────────────────────────────────────────────
  const roleDefs = [
    { name: 'SuperAdmin', description: 'Full system access', isSystem: true },
    { name: 'Admin', description: 'School administrative access', isSystem: true },
    { name: 'Principal', description: 'Principal / Head teacher access', isSystem: true },
    { name: 'Teacher', description: 'Class teacher access', isSystem: true },
    { name: 'Student', description: 'Student access', isSystem: true },
    { name: 'Parent', description: 'Parent / Guardian access', isSystem: true },
  ];

  const rolesMap: Record<string, any> = {};
  for (const r of roleDefs) {
    const role = await prisma.role.upsert({
      where: { name_tenantId: { name: r.name, tenantId: tenant.id } },
      update: {},
      create: { ...r, tenantId: tenant.id },
    });
    rolesMap[r.name] = role;
  }
  console.log('✅ Roles created');

  // ── 6. Admin Staff ───────────────────────────────────────────────────────
  const staffAccounts = [
    {
      email: 'principal@greenfieldacademy.ac.ke',
      firstName: 'Margaret', lastName: 'Wanjiru',
      role: 'Principal', employeeId: 'EMP001', designation: 'Principal',
      department: 'Administration',
    },
    {
      email: 'admin@greenfieldacademy.ac.ke',
      firstName: 'Peter', lastName: 'Otieno',
      role: 'Admin', employeeId: 'EMP002', designation: 'School Administrator',
      department: 'Administration',
    },
    {
      email: 'deputy@greenfieldacademy.ac.ke',
      firstName: 'Susan', lastName: 'Kamau',
      role: 'Admin', employeeId: 'EMP003', designation: 'Deputy Principal',
      department: 'Administration',
    },
  ];

  const adminUsers: Record<string, any> = {};
  for (const s of staffAccounts) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        password: hashedPassword,
        firstName: s.firstName,
        lastName: s.lastName,
        isEmailVerified: true,
        tenantId: tenant.id,
        gender: s.firstName === 'Peter' ? 'MALE' : 'FEMALE',
        dateOfBirth: randomDOB(35, 55),
        phone: `+2547${Math.floor(10000000 + Math.random() * 89999999)}`,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: rolesMap[s.role].id } },
      update: {},
      create: { userId: user.id, roleId: rolesMap[s.role].id },
    });
    await prisma.teacher.upsert({
      where: { employeeId_tenantId: { employeeId: s.employeeId, tenantId: tenant.id } },
      update: {},
      create: {
        employeeId: s.employeeId,
        joiningDate: new Date('2020-01-06'),
        designation: s.designation,
        department: s.department,
        qualification: 'B.Ed (Primary Education), Kenyatta University',
        experience: 10,
        salary: 120000,
        userId: user.id,
        tenantId: tenant.id,
        employmentStatus: 'ACTIVE',
      },
    });
    adminUsers[s.employeeId] = user;
  }
  console.log('✅ Admin/Principal staff created');

  // ── 7. CBC Subjects per grade band ──────────────────────────────────────
  // PP1–PP2 (grade 0–1), Grade 1–3, Grade 4–6 have slightly different subjects
  type SubjectDef = { name: string; code: string; gradeLevel: number; category: string; isCompulsory: boolean };
  const subjectDefs: SubjectDef[] = [];

  // PP1 (grade 0) & PP2 (grade 1)
  const ppSubjects = [
    { name: 'Language Activities', code: 'LA', category: 'LANGUAGE' },
    { name: 'Mathematical Activities', code: 'MA', category: 'CORE' },
    { name: 'Environmental Activities', code: 'EA', category: 'CORE' },
    { name: 'Psychomotor & Creative Activities', code: 'PCA', category: 'ARTS' },
    { name: 'Religious Education Activities', code: 'REA', category: 'CORE' },
  ];
  for (const g of [0, 1]) {
    for (const s of ppSubjects) {
      subjectDefs.push({ name: s.name, code: `${s.code}${g}`, gradeLevel: g, category: s.category, isCompulsory: true });
    }
  }

  // Grade 1–3
  const lowerPrimarySubjects = [
    { name: 'Literacy Activities', code: 'LIT', category: 'LANGUAGE' },
    { name: 'Kiswahili Language Activities', code: 'KIS', category: 'LANGUAGE' },
    { name: 'Mathematical Activities', code: 'MTH', category: 'CORE' },
    { name: 'Environmental Activities', code: 'ENV', category: 'SCIENCE' },
    { name: 'Creative Arts', code: 'CRA', category: 'ARTS' },
    { name: 'Physical & Health Education', code: 'PHE', category: 'SPORTS' },
    { name: 'Christian Religious Education', code: 'CRE', category: 'CORE' },
  ];
  for (const g of [2, 3, 4]) {
    for (const s of lowerPrimarySubjects) {
      subjectDefs.push({ name: s.name, code: `${s.code}G${g}`, gradeLevel: g, category: s.category, isCompulsory: true });
    }
  }

  // Grade 4–6
  const upperPrimarySubjects = [
    { name: 'English Language', code: 'ENG', category: 'LANGUAGE' },
    { name: 'Kiswahili', code: 'KSW', category: 'LANGUAGE' },
    { name: 'Mathematics', code: 'MAT', category: 'CORE' },
    { name: 'Integrated Science', code: 'SCI', category: 'SCIENCE' },
    { name: 'Social Studies', code: 'SST', category: 'CORE' },
    { name: 'Creative Arts & Sports', code: 'CAS', category: 'ARTS' },
    { name: 'Christian Religious Education', code: 'CRE', category: 'CORE' },
    { name: 'Life Skills Education', code: 'LSE', category: 'CORE' },
  ];
  for (const g of [5, 6, 7]) {
    for (const s of upperPrimarySubjects) {
      subjectDefs.push({ name: s.name, code: `${s.code}G${g}`, gradeLevel: g, category: s.category, isCompulsory: true });
    }
  }

  const subjectsMap: Record<string, any> = {};
  for (const s of subjectDefs) {
    const subject = await prisma.subject.upsert({
      where: { code_tenantId: { code: s.code, tenantId: tenant.id } },
      update: {},
      create: {
        name: s.name,
        code: s.code,
        gradeLevel: s.gradeLevel,
        category: s.category as any,
        isCompulsory: s.isCompulsory,
        credits: 1,
        tenantId: tenant.id,
      },
    });
    subjectsMap[s.code] = subject;
  }
  console.log('✅ CBC Subjects created');

  // ── 8. Grade config ──────────────────────────────────────────────────────
  // PP1=0, PP2=1, Gr1=2, Gr2=3, Gr3=4, Gr4=5, Gr5=6, Gr6=7
  const grades = [
    { label: 'PP1',     gradeLevel: 0, ageMin: 4,  ageMax: 5,  subjectCodePrefix: ppSubjects.map(s=>`${s.code}0`) },
    { label: 'PP2',     gradeLevel: 1, ageMin: 5,  ageMax: 6,  subjectCodePrefix: ppSubjects.map(s=>`${s.code}1`) },
    { label: 'Grade 1', gradeLevel: 2, ageMin: 6,  ageMax: 7,  subjectCodePrefix: lowerPrimarySubjects.map(s=>`${s.code}G2`) },
    { label: 'Grade 2', gradeLevel: 3, ageMin: 7,  ageMax: 8,  subjectCodePrefix: lowerPrimarySubjects.map(s=>`${s.code}G3`) },
    { label: 'Grade 3', gradeLevel: 4, ageMin: 8,  ageMax: 9,  subjectCodePrefix: lowerPrimarySubjects.map(s=>`${s.code}G4`) },
    { label: 'Grade 4', gradeLevel: 5, ageMin: 9,  ageMax: 10, subjectCodePrefix: upperPrimarySubjects.map(s=>`${s.code}G5`) },
    { label: 'Grade 5', gradeLevel: 6, ageMin: 10, ageMax: 11, subjectCodePrefix: upperPrimarySubjects.map(s=>`${s.code}G6`) },
    { label: 'Grade 6', gradeLevel: 7, ageMin: 11, ageMax: 12, subjectCodePrefix: upperPrimarySubjects.map(s=>`${s.code}G7`) },
  ];

  const streams = ['A', 'B'];

  // ── 9. Class Teachers (one per stream per grade = 16 teachers) ──────────
  // Teacher pool - real Kenyan names
  const teacherPool = [
    { firstName: 'Alice',    lastName: 'Mwangi',   gender: 'FEMALE', qual: 'B.Ed (Early Childhood)', emp: 'EMP010' },
    { firstName: 'John',     lastName: 'Kariuki',   gender: 'MALE',   qual: 'Dip. Education (KTTC)',  emp: 'EMP011' },
    { firstName: 'Eunice',   lastName: 'Achieng',   gender: 'FEMALE', qual: 'B.Ed (Primary)',          emp: 'EMP012' },
    { firstName: 'Michael',  lastName: 'Onyango',   gender: 'MALE',   qual: 'B.Ed (Primary)',          emp: 'EMP013' },
    { firstName: 'Dorothy',  lastName: 'Njoroge',   gender: 'FEMALE', qual: 'B.Ed (Primary)',          emp: 'EMP014' },
    { firstName: 'George',   lastName: 'Mutua',     gender: 'MALE',   qual: 'B.Ed (Science & Math)',   emp: 'EMP015' },
    { firstName: 'Florence', lastName: 'Owino',     gender: 'FEMALE', qual: 'B.Ed (Primary)',          emp: 'EMP016' },
    { firstName: 'David',    lastName: 'Gitau',     gender: 'MALE',   qual: 'B.Ed (Languages)',        emp: 'EMP017' },
    { firstName: 'Mercy',    lastName: 'Otieno',    gender: 'FEMALE', qual: 'B.Ed (Primary)',          emp: 'EMP018' },
    { firstName: 'Patrick',  lastName: 'Waweru',    gender: 'MALE',   qual: 'Dip. Education (KTTC)',  emp: 'EMP019' },
    { firstName: 'Esther',   lastName: 'Omondi',    gender: 'FEMALE', qual: 'B.Ed (Primary)',          emp: 'EMP020' },
    { firstName: 'Charles',  lastName: 'Kimani',    gender: 'MALE',   qual: 'B.Ed (Science)',          emp: 'EMP021' },
    { firstName: 'Lydia',    lastName: 'Adhiambo',  gender: 'FEMALE', qual: 'B.Ed (Primary)',          emp: 'EMP022' },
    { firstName: 'Joseph',   lastName: 'Njenga',    gender: 'MALE',   qual: 'B.Ed (Math)',             emp: 'EMP023' },
    { firstName: 'Monica',   lastName: 'Chebet',    gender: 'FEMALE', qual: 'B.Ed (Primary)',          emp: 'EMP024' },
    { firstName: 'Samuel',   lastName: 'Simiyu',    gender: 'MALE',   qual: 'B.Ed (Primary)',          emp: 'EMP025' },
  ];

  const classTeachers: any[] = [];
  for (let i = 0; i < teacherPool.length; i++) {
    const tp = teacherPool[i];
    const email = `${tp.firstName.toLowerCase()}.${tp.lastName.toLowerCase()}@greenfieldacademy.ac.ke`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: hashedPassword,
        firstName: tp.firstName,
        lastName: tp.lastName,
        isEmailVerified: true,
        tenantId: tenant.id,
        gender: tp.gender as any,
        dateOfBirth: randomDOB(25, 45),
        phone: `+2547${Math.floor(10000000 + Math.random() * 89999999)}`,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: rolesMap['Teacher'].id } },
      update: {},
      create: { userId: user.id, roleId: rolesMap['Teacher'].id },
    });
    const teacher = await prisma.teacher.upsert({
      where: { employeeId_tenantId: { employeeId: tp.emp, tenantId: tenant.id } },
      update: {},
      create: {
        employeeId: tp.emp,
        joiningDate: new Date('2022-01-10'),
        designation: 'Class Teacher',
        department: 'Primary',
        qualification: tp.qual,
        experience: Math.floor(Math.random() * 8) + 2,
        salary: Math.floor(Math.random() * 30000) + 60000,
        userId: user.id,
        tenantId: tenant.id,
        employmentStatus: 'ACTIVE',
      },
    });
    classTeachers.push(teacher);
  }
  console.log('✅ Class teachers created (16)');

  // ── 10. Classes, ClassSubjects, Students ─────────────────────────────────
  let teacherAssignIdx = 0;
  let studentCounter = 1;
  let admissionCounter = 1;
  let rollCounter: Record<string, number> = {};

  for (const grade of grades) {
    for (const stream of streams) {
      const className = `${grade.label} ${stream}`;
      const classTeacher = classTeachers[teacherAssignIdx++];

      // Create class
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
          displayName: className,
          gradeLevel: grade.gradeLevel,
          section: stream,
          capacity: 20,
          classType: 'REGULAR',
          stream,
          curriculum: 'CBC',
          language: 'English',
          academicYearId: academicYear.id,
          classTeacherId: classTeacher.id,
          tenantId: tenant.id,
        },
      });

      // Assign subjects to class
      for (const subjectCode of grade.subjectCodePrefix) {
        const subject = subjectsMap[subjectCode];
        if (!subject) continue;
        await prisma.classSubject.upsert({
          where: { classId_subjectId: { classId: cls.id, subjectId: subject.id } },
          update: {},
          create: {
            classId: cls.id,
            subjectId: subject.id,
            teacherId: classTeacher.id,
            periodsPerWeek: 5,
          },
        });
      }

      // Create 20 students per stream
      if (!rollCounter[grade.label]) rollCounter[grade.label] = 1;

      for (let s = 0; s < 20; s++) {
        const gender: 'MALE' | 'FEMALE' = s % 2 === 0 ? 'MALE' : 'FEMALE';
        const { first, last } = nextName(gender);
        const email = `student${pad(studentCounter, 4)}@greenfieldacademy.ac.ke`;
        const admNo = `GFA/${academicYear.name.split('-')[0]}/${pad(admissionCounter, 4)}`;
        const rollNo = `${grade.label.replace(/\s+/g, '').toUpperCase()}${stream}/${pad(rollCounter[grade.label], 3)}`;

        let user: any;
        const existingUser = await prisma.user.findFirst({ where: { email } });
        if (existingUser) {
          user = existingUser;
        } else {
          user = await prisma.user.create({
            data: {
              email,
              password: hashedPassword,
              firstName: first,
              lastName: last,
              isEmailVerified: true,
              tenantId: tenant.id,
              gender,
              dateOfBirth: randomDOB(grade.ageMin, grade.ageMax),
              phone: null,
            },
          });
        }

        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: rolesMap['Student'].id } },
          update: {},
          create: { userId: user.id, roleId: rolesMap['Student'].id },
        });

        const existingStudent = await prisma.student.findFirst({
          where: { userId: user.id },
        });

        if (!existingStudent) {
          await prisma.student.create({
            data: {
              rollNumber: rollNo,
              admissionNumber: admNo,
              admissionDate: new Date('2025-01-06'),
              userId: user.id,
              classId: cls.id,
              tenantId: tenant.id,
              academicStatus: 'ACTIVE',
              emergencyContact: `${last} Parent`,
              emergencyPhone: `+2547${Math.floor(10000000 + Math.random() * 89999999)}`,
            },
          });
        }

        studentCounter++;
        admissionCounter++;
        rollCounter[grade.label]++;
      }

      console.log(`  ✅ ${className}: 20 students, teacher: ${classTeacher.id}`);
    }
  }

  // ── 11. Fee Structures (CBC Term-wise) ───────────────────────────────────
  const feeStructuresByGrade = [
    { gradeLevels: [0, 1], name: 'PP1 & PP2 Term Fee', tuition: 15000, activity: 2000, lunch: 3000 },
    { gradeLevels: [2, 3, 4], name: 'Lower Primary Term Fee', tuition: 18000, activity: 2500, lunch: 3000 },
    { gradeLevels: [5, 6, 7], name: 'Upper Primary Term Fee', tuition: 22000, activity: 3000, lunch: 3000 },
  ];

  for (const term of terms) {
    for (const fsd of feeStructuresByGrade) {
      const fs = await prisma.feeStructure.create({
        data: {
          name: `${fsd.name} - ${term.shortName}`,
          description: `CBC ${fsd.name} for ${term.name}`,
          feeType: 'TERM_WISE',
          isRecurring: true,
          isOptional: false,
          academicYearId: academicYear.id,
          academicTermId: term.id,
          tenantId: tenant.id,
        },
      });

      await prisma.feeComponent.create({
        data: {
          name: 'Tuition Fee',
          description: 'Tuition and instruction costs',
          amount: fsd.tuition,
          currency: 'KES',
          isCompulsory: true,
          category: 'ACADEMIC',
          dueDate: term.startDate,
          lateFee: 500,
          feeStructureId: fs.id,
        },
      });
      await prisma.feeComponent.create({
        data: {
          name: 'Activity Fee',
          description: 'CBC activities, sports and arts',
          amount: fsd.activity,
          currency: 'KES',
          isCompulsory: true,
          category: 'ACTIVITIES',
          dueDate: term.startDate,
          lateFee: 0,
          feeStructureId: fs.id,
        },
      });
      await prisma.feeComponent.create({
        data: {
          name: 'Lunch Program',
          description: 'School lunch program',
          amount: fsd.lunch,
          currency: 'KES',
          isCompulsory: false,
          category: 'MEALS',
          dueDate: term.startDate,
          lateFee: 0,
          feeStructureId: fs.id,
        },
      });
    }
  }
  console.log('✅ Fee structures and components created');

  // ── 12. Examinations ─────────────────────────────────────────────────────
  const examDefs = [
    { name: 'Term 1 End-of-Term Exam', type: 'TERM_EXAM', termIdx: 0, start: new Date('2025-03-24'), end: new Date('2025-04-03') },
    { name: 'Term 2 Mid-Term Assessment', type: 'MID_TERM', termIdx: 1, start: new Date('2025-06-09'), end: new Date('2025-06-13') },
    { name: 'Term 2 End-of-Term Exam', type: 'TERM_EXAM', termIdx: 1, start: new Date('2025-07-21'), end: new Date('2025-08-01') },
    { name: 'Term 3 End-of-Term Exam', type: 'TERM_EXAM', termIdx: 2, start: new Date('2025-11-17'), end: new Date('2025-11-28') },
  ];

  for (const e of examDefs) {
    await prisma.examination.create({
      data: {
        name: e.name,
        type: e.type as any,
        startDate: e.start,
        endDate: e.end,
        duration: 120,
        maxMarks: 100,
        passingMarks: 40,
        academicTermId: terms[e.termIdx].id,
        tenantId: tenant.id,
      },
    });
  }
  console.log('✅ Examinations created');

  // ── Summary ──────────────────────────────────────────────────────────────
  const totalStudents = await prisma.student.count({ where: { tenantId: tenant.id } });
  const totalTeachers = await prisma.teacher.count({ where: { tenantId: tenant.id } });
  const totalClasses = await prisma.class.count({ where: { tenantId: tenant.id } });

  console.log('\n🎉 Greenfield Academy seeding complete!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('  School   : Greenfield Academy');
  console.log('  Domain   : greenfield.acadchestra.com');
  console.log('  Curriculum: CBC (Kenya)');
  console.log('  Grades   : PP1, PP2, Grade 1–6');
  console.log('  Streams  : 2 per grade (A & B), 20 students each');
  console.log(`  Students : ${totalStudents}`);
  console.log(`  Teachers : ${totalTeachers} (incl. admin staff)`);
  console.log(`  Classes  : ${totalClasses}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('\n📋 Login Credentials (all use password: School123!)');
  console.log('  Principal : principal@greenfieldacademy.ac.ke');
  console.log('  Admin     : admin@greenfieldacademy.ac.ke');
  console.log('  Deputy    : deputy@greenfieldacademy.ac.ke');
  console.log('  Teachers  : firstname.lastname@greenfieldacademy.ac.ke');
  console.log('  Students  : student0001@greenfieldacademy.ac.ke ... student0160@greenfieldacademy.ac.ke');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });