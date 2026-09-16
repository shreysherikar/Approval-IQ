import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

interface ApiResult {
  status: number;
  json: Record<string, unknown>;
}

async function call(
  address: string,
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${address}${path}`, init);
  const text = await res.text();
  return {
    status: res.status,
    json: text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

async function register(address: string, email: string, role = 'applicant'): Promise<string> {
  const res = await call(address, 'POST', '/auth/register', undefined, {
    email,
    password: 'Password123!',
    role,
  });
  assert(res.status === 201, `Register failed for ${email}: ${res.status}`);
  return res.json['accessToken'] as string;
}

async function main(): Promise<void> {
  console.log('--- Starting Grievances & Statutory Escalation Integration Suite ---');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0);
  const server = app.getHttpServer() as { address: () => { port: number } };
  const port = server.address().port;
  const address = `http://localhost:${port}`;
  const prisma = app.get(PrismaService);

  try {
    const nonce = randomUUID().slice(0, 8);
    const applicantToken = await register(address, `app-${nonce}@example.com`, 'applicant');
    const officerToken = await register(address, `officer-${nonce}@example.com`, 'officer');
    const outsiderToken = await register(address, `outsider-${nonce}@example.com`, 'applicant');

    // Create project
    const projRes = await call(address, 'POST', '/projects', applicantToken, {
      name: `Grievance Test ${nonce}`,
      industry: 'brewery',
      businessId: `biz-${nonce}`,
    });
    assert(projRes.status === 201, 'Failed to create test project');
    const projectId = (projRes.json as { id: string }).id;

    // 1. Assert non-member receives 403 on project grievance inbox
    const outsiderList = await call(address, 'GET', `/projects/${projectId}/grievances`, outsiderToken);
    assert(outsiderList.status === 403, 'Non-member was not rejected with 403 on project grievances');

    // 2. Applicant files a statutory RTS grievance
    const createRes = await call(address, 'POST', `/projects/${projectId}/grievances`, applicantToken, {
      type: 'sla_breach_delay',
      subject: 'Undue delay in issuing Trade Licence beyond RTS statutory limit',
      description: 'The application has been pending with no inspection conducted and SLA breached by 12 days.',
      statutorySlaDays: 15,
    });
    assert(createRes.status === 201, 'Failed to lodge statutory grievance');
    const grievance = createRes.json as {
      id: string;
      grievanceNumber: string;
      tier: string;
      status: string;
    };
    assert(grievance.tier === 'tier_1_nodal_officer', 'New grievance did not start at Tier 1 Nodal Officer');
    assert(grievance.status === 'submitted', 'New grievance status was not submitted');
    assert(grievance.grievanceNumber.startsWith('GRV-'), 'Grievance tracking number format invalid');

    // 3. Applicant escalates grievance to Tier 2 Appellate Authority
    const escalateRes = await call(
      address,
      'POST',
      `/projects/${projectId}/grievances/${grievance.id}/escalate`,
      applicantToken,
      {
        remarks: 'First authority failed to take cognizance of SLA breach. Escalating to First Appellate Authority.',
        targetTier: 'tier_2_appellate_authority',
      },
    );
    assert(escalateRes.status === 200, 'Escalate to Tier 2 failed');
    const escalated = escalateRes.json as { tier: string; status: string };
    assert(escalated.tier === 'tier_2_appellate_authority', 'Grievance tier not updated to Tier 2');
    assert(escalated.status === 'escalated', 'Grievance status not marked as escalated');

    // 4. Officer reviews queue and takes up grievance for investigation
    const officerListRes = await call(address, 'GET', '/officer/grievances', officerToken);
    assert(officerListRes.status === 200, 'Officer queue fetch failed');

    const investigateRes = await call(
      address,
      'POST',
      `/officer/grievances/${grievance.id}/investigate`,
      officerToken,
      {
        remarks: 'Notice issued to desk officer; hearing scheduled before Appellate Authority.',
        hearingScheduledAt: new Date(Date.now() + 86400000).toISOString(),
        assignedInvestigator: 'District Industry Officer',
      },
    );
    assert(investigateRes.status === 200, 'Officer investigation initiation failed');
    const investigated = investigateRes.json as { status: string };
    assert(investigated.status === 'under_investigation', 'Status not transitioned to under_investigation');

    // 5. Appellate Authority formally resolves with rectification directive
    const resolveRes = await call(
      address,
      'POST',
      `/officer/grievances/${grievance.id}/resolve`,
      officerToken,
      {
        outcome: 'redressed',
        resolutionSummary: 'Grievance upheld. Undue delay confirmed without lawful cause.',
        rectificationAction: 'Subordinate authority directed to issue deemed NOC within 48 hours.',
        orderNumber: `RTS-ORDER-${nonce}`,
      },
    );
    assert(resolveRes.status === 200, 'Grievance resolution failed');
    const resolved = resolveRes.json as {
      status: string;
      resolutionSummary: string;
      rectificationAction: string;
    };
    assert(resolved.status === 'redressed', 'Grievance was not marked as redressed');
    assert(resolved.rectificationAction.includes('48 hours'), 'Rectification directive missing');

    console.log('✅ ALL GRIEVANCE INTEGRATION ASSERTIONS PASSED (End-to-End Loop Verified)');
  } finally {
    await prisma.$disconnect();
    await app.close();
  }
}

void main();
