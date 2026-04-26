/**
 * @description Idempotent seed that ensures a "Finance" role exists for
 *   every active tenant. Run once after deploying the fee module:
 *     npx ts-node prisma/seed-finance-role.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ where: { isActive: true } });
  let created = 0;
  for (const t of tenants) {
    const existing = await prisma.role.findFirst({
      where: { name: 'Finance', tenantId: t.id },
    });
    if (!existing) {
      await prisma.role.create({
        data: {
          name: 'Finance',
          description: 'Financial operator — full fee management access',
          isSystem: true,
          tenantId: t.id,
        },
      });
      created++;
      console.log(`✓ Finance role created for ${t.name}`);
    }
  }
  console.log(`\nDone. ${created} role(s) created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());