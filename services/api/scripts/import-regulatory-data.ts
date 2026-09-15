import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
type CsvRow = Record<string, string>;
function parseArgs(a: string[]): { industry: string; dataDir: string; release: string; validateOnly: boolean } {
  const o = { industry: 'all', dataDir: resolve(process.cwd(), '..', '..', 'data'), release: '2026.09.11-regulatory-v1', validateOnly: false };
  for (const r of a) {
    const s = r.replace(/^--/, '');
    const e = s.indexOf('=');
    const k = e < 0 ? s : s.slice(0, e);
    const v = e < 0 ? '' : s.slice(e + 1);
    if (k === 'industry' && v) o.industry = v;
    else if (k === 'data-dir' && v) o.dataDir = resolve(v);
    else if (k === 'release' && v) o.release = v;
    else if (k === 'validate-only') o.validateOnly = true;
  }
  return o;
}
function parseCsv(c: string): { headers: string[]; rows: CsvRow[] } {
  const g: string[][] = [];
  let f = '';
  let rec: string[] = [];
  let q = false;
  const t = c.replace(/^\uFEFF/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i] as string;
    if (q) {
      if (ch === '"') {
        if (t[i + 1] === '"') { f += '"'; i++; } else { q = false; }
      } else { f += ch; }
    } else if (ch === '"') q = true;
    else if (ch === ',') { rec.push(f); f = ''; }
    else if (ch === '\r') { /* skip */ }
    else if (ch === '\n') {
      rec.push(f); f = '';
      if (rec.length > 1 || (rec[0] as string).trim() !== '') g.push(rec);
      rec = [];
    } else f += ch;
  }
  if (f !== '' || rec.length > 0) {
    rec.push(f);
    if (rec.length > 1 || (rec[0] as string).trim() !== '') g.push(rec);
  }
  if (g.length === 0) return { headers: [], rows: [] };
  const h = (g[0] as string[]).map((x) => x.trim());
  return {
    headers: h,
    rows: (g.slice(1) as string[][]).map((cells) => {
      const r: CsvRow = {};
      h.forEach((k, j) => { r[k] = (cells[j] ?? '').trim(); });
      return r;
    }),
  };
}
function loadCsv(d: string, f: string): { headers: string[]; rows: CsvRow[] } {
  try {
    return parseCsv(readFileSync(join(d, f), 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { headers: [], rows: [] };
    throw e;
  }
}
function cell(r: CsvRow, ...ns: string[]): string {
  for (const n of ns) {
    const v = r[n];
    if (v !== undefined) return v;
  }
  return '';
}
function toBool(raw: string, fb: boolean): boolean {
  const v = raw.trim().toLowerCase();
  // Handle annotated values like "yes — FSSAI licences are renewed..." and
  // "no — sequential after MPCB-CTE-001" by matching the leading word.
  if (v === '') return fb;
  if (/^(yes|true|y|1)\b/.test(v)) return true;
  if (/^(no|false|n|0)\b/.test(v)) return false;
  return fb;
}
function splitCodes(raw: string): string[] {
  return raw.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
}
function toDateOrNull(raw: string): Date | null {
  const v = raw.trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
// applicability_conditions may be either structured JSON (parsed to an object)
// or free-text prose (stored verbatim as a JSON string). Probe for JSON only
// when the trimmed value actually looks like JSON, so prose is never warped.
function toConditionJson(raw: string | null): Prisma.InputJsonValue | undefined {
  if (raw === null) return undefined;
  const t = raw.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return JSON.parse(t) as Prisma.InputJsonValue;
    } catch {
      /* not JSON — fall through and store the raw text as a JSON string */
    }
  }
  return raw;
}

type Rel = 'depends_on' | 'informational' | 'parallel_with' | 'unknown';
const RELS: string[] = ['depends_on', 'informational', 'parallel_with', 'unknown'];
type Reuse = 'reusable' | 'conditional' | 'fresh_required' | 'unknown';
const REUSES: string[] = ['reusable', 'conditional', 'fresh_required', 'unknown'];
type VStatus = 'research_verified' | 'production_verified';
interface AuthRec { line: number; code: string; name: string; dept: string | null; jur: string | null; url: string | null; }
interface SrcRec { line: number; key: string; url: string; title: string; dept: string | null; pub: Date | null; ret: Date; ver: Date; by: string; notes: string | null; reviewed: Date | null; status: VStatus; stale: boolean; }
interface ApprRec { line: number; code: string; name: string; industry: string; auth: string; why: string; cond: string | null; notes: string | null; docs: string[]; insp: boolean; renew: boolean; sla: number | null; url: string | null; src: string; verified: Date; }
interface DocRec { line: number; code: string; name: string; dtype: string; issuer: string | null; validity: string; reuse: Reuse; recond: string; vmethod: string; }
interface DepRec { line: number; from: string; to: string; rel: Rel; cond: string | null; rationale: string; }
function findCycle(nodes: string[], edges: Map<string, string[]>): string[] | null {
  const color = new Map<string, number>(nodes.map((n) => [n, 0]));
  const stack: string[] = [];
  function visit(start: string): string[] | null {
    const work: Array<{ n: string; i: number }> = [{ n: start, i: 0 }];
    color.set(start, 1);
    stack.push(start);
    while (work.length > 0) {
      const top = work[work.length - 1];
      if (!top) break;
      const nb = edges.get(top.n) ?? [];
      if (top.i < nb.length) {
        const nxt = nb[top.i] as string;
        top.i += 1;
        const c = color.get(nxt) ?? 0;
        if (c === 1) return [...stack.slice(stack.indexOf(nxt)), nxt];
        if (c === 0) {
          color.set(nxt, 1);
          stack.push(nxt);
          work.push({ n: nxt, i: 0 });
        }
      } else {
        color.set(top.n, 2);
        stack.pop();
        work.pop();
      }
    }
    return null;
  }
  for (const n of nodes) {
    if ((color.get(n) ?? 0) === 0) {
      const c = visit(n);
      if (c) return c;
    }
  }
  return null;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const filter = opts.industry.trim().toLowerCase();
  const authCsv = loadCsv(opts.dataDir, 'authorities.csv');
  const srcCsv = loadCsv(opts.dataDir, 'sources.csv');
  const apprCsv = loadCsv(opts.dataDir, 'approvals.csv');
  const docCsv = loadCsv(opts.dataDir, 'documents.csv');
  const depCsv = loadCsv(opts.dataDir, 'dependencies.csv');
  const errors: string[] = [];
  const warnings: string[] = [];
  const shapedAppr = apprCsv.headers.length === 0 || apprCsv.headers.includes('approval_id');
  if (!shapedAppr) {
    console.log('NOTE: data/*.csv still have placeholder headers; nothing to import.');
    console.log(`Imported 0 approvals, 0 documents, 0 dependencies for industry '${opts.industry}'. 0 validation errors.`);
    return;
  }
  const auths = new Map<string, AuthRec>();
  for (let i = 0; i < authCsv.rows.length; i++) {
    const row = authCsv.rows[i] as CsvRow;
    const line = i + 2;
    const code = cell(row, 'authority_id', 'authority', 'code');
    if (!code) { errors.push(`authorities.csv:${line}: missing authority_id`); continue; }
    if (auths.has(code)) errors.push(`authorities.csv:${line}: duplicate authority "${code}"`);
    const name = cell(row, 'authority_name', 'name');
    if (!name) errors.push(`authorities.csv:${line}: authority "${code}" missing name`);
    auths.set(code, { line, code, name, dept: cell(row, 'department') || null, jur: cell(row, 'jurisdiction') || null, url: cell(row, 'official_url') || null });
  }
  const srcs = new Map<string, SrcRec>();
  for (let i = 0; i < srcCsv.rows.length; i++) {
    const row = srcCsv.rows[i] as CsvRow;
    const line = i + 2;
    const key = cell(row, 'source_id', 'source', 'key');
    if (!key) { errors.push(`sources.csv:${line}: missing source_key`); continue; }
    if (srcs.has(key)) errors.push(`sources.csv:${line}: duplicate source "${key}"`);
    const raw = cell(row, 'verification_status').trim() || 'research_verified';
    const status: VStatus = raw === 'production_verified' ? 'production_verified' : 'research_verified';
    if (raw !== 'research_verified' && raw !== 'production_verified') errors.push(`sources.csv:${line}: bad status "${raw}"`);
    srcs.set(key, { line, key, url: cell(row, 'url'), title: cell(row, 'title') || key, dept: cell(row, 'department') || null, pub: toDateOrNull(cell(row, 'published_date')), ret: toDateOrNull(cell(row, 'retrieved_date')) ?? new Date(), ver: toDateOrNull(cell(row, 'last_verified_date')) ?? new Date(), by: cell(row, 'verified_by') || 'research-team', notes: cell(row, 'notes') || null, reviewed: toDateOrNull(cell(row, 'source_last_reviewed')), status, stale: toBool(cell(row, 'staleness_flag'), false) });
  }
  const docs = new Map<string, DocRec>();
  for (let i = 0; i < docCsv.rows.length; i++) {
    const row = docCsv.rows[i] as CsvRow;
    const line = i + 2;
    const code = cell(row, 'document_id', 'code', 'id');
    if (!code) { errors.push(`documents.csv:${line}: missing document_id`); continue; }
    if (docs.has(code)) errors.push(`documents.csv:${line}: duplicate document "${code}"`);
    const raw = (cell(row, 'reusable', 'reusability').trim() || 'fresh_required') as Reuse;
    const reuse: Reuse = REUSES.includes(raw) ? raw : 'fresh_required';
    if (!REUSES.includes(raw)) warnings.push(`documents.csv:${line}: "${code}" reusability "${raw}" is not a valid enum value; mapped to fresh_required`);
    docs.set(code, { line, code, name: cell(row, 'document_name', 'name') || code, dtype: cell(row, 'document_type') || 'certificate', issuer: cell(row, 'issuing_authority_id', 'issuing_authority') || null, validity: cell(row, 'validity', 'validity_rule') || 'no expiry', reuse, recond: cell(row, 'reuse_conditions') || '', vmethod: cell(row, 'verification_method') || 'manual review' });
  }

  const apprs = new Map<string, ApprRec>();
  for (let i = 0; i < apprCsv.rows.length; i++) {
    const row = apprCsv.rows[i] as CsvRow;
    const line = i + 2;
    const code = cell(row, 'approval_id', 'code', 'id');
    if (!code) { errors.push(`approvals.csv:${line}: missing approval_id`); continue; }
    if (apprs.has(code)) errors.push(`approvals.csv:${line}: duplicate approval "${code}"`);
    const slaRaw = cell(row, 'sla', 'sla_days').trim();
    const slaUnknown = slaRaw === '' || /^unknown$/i.test(slaRaw);
    const sla = slaUnknown ? null : Number.parseInt(slaRaw, 10);
    if (!slaUnknown && (sla === null || Number.isNaN(sla))) errors.push(`approvals.csv:${line}: bad sla "${slaRaw}"`);
    // applicability_conditions is free-text prose in the dataset; store it
    // verbatim as a JSON string rather than requiring a JSON document.
    const cond: string | null = cell(row, 'applicability_conditions').trim() || null;
    const verified = toDateOrNull(cell(row, 'last_verified'));
    if (!verified) errors.push(`approvals.csv:${line}: missing last_verified`);
    apprs.set(code, { line, code, name: cell(row, 'approval_name', 'name') || code, industry: cell(row, 'industry') || opts.industry, auth: cell(row, 'authority_id', 'authority'), why: cell(row, 'why_required'), cond, notes: cell(row, 'notes').trim() || null, docs: splitCodes(cell(row, 'required_documents')), insp: toBool(cell(row, 'inspection_required'), false), renew: toBool(cell(row, 'renewal'), false), sla, url: cell(row, 'official_url') || null, src: cell(row, 'source_id', 'source'), verified: verified ?? new Date(0) });
  }
  const deps: DepRec[] = [];
  for (let i = 0; i < depCsv.rows.length; i++) {
    const row = depCsv.rows[i] as CsvRow;
    const line = i + 2;
    const from = cell(row, 'from_id', 'from_approval_id', 'from');
    const to = cell(row, 'to_id', 'to_approval_id', 'to');
    const raw = cell(row, 'relationship', 'dependency_type').trim() || 'unknown';
    if (!from || !to) { errors.push(`dependencies.csv:${line}: missing from/to id`); continue; }
    if (!RELS.includes(raw)) { errors.push(`dependencies.csv:${line}: bad relationship "${raw}"`); continue; }
    deps.push({ line, from, to, rel: raw as Rel, cond: cell(row, 'condition') || null, rationale: cell(row, 'gating_rationale').trim() });
  }

  for (const a of apprs.values()) {
    if (!a.auth) errors.push(`approvals.csv:${a.line}: "${a.code}" has no authority`);
    else if (!auths.has(a.auth)) errors.push(`approvals.csv:${a.line}: "${a.code}" unknown authority "${a.auth}"`);
    if (!a.src) errors.push(`approvals.csv:${a.line}: "${a.code}" has no source`);
    else {
      const s = srcs.get(a.src);
      if (!s) errors.push(`approvals.csv:${a.line}: "${a.code}" unknown source "${a.src}"`);
      else if (!s.url.trim()) errors.push(`sources.csv:${s.line}: source "${s.key}" empty URL`);
    }
    if (!a.why.trim()) errors.push(`approvals.csv:${a.line}: "${a.code}" missing why_required`);
    for (const d of a.docs) {
      if (!docs.has(d)) errors.push(`approvals.csv:${a.line}: "${a.code}" unknown document "${d}"`);
    }
  }
  for (const d of docs.values()) {
    if (d.issuer && !auths.has(d.issuer)) errors.push(`documents.csv:${d.line}: "${d.code}" unknown authority "${d.issuer}"`);
  }
  for (const dep of deps) {
    if (!apprs.has(dep.from)) errors.push(`dependencies.csv:${dep.line}: unknown from "${dep.from}"`);
    if (!apprs.has(dep.to)) errors.push(`dependencies.csv:${dep.line}: unknown to "${dep.to}"`);
    if (dep.rel === 'depends_on' && !dep.rationale) errors.push(`dependencies.csv:${dep.line}: depends_on ${dep.from} -> ${dep.to} needs gating_rationale`);
  }
  const adj = new Map<string, string[]>();
  for (const dep of deps) {
    if (dep.rel !== 'depends_on') continue;
    if (!apprs.has(dep.from) || !apprs.has(dep.to)) continue;
    const list = adj.get(dep.from) ?? [];
    list.push(dep.to);
    adj.set(dep.from, list);
  }
  const cyc = findCycle([...apprs.keys()], adj);
  if (cyc) errors.push(`dependencies.csv: depends_on cycle: ${cyc.join(' -> ')}`);
  for (const dep of deps) {
    const f = apprs.get(dep.from);
    const t = apprs.get(dep.to);
    if (!f || !t) continue;
    const fset = new Set(f.docs);
    const shared = t.docs.filter((x) => fset.has(x));
    if (shared.length > 0) warnings.push(`dependencies.csv:${dep.line}: "${dep.from}" + "${dep.to}" share ${shared.join(', ')}; kept edge, review manually.`);
  }
  for (const w of warnings) console.warn(`WARNING: ${w}`);
  if (errors.length > 0) {
    console.error(`Validation failed with ${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error(`Imported 0 approvals, 0 documents, 0 dependencies for industry '${opts.industry}'. ${errors.length} validation errors.`);
    process.exitCode = 1;
    return;
  }
  const scopedA = [...apprs.values()].filter((a) => filter === 'all' || !filter || !a.industry || a.industry.trim().toLowerCase() === filter);
  const need = new Set<string>();
  for (const a of scopedA) for (const d of a.docs) need.add(d);
  const scopedD = [...docs.values()].filter((d) => need.has(d.code));
  const scopedCodes = new Set(scopedA.map((a) => a.code));
  const scopedE = deps.filter((d) => scopedCodes.has(d.from) && scopedCodes.has(d.to));
  if (opts.validateOnly) {
    console.log(`Validation passed for '${opts.industry}': ${scopedA.length} approvals, ${scopedD.length} docs, ${scopedE.length} deps. 0 validation errors.`);
    return;
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      // Phase 1 exit criterion: "at least one verified industry slice is
      // loaded". A clean checkout has no knowledge_releases row yet, so the
      // importer creates the draft release on demand — `pnpm import:regulatory`
      // works one-command from a fresh `prisma migrate deploy`. A published
      // release is never created or mutated here (the DB triggers in migration
      // 20260914000000_release_immutability additionally reject such writes).
      let release = await tx.knowledgeRelease.findUnique({ where: { version: opts.release } });
      if (!release) {
        release = await tx.knowledgeRelease.create({
          data: {
            version: opts.release,
            status: 'draft',
            changeSummary: `Draft release bootstrapped by import-regulatory-data for industry '${opts.industry}'`,
          },
        });
        console.log(`Created draft KnowledgeRelease "${release.version}" (${release.id}).`);
      }
      if (release.status === 'published') throw new Error(`Release "${opts.release}" is published; use a draft`);
      
      const industryMap = new Map<string, string>();
      const distinctIndustries = [...new Set(scopedA.map((a) => a.industry.trim().toLowerCase()))];
      for (const indCode of distinctIndustries) {
        const indName = indCode === 'solar_manufacturing'
          ? 'Solar PV & Clean Tech Equipment Manufacturing'
          : indCode === 'brewery'
            ? 'Brewery & Fermentation'
            : indCode;
        const indRec = await tx.industry.upsert({
          where: { code: indCode },
          update: { name: indName },
          create: { code: indCode, name: indName },
        });
        industryMap.set(indCode, indRec.id);
      }

      const authIds = new Map<string, string>();
      for (const a of auths.values()) {
        const r = await tx.authority.upsert({ where: { code: a.code }, update: { name: a.name, department: a.dept, jurisdiction: a.jur, officialUrl: a.url }, create: { code: a.code, name: a.name, department: a.dept, jurisdiction: a.jur, officialUrl: a.url } });
        authIds.set(a.code, r.id);
      }
      const srcIds = new Map<string, string>();
      for (const s of srcs.values()) {
        const found = await tx.source.findFirst({ where: { url: s.url } });
        const sdata = { url: s.url, title: s.title, department: s.dept, publishedDate: s.pub, retrievedDate: s.ret, lastVerifiedDate: s.ver, verifiedBy: s.by, notes: s.notes, sourceLastReviewed: s.reviewed, verificationStatus: s.status, stalenessFlag: s.stale };
        const r = found ? await tx.source.update({ where: { id: found.id }, data: sdata }) : await tx.source.create({ data: sdata });
        srcIds.set(s.key, r.id);
      }

      const docIds = new Map<string, string>();
      for (const d of scopedD) {
        const issuer = d.issuer ? (authIds.get(d.issuer) ?? null) : null;
        const r = await tx.documentDefinition.upsert({ where: { code: d.code }, update: { name: d.name, documentType: d.dtype, issuingAuthorityId: issuer, validityRule: d.validity, reusability: d.reuse, reuseConditions: d.recond, verificationMethod: d.vmethod }, create: { code: d.code, name: d.name, documentType: d.dtype, issuingAuthorityId: issuer, validityRule: d.validity, reusability: d.reuse, reuseConditions: d.recond, verificationMethod: d.vmethod } });
        docIds.set(d.code, r.id);
      }
      const apprIds = new Map<string, string>();
      for (const a of scopedA) {
        const aid = authIds.get(a.auth);
        const sid = srcIds.get(a.src);
        if (!aid || !sid) throw new Error(`missing FK for "${a.code}"`);
        const indId = industryMap.get(a.industry.trim().toLowerCase());
        if (!indId) throw new Error(`missing industry for "${a.code}"`);
        const conds = toConditionJson(a.cond);
        const r = await tx.approvalDefinition.upsert({ where: { code: a.code }, update: { name: a.name, industryId: indId, authorityId: aid, whyRequired: a.why, applicabilityConditions: conds, ambiguityNotes: a.notes, inspectionRequired: a.insp, renewalRequired: a.renew, slaDays: a.sla, officialApplicationUrl: a.url, sourceId: sid, lastVerifiedDate: a.verified, releaseId: release.id }, create: { code: a.code, name: a.name, industryId: indId, authorityId: aid, whyRequired: a.why, applicabilityConditions: conds, ambiguityNotes: a.notes, inspectionRequired: a.insp, renewalRequired: a.renew, slaDays: a.sla, officialApplicationUrl: a.url, sourceId: sid, lastVerifiedDate: a.verified, releaseId: release.id } });
        apprIds.set(a.code, r.id);
        await tx.approvalDocumentRequirement.deleteMany({ where: { approvalDefinitionId: r.id } });
        for (const dc of a.docs) {
          const did = docIds.get(dc);
          if (!did) throw new Error(`missing document "${dc}"`);
          await tx.approvalDocumentRequirement.create({ data: { approvalDefinitionId: r.id, documentDefinitionId: did } });
        }
      }

      let n = 0;
      for (const dep of scopedE) {
        const fid = apprIds.get(dep.from);
        const tid = apprIds.get(dep.to);
        if (!fid || !tid) throw new Error('missing approval for edge');
        if (dep.rel === 'depends_on' && !dep.rationale) throw new Error(`depends_on ${dep.from} -> ${dep.to} needs rationale`);
        const ddata = { fromApprovalId: fid, relationship: dep.rel, toApprovalId: tid, condition: dep.cond, gatingRationale: dep.rationale || null };
        const found = await tx.dependency.findFirst({ where: { fromApprovalId: fid, toApprovalId: tid, relationship: dep.rel } });
        if (found) await tx.dependency.update({ where: { id: found.id }, data: ddata });
        else await tx.dependency.create({ data: ddata });
        n += 1;
      }
      console.log(`Imported ${scopedA.length} approvals, ${scopedD.length} documents, ${n} dependencies for industry '${opts.industry}'. 0 validation errors.`);
    });
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});


