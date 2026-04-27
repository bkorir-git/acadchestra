/**
 * @file curriculum-templates.seed.ts
 * @module prisma/seeds
 * @description Seeds the canonical CurriculumTemplate + GradeTemplate rows.
 *   Run once at deploy time. Idempotent — uses `upsert` on unique codes.
 *
 *   Templates seeded:
 *     1. CBC (Kenya)              — PP1, PP2, Grade 1–9
 *     2. K-8-4-4 (Legacy Kenya)   — Std 1–8, Form 1–4
 *     3. British                  — Year 1–13
 *     4. IGCSE                    — Y7–Y11
 *     5. University Semester      — Sem 1–8
 */

import { PrismaClient, TermStructure } from '@prisma/client';

interface TemplateSeed {
  code: string;
  name: string;
  country?: string;
  description: string;
  defaultTermStructure: TermStructure;
  grades: { name: string; displayName?: string; levelOrder: number }[];
}

const TEMPLATES: TemplateSeed[] = [
  {
    code: 'cbc',
    name: 'CBC',
    country: 'KE',
    description:
      'Competency-Based Curriculum (Kenya). Pre-Primary through Junior Secondary.',
    defaultTermStructure: TermStructure.THREE_TERMS,
    grades: [
      { name: 'PP1', displayName: 'Pre-Primary 1', levelOrder: 1 },
      { name: 'PP2', displayName: 'Pre-Primary 2', levelOrder: 2 },
      { name: 'Grade 1', levelOrder: 3 },
      { name: 'Grade 2', levelOrder: 4 },
      { name: 'Grade 3', levelOrder: 5 },
      { name: 'Grade 4', levelOrder: 6 },
      { name: 'Grade 5', levelOrder: 7 },
      { name: 'Grade 6', levelOrder: 8 },
      { name: 'Grade 7', levelOrder: 9 },
      { name: 'Grade 8', levelOrder: 10 },
      { name: 'Grade 9', levelOrder: 11 },
    ],
  },
  {
    code: 'k844',
    name: 'K-8-4-4',
    country: 'KE',
    description: 'Legacy Kenyan 8-4-4 system.',
    defaultTermStructure: TermStructure.THREE_TERMS,
    grades: [
      { name: 'Std 1', displayName: 'Standard 1', levelOrder: 1 },
      { name: 'Std 2', displayName: 'Standard 2', levelOrder: 2 },
      { name: 'Std 3', displayName: 'Standard 3', levelOrder: 3 },
      { name: 'Std 4', displayName: 'Standard 4', levelOrder: 4 },
      { name: 'Std 5', displayName: 'Standard 5', levelOrder: 5 },
      { name: 'Std 6', displayName: 'Standard 6', levelOrder: 6 },
      { name: 'Std 7', displayName: 'Standard 7', levelOrder: 7 },
      { name: 'Std 8', displayName: 'Standard 8', levelOrder: 8 },
      { name: 'Form 1', levelOrder: 9 },
      { name: 'Form 2', levelOrder: 10 },
      { name: 'Form 3', levelOrder: 11 },
      { name: 'Form 4', levelOrder: 12 },
    ],
  },
  {
    code: 'british',
    name: 'British',
    country: 'GB',
    description: 'UK National Curriculum — Reception through Year 13.',
    defaultTermStructure: TermStructure.THREE_TERMS,
    grades: [
      { name: 'Reception', levelOrder: 1 },
      ...Array.from({ length: 13 }, (_, i) => ({
        name: `Year ${i + 1}`,
        levelOrder: i + 2,
      })),
    ],
  },
  {
    code: 'igcse',
    name: 'IGCSE',
    country: 'GB',
    description: 'Cambridge IGCSE — Years 7 through 11.',
    defaultTermStructure: TermStructure.THREE_TERMS,
    grades: [
      { name: 'Y7', displayName: 'Year 7', levelOrder: 1 },
      { name: 'Y8', displayName: 'Year 8', levelOrder: 2 },
      { name: 'Y9', displayName: 'Year 9', levelOrder: 3 },
      { name: 'Y10', displayName: 'Year 10', levelOrder: 4 },
      { name: 'Y11', displayName: 'Year 11', levelOrder: 5 },
    ],
  },
  {
    code: 'uni-semester',
    name: 'University Semester',
    description: '4-year undergraduate program with two semesters per year.',
    defaultTermStructure: TermStructure.TWO_SEMESTERS,
    grades: Array.from({ length: 8 }, (_, i) => ({
      name: `Sem ${i + 1}`,
      displayName: `Semester ${i + 1}`,
      levelOrder: i + 1,
    })),
  },
];

export async function seedCurriculumTemplates(prisma: PrismaClient) {
  let templates = 0;
  let grades = 0;
  for (const tpl of TEMPLATES) {
    const template = await prisma.curriculumTemplate.upsert({
      where: { code: tpl.code },
      create: {
        code: tpl.code,
        name: tpl.name,
        country: tpl.country,
        description: tpl.description,
        defaultTermStructure: tpl.defaultTermStructure,
        isPublished: true,
      },
      update: {
        name: tpl.name,
        country: tpl.country,
        description: tpl.description,
        defaultTermStructure: tpl.defaultTermStructure,
      },
    });
    templates++;
    for (const g of tpl.grades) {
      await prisma.gradeTemplate.upsert({
        where: {
          curriculumTemplateId_levelOrder: {
            curriculumTemplateId: template.id,
            levelOrder: g.levelOrder,
          },
        },
        create: {
          curriculumTemplateId: template.id,
          name: g.name,
          displayName: g.displayName,
          levelOrder: g.levelOrder,
        },
        update: { name: g.name, displayName: g.displayName },
      });
      grades++;
    }
  }
  return { templates, grades };
}
