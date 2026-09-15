import { PrismaClient } from '@prisma/client';

/**
 * Development/demo helper: assign an officer user to an authority.
 *
 * Phase 9 officer routes are authority-scoped: an officer only sees and acts on
 * applications whose approval belongs to an ASSIGNED authority. This script
 * creates that link (idempotently) without building an admin UI.
 *
 * Usage (from services/api, Postgres running, migrations applied):
 *   pnpm run officer:assign -- --email officer@example.com --authority DISH
 *
 * Flags:
 *   --email <user email>        (required) must already exist with role=officer|admin
 *   --authority <code-or-id>    (required) Authority.code (e.g. DISH) or uuid
 *   --remove                    remove the assignment instead of creating it
 *   --list                      list all officer assignments and exit
 */

import { PrismaClient } from '@prisma/client';

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) return undefined;
  return args[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const prisma = new PrismaClient();

  try {
    if (args.includes('--list')) {
      const rows = await prisma.officerAuthorityAssignment.findMany({
        include: {
          officer: { select: { email: true, role: true } },
          authority: { select: { code: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (rows.length === 0) {
        console.log('No officer assignments.');
      } else {
        for (const r of rows) {
          console.log(`${r.officer.email} (${r.officer.role}) -> ${r.authority.code} (${r.authority.name})`);
        }
      }
      return;
    }

    const email = flagValue(args, '--email');
    const authorityRef = flagValue(args, '--authority');
    if (!email || !authorityRef) {
      throw new Error('Usage: pnpm run officer:assign -- --email <email> --authority <code-or-id> [--remove]');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`User '${email}' not found — register them first.`);
    if (user.role !== 'officer' && user.role !== 'admin') {
      throw new Error(`User '${email}' has role '${user.role}' — only officers/admins can be assigned.`);
    }

    const authority =
      (await prisma.authority.findUnique({ where: { id: authorityRef } })) ??
      (await prisma.authority.findUnique({ where: { code: authorityRef } }));
    if (!authority) throw new Error(`Authority '${authorityRef}' not found (tried id, then code).`);

    if (args.includes('--remove')) {
      await prisma.officerAuthorityAssignment.deleteMany({
        where: { officerId: user.id, authorityId: authority.id },
      });
      console.log(`Removed assignment: ${email} -/-> ${authority.code}`);
      return;
    }

    const existing = await prisma.officerAuthorityAssignment.findUnique({
      where: { officerId_authorityId: { officerId: user.id, authorityId: authority.id } },
    });
    if (existing) {
      console.log(`Already assigned: ${email} -> ${authority.code} (${authority.name})`);
      return;
    }
    await prisma.officerAuthorityAssignment.create({
      data: { officerId: user.id, authorityId: authority.id },
    });
    console.log(`Assigned: ${email} -> ${authority.code} (${authority.name})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('officer:assign failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});