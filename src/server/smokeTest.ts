/**
 * Quantitative Research Platform - INF-1b-C End-to-End Smoke Test
 * 
 * Verifies complete HTTP API flow on an isolated temporary database:
 * User -> Project -> Variable/Dimension/Indicator -> Response Scale ->
 * Instrument + Item -> Approve -> Questionnaire -> Publish ->
 * GET Public Survey -> Submit Survey -> GET Submissions -> Export Raw CSV.
 * 
 * Asserts:
 * - Canonical snapshot format (itemCode, questionText, non-empty scaleOptions)
 * - Safe public DTO without forbidden fields (projectId, userId, hypotheses, etc.)
 * - questionnaire_version strictly linked to instrument_version
 * - Submissions recorded with correct itemCode mapping
 * - Raw CSV export contains valid item columns and response values
 * - Production database (data/research_platform.db) remains strictly untouched
 * - Compatibility with processingService.getProcessingPrerequisites in Node
 */

import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import express from 'express';

interface StepResult {
  step: number;
  name: string;
  status: 'PASS' | 'FAIL';
  durationMs: number;
  details: string;
  error?: string;
}

function calculateFileChecksum(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

async function runEndToEndSmokeTest(): Promise<{
  allPassed: boolean;
  totalSteps: number;
  passedCount: number;
  failedCount: number;
  results: StepResult[];
}> {
  const results: StepResult[] = [];
  const prodDbPath = path.join(process.cwd(), 'data', 'research_platform.db');
  const prodDbChecksumBefore = calculateFileChecksum(prodDbPath);
  let prodDbRowCountsBefore: Record<string, number> = {};

  // Read production DB row counts before test for strict immutability guarantee
  if (fs.existsSync(prodDbPath)) {
    try {
      const { DatabaseSync } = await import('node:sqlite');
      const prodDb = new DatabaseSync(prodDbPath);
      const tables = prodDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
      for (const t of tables) {
        const countRow = prodDb.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get() as { c: number };
        prodDbRowCountsBefore[t.name] = countRow.c;
      }
      prodDb.close();
    } catch {
      // Ignore if prod DB cannot be locked in parallel
    }
  }

  // Setup isolated temporary database for test
  const tempDbId = `smoke_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const tempDbPath = path.join(os.tmpdir(), `${tempDbId}.db`);
  process.env.DB_PATH = tempDbPath;

  // Dynamically load database and routes to ensure DB_PATH env var is respected
  const { db, DB_PATH } = await import('./db.js');
  const { apiRouter } = await import('./routes.js');

  // Verify isolated DB is being used
  if (path.resolve(DB_PATH) === path.resolve(prodDbPath)) {
    throw new Error('CRITICAL SAFETY FAILURE: Isolated test DB points to production database!');
  }

  // Start HTTP Express test server on ephemeral port (0)
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = await new Promise<import('http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  async function executeStep(step: number, name: string, fn: () => Promise<string>): Promise<boolean> {
    const start = Date.now();
    try {
      const details = await fn();
      results.push({
        step,
        name,
        status: 'PASS',
        durationMs: Date.now() - start,
        details,
      });
      return true;
    } catch (err: any) {
      results.push({
        step,
        name,
        status: 'FAIL',
        durationMs: Date.now() - start,
        details: 'Step failed with error.',
        error: err.message || String(err),
      });
      return false;
    }
  }

  // State across flow
  let authToken = '';
  let userId = '';
  let projectId = '';
  let variableId = '';
  let dimensionId = '';
  let indicatorId = '';
  let scaleId = '';
  let instrumentId = '';
  let itemId = '';
  let approvedInstVersionId = '';
  let questionnaireId = '';
  let questionnaireSlug = '';
  let publishedVersionId = '';
  let questionnaireVersionPayload: any = null;
  let submissionId = '';
  const testItemCode = 'ENG.01';

  try {
    // 1. User Registration
    await executeStep(1, 'User Registration (POST /auth/register)', async () => {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Dr. Alexis Vance',
          email: `alexis_${Date.now()}@institute.org`,
          institution: 'Cognitive Science Laboratory',
          role: 'Lead Quantitative Researcher',
        }),
      });
      const data = await res.json() as any;
      if (!res.ok || !data.success || !data.token) {
        throw new Error(`Register failed (${res.status}): ${data.error || JSON.stringify(data)}`);
      }
      authToken = data.token;
      userId = data.user.id;
      return `User registered: ${userId} (${data.user.email})`;
    });

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };

    // 2. Project Creation
    await executeStep(2, 'Project Creation (POST /projects)', async () => {
      const res = await fetch(`${baseUrl}/projects`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Deep Work Cognition Study 2026',
          description: 'Evaluating cognitive flow and sustained attention during complex problem-solving.',
          researchTopic: 'Cognitive Ergonomics',
          researchObjective: 'Determine empirical relationship between focused duration and error rate',
          researchMethod: 'Quantitative Survey & Reaction Testing',
          population: 'Knowledge workers in software and scientific domains',
        }),
      });
      const data = await res.json() as any;
      if (!res.ok || !data.success || !data.data?.id) {
        throw new Error(`Project creation failed (${res.status}): ${data.error || JSON.stringify(data)}`);
      }
      projectId = data.data.id;
      return `Project created: ${projectId} ("${data.data.title}")`;
    });

    // 3. Variable Creation
    await executeStep(3, 'Variable Creation (POST /projects/:id/variables)', async () => {
      const res = await fetch(`${baseUrl}/projects/${projectId}/variables`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Cognitive Engagement',
          code: 'COG_ENG',
          variableType: 'Latent Construct',
          role: 'Independent',
          measurementScale: 'Ordinal',
          conceptualDefinition: 'The state of sustained focused attention on research tasks',
        }),
      });
      const data = await res.json() as any;
      if (!res.ok || !data.success || !data.data?.id) {
        throw new Error(`Variable creation failed (${res.status}): ${data.error || JSON.stringify(data)}`);
      }
      variableId = data.data.id;
      return `Variable created: ${variableId} (Code: ${data.data.code})`;
    });

    // 4. Dimension Creation
    await executeStep(4, 'Dimension Creation (POST /projects/:id/dimensions)', async () => {
      const res = await fetch(`${baseUrl}/projects/${projectId}/dimensions`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          variableId,
          name: 'Attentional Absorption',
          code: 'DIM_ABS',
          definition: 'Intensity of deep focus without task-irrelevant intrusions',
          orderIndex: 1,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok || !data.success || !data.data?.id) {
        throw new Error(`Dimension creation failed (${res.status}): ${data.error || JSON.stringify(data)}`);
      }
      dimensionId = data.data.id;
      return `Dimension created: ${dimensionId} (Code: ${data.data.code})`;
    });

    // 5. Indicator Creation
    await executeStep(5, 'Indicator Creation (POST /projects/:id/indicators)', async () => {
      const res = await fetch(`${baseUrl}/projects/${projectId}/indicators`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          dimensionId,
          variableId,
          name: 'Immersion Factor',
          code: 'IND_IMM',
          definition: 'Reported temporal distortion during task execution',
          orderIndex: 1,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok || !data.success || !data.data?.id) {
        throw new Error(`Indicator creation failed (${res.status}): ${data.error || JSON.stringify(data)}`);
      }
      indicatorId = data.data.id;
      return `Indicator created: ${indicatorId} (Code: ${data.data.code})`;
    });

    // 6. Response Scale Creation
    await executeStep(6, 'Response Scale Creation (POST /projects/:id/scales)', async () => {
      const scaleOptions = [
        { value: 1, label: 'Never' },
        { value: 2, label: 'Rarely' },
        { value: 3, label: 'Sometimes' },
        { value: 4, label: 'Often' },
        { value: 5, label: 'Always' },
      ];
      const res = await fetch(`${baseUrl}/projects/${projectId}/scales`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: '5-Point Frequency Scale',
          scaleType: 'Likert',
          minValue: 1,
          maxValue: 5,
          options: scaleOptions,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok || !data.success || !data.data?.id) {
        throw new Error(`Scale creation failed (${res.status}): ${data.error || JSON.stringify(data)}`);
      }
      scaleId = data.data.id;
      if (!Array.isArray(data.data.options) || data.data.options.length !== 5) {
        throw new Error(`Scale options not properly recorded: ${JSON.stringify(data.data.options)}`);
      }
      return `Scale created: ${scaleId} (5 Likert options validated)`;
    });

    // 7. Instrument & Item Creation
    await executeStep(7, 'Instrument + Item Creation (POST /instruments & /items)', async () => {
      // 7a. Instrument
      const instRes = await fetch(`${baseUrl}/projects/${projectId}/instruments`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Cognitive Engagement Inventory (CEI-5)',
          code: 'CEI5',
          description: 'Inventory measuring deep engagement and focus during complex research tasks.',
          purpose: 'Empirical measurement of attentional immersion',
          variableIds: [variableId],
        }),
      });
      const instData = await instRes.json() as any;
      if (!instRes.ok || !instData.success || !instData.data?.id) {
        throw new Error(`Instrument creation failed (${instRes.status}): ${instData.error || JSON.stringify(instData)}`);
      }
      instrumentId = instData.data.id;

      // 7b. Item
      const itemRes = await fetch(`${baseUrl}/projects/${projectId}/instruments/${instrumentId}/items`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          itemCode: testItemCode,
          itemNumber: 1,
          questionText: 'When working on complex problems, I lose track of time.',
          itemType: 'Likert',
          variableId,
          dimensionId,
          indicatorId,
          responseScaleId: scaleId,
          required: true,
          reverseCoded: false,
        }),
      });
      const itemData = await itemRes.json() as any;
      if (!itemRes.ok || !itemData.success || !itemData.data?.id) {
        throw new Error(`Item creation failed (${itemRes.status}): ${itemData.error || JSON.stringify(itemData)}`);
      }
      itemId = itemData.data.id;
      return `Instrument ${instrumentId} created with Item ${itemId} (itemCode: ${testItemCode})`;
    });

    // 8. Psychometric Instrument Approval
    await executeStep(8, 'Instrument Approval (POST /instruments/:id/approve)', async () => {
      const res = await fetch(`${baseUrl}/projects/${projectId}/instruments/${instrumentId}/approve`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          notes: 'Psychometric content validity and structural verification completed.',
          validationSummary: { passed: true, itemCount: 1, scalesValid: true },
        }),
      });
      const data = await res.json() as any;
      if (!res.ok || !data.success) {
        throw new Error(`Approve instrument failed (${res.status}): ${data.error || JSON.stringify(data)}`);
      }

      // Assert snapshot in database: canonical format with scaleOptions
      const versionRow = db.prepare('SELECT * FROM instrument_versions WHERE instrument_id = ? ORDER BY version_number DESC LIMIT 1').get(instrumentId) as any;
      if (!versionRow) {
        throw new Error('No instrument_versions row found in database after approval');
      }
      approvedInstVersionId = versionRow.id;

      const itemsSnapshot = JSON.parse(versionRow.items_snapshot_json);
      if (!Array.isArray(itemsSnapshot) || itemsSnapshot.length === 0) {
        throw new Error('items_snapshot_json in instrument_version is empty or not an array');
      }

      const snapItem = itemsSnapshot[0];
      if (snapItem.itemCode !== testItemCode) {
        throw new Error(`Item snapshot itemCode mismatch: expected "${testItemCode}", got "${snapItem.itemCode}"`);
      }
      if (!snapItem.questionText || typeof snapItem.questionText !== 'string') {
        throw new Error('Item snapshot questionText missing or empty');
      }
      if (!Array.isArray(snapItem.scaleOptions) || snapItem.scaleOptions.length !== 5) {
        throw new Error(`Item snapshot scaleOptions missing or empty: ${JSON.stringify(snapItem.scaleOptions)}`);
      }

      return `Instrument approved: Version ${versionRow.version_number} (${approvedInstVersionId}). Snapshot canonical with 5 scaleOptions.`;
    });

    // 9. Questionnaire Creation
    await executeStep(9, 'Questionnaire Creation (POST /questionnaires)', async () => {
      const res = await fetch(`${baseUrl}/projects/${projectId}/questionnaires`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Cognitive Engagement Field Survey',
          instrumentId,
          responseMode: 'anonymous',
          instructions: 'Please answer candidly based on your recent work experience.',
          consentStatement: 'I voluntarily participate in this scientific study.',
          closingMessage: 'Thank you for contributing to cognitive science research.',
        }),
      });
      const data = await res.json() as any;
      if (!res.ok || !data.success || !data.data?.id) {
        throw new Error(`Questionnaire creation failed (${res.status}): ${data.error || JSON.stringify(data)}`);
      }
      questionnaireId = data.data.id;
      questionnaireSlug = data.data.slug;
      return `Questionnaire created: ${questionnaireId} (slug: ${questionnaireSlug})`;
    });

    // 10. Publish Questionnaire
    await executeStep(10, 'Publish Questionnaire (POST /questionnaires/:id/publish)', async () => {
      const res = await fetch(`${baseUrl}/projects/${projectId}/questionnaires/${questionnaireId}/publish`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          changeSummary: 'Initial publication for empirical data collection',
          // Client body snapshots must be ignored by authoritative server logic
          itemsSnapshot: [{ malicious: true }],
        }),
      });
      const data = await res.json() as any;
      const vId = data.versionId || data.data?.id;
      if (!res.ok || !data.success || !vId) {
        throw new Error(`Publish questionnaire failed (${res.status}): ${data.error || JSON.stringify(data)}`);
      }
      publishedVersionId = vId;

      // Direct DB assertion: check questionnaire_versions row
      const qvRow = db.prepare('SELECT * FROM questionnaire_versions WHERE id = ?').get(publishedVersionId) as any;
      if (!qvRow) {
        throw new Error('questionnaire_versions row not found in database');
      }

      // Assert: questionnaire_version is strictly linked to instrument_version
      if (qvRow.instrument_version_id !== approvedInstVersionId) {
        throw new Error(`instrument_version_id mismatch: expected "${approvedInstVersionId}", got "${qvRow.instrument_version_id}"`);
      }

      // Assert: canonical snapshot format
      const itemsSnapshot = JSON.parse(qvRow.items_snapshot_json);
      if (!Array.isArray(itemsSnapshot) || itemsSnapshot.length === 0) {
        throw new Error('items_snapshot_json in questionnaire_version is empty');
      }
      const item0 = itemsSnapshot[0];
      if (item0.itemCode !== testItemCode) {
        throw new Error(`itemsSnapshot[0].itemCode mismatch: expected "${testItemCode}", got "${item0.itemCode}"`);
      }
      if (!item0.questionText) {
        throw new Error('itemsSnapshot[0].questionText is missing');
      }
      if (!Array.isArray(item0.scaleOptions) || item0.scaleOptions.length !== 5) {
        throw new Error(`itemsSnapshot[0].scaleOptions must contain 5 options: got ${JSON.stringify(item0.scaleOptions)}`);
      }

      questionnaireVersionPayload = {
        id: qvRow.id,
        questionnaireId: qvRow.questionnaire_id,
        instrumentId: qvRow.instrument_id,
        instrumentVersionId: qvRow.instrument_version_id,
        versionNumber: qvRow.version_number,
        publishedAt: qvRow.published_at,
        itemsSnapshot,
        isLocked: Boolean(qvRow.is_locked),
        createdAt: qvRow.created_at,
      };

      return `Published version ${qvRow.version_number} (${publishedVersionId}) strictly linked to instrument version ${approvedInstVersionId}. Canonical snapshot verified.`;
    });

    // 11. GET Public Survey
    await executeStep(11, 'GET Public Survey (GET /public/surveys/:slug)', async () => {
      // Must be public: no authorization header sent
      const res = await fetch(`${baseUrl}/public/surveys/${questionnaireSlug}`);
      const data = await res.json() as any;
      if (!res.ok || !data.success || !data.data) {
        throw new Error(`GET public survey failed (${res.status}): ${data.error || JSON.stringify(data)}`);
      }

      const dto = data.data;

      // Forbidden fields that must NEVER leak to the public survey endpoint:
      const forbiddenTopLevel = [
        'projectId', 'project_id',
        'userId', 'user_id',
        'ownerId', 'owner_id',
        'password', 'token', 'sessionToken',
        'hypotheses', 'rulesSnapshot', 'audit_logs',
      ];

      for (const field of forbiddenTopLevel) {
        if (dto[field] !== undefined) {
          throw new Error(`Security Violation: Forbidden field "${field}" leaked in public DTO!`);
        }
      }

      // Assert items are present and valid
      if (!Array.isArray(dto.items) || dto.items.length === 0) {
        throw new Error('Public survey DTO contains no items');
      }

      const publicItem = dto.items[0];
      if (publicItem.itemCode !== testItemCode) {
        throw new Error(`Public item itemCode mismatch: expected "${testItemCode}", got "${publicItem.itemCode}"`);
      }
      if (!publicItem.questionText) {
        throw new Error('Public item questionText is missing');
      }
      if (!Array.isArray(publicItem.scaleOptions) || publicItem.scaleOptions.length !== 5) {
        throw new Error(`Public item scaleOptions invalid: ${JSON.stringify(publicItem.scaleOptions)}`);
      }

      // Verify items do not leak internal metadata
      const forbiddenItemFields = ['projectId', 'project_id', 'userId', 'user_id', 'ownerId', 'notes'];
      for (const f of forbiddenItemFields) {
        if (publicItem[f] !== undefined) {
          throw new Error(`Security Violation: Forbidden item field "${f}" leaked in public item!`);
        }
      }

      return `Public DTO safe & verified (slug: ${dto.slug}, items: ${dto.items.length}, forbidden fields cleanly excluded).`;
    });

    // 12. Submit Public Survey
    await executeStep(12, 'Submit Public Survey (POST /public/surveys/:slug/submissions)', async () => {
      const rawResponses = { [testItemCode]: '5' };
      const res = await fetch(`${baseUrl}/public/surveys/${questionnaireSlug}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: `sess_${Date.now()}_test`,
          startedAt: new Date(Date.now() - 45000).toISOString(),
          consentGiven: true,
          participantIdentifier: 'participant_smoke_01',
          durationSeconds: 45,
          rawResponses,
        }),
      });
      const data = await res.json() as any;
      const subId = data.data?.submissionId || data.data?.id;
      if (!res.ok || !data.success || !subId) {
        throw new Error(`Survey submission failed (${res.status}): ${data.error || JSON.stringify(data)}`);
      }
      submissionId = subId;

      // DB assertion: verify submission stored with correct itemCode
      const subRow = db.prepare('SELECT * FROM survey_submissions WHERE id = ?').get(submissionId) as any;
      if (!subRow) {
        throw new Error(`Submission record ${submissionId} not found in database`);
      }

      const storedResponses = JSON.parse(subRow.raw_responses_json);
      if (storedResponses[testItemCode] !== '5') {
        throw new Error(`Stored raw responses mismatch: expected ${testItemCode}="5", got ${JSON.stringify(storedResponses)}`);
      }

      return `Submission accepted: ${submissionId} (itemCode ${testItemCode} stored with value "5")`;
    });

    // 13. GET Submissions
    await executeStep(13, 'GET Submissions (GET /projects/:id/submissions)', async () => {
      const res = await fetch(`${baseUrl}/projects/${projectId}/submissions?questionnaireId=${questionnaireId}`, {
        headers: authHeaders,
      });
      const data = await res.json() as any;
      if (!res.ok || !data.success || !Array.isArray(data.data)) {
        throw new Error(`GET submissions failed (${res.status}): ${data.error || JSON.stringify(data)}`);
      }

      const sub = data.data.find((s: any) => s.id === submissionId);
      if (!sub) {
        throw new Error(`Submission ${submissionId} not found in project submissions list`);
      }

      if (sub.rawResponses[testItemCode] !== '5') {
        throw new Error(`Submission response for ${testItemCode} invalid: ${sub.rawResponses[testItemCode]}`);
      }

      return `Submissions retrieved: ${data.data.length} records. Submission ${submissionId} verified.`;
    });

    // 14. Export Raw CSV
    await executeStep(14, 'Export Raw CSV (GET /projects/:id/submissions/export-raw)', async () => {
      const res = await fetch(`${baseUrl}/projects/${projectId}/submissions/export-raw?questionnaireId=${questionnaireId}`, {
        headers: authHeaders,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Export raw CSV failed (${res.status}): ${errText}`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('csv')) {
        throw new Error(`Expected text/csv content type, got "${contentType}"`);
      }

      const csvText = await res.text();
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) {
        throw new Error(`CSV contains insufficient lines: ${csvText}`);
      }

      const headerLine = lines[0];
      const dataLine = lines[1];

      // Assert itemCode column is present in header
      if (!headerLine.includes(testItemCode)) {
        throw new Error(`CSV header does not contain item column "${testItemCode}": "${headerLine}"`);
      }

      // Assert response value '5' is present in data row
      if (!dataLine.includes('"5"')) {
        throw new Error(`CSV data row does not contain answer "5": "${dataLine}"`);
      }

      return `CSV export verified: header contains "${testItemCode}", data row contains response value "5".`;
    });

    // 15. Verify Production Database Immutability
    await executeStep(15, 'Production DB Immutability Verification', async () => {
      const prodDbChecksumAfter = calculateFileChecksum(prodDbPath);
      if (prodDbChecksumBefore !== null && prodDbChecksumAfter !== prodDbChecksumBefore) {
        throw new Error(`FATAL: Production database checksum altered! Before: ${prodDbChecksumBefore}, After: ${prodDbChecksumAfter}`);
      }

      // Verify row counts unchanged
      if (fs.existsSync(prodDbPath)) {
        const { DatabaseSync } = await import('node:sqlite');
        const prodDb = new DatabaseSync(prodDbPath);
        for (const [table, beforeCount] of Object.entries(prodDbRowCountsBefore)) {
          try {
            const countRow = prodDb.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get() as { c: number };
            if (countRow.c !== beforeCount) {
              prodDb.close();
              throw new Error(`FATAL: Table "${table}" row count changed from ${beforeCount} to ${countRow.c}!`);
            }
          } catch (e: any) {
            prodDb.close();
            throw e;
          }
        }
        prodDb.close();
      }

      return 'Production database data/research_platform.db verified completely untouched (checksum & row counts match).';
    });

    // 16. Test processingService.getProcessingPrerequisites in Node
    await executeStep(16, 'Check processingService.getProcessingPrerequisites', async () => {
      // Analyze Node runtime execution capability:
      // processingService.getProcessingPrerequisites is synchronous and reads from:
      // - projectService.getProject (uses memoryProjects)
      // - questionnaireService._getAllQuestionnaires (uses memoryQuestionnaires)
      // - questionnaireService._getAllVersions (uses memoryVersions)
      // - submissionService.getByQuestionnaire (uses memorySubmissions)
      //
      // Because these are client-side in-memory arrays in browser SPA context,
      // in Node.js they can be populated/seeded with the authoritative HTTP payloads
      // to execute the exact business logic of getProcessingPrerequisites without a browser!

      const { processingService } = await import('../services/processingService.js');
      const { projectService } = await import('../services/projectService.js');
      const { questionnaireService } = await import('../services/questionnaireService.js');
      const { submissionService } = await import('../services/submissionService.js');

      // Seed client services with our HTTP-retrieved entities
      (projectService as any).getProject = (pId: string, uId: string) => ({
        success: true,
        data: {
          id: pId,
          userId: uId,
          title: 'Deep Work Cognition Study 2026',
          status: 'Active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        statusCode: 200,
      });

      (questionnaireService as any)._getAllQuestionnaires = () => [
        {
          id: questionnaireId,
          projectId,
          instrumentId,
          title: 'Cognitive Engagement Field Survey',
          currentVersion: 1,
          status: 'Active',
          publicSlug: questionnaireSlug,
          responseMode: 'anonymous',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      (questionnaireService as any)._getAllVersions = () => [questionnaireVersionPayload];

      (submissionService as any).getByQuestionnaire = () => ({
        success: true,
        data: [
          {
            id: submissionId,
            questionnaireId,
            questionnaireVersionId: publishedVersionId,
            questionnaireVersion: 1,
            projectId,
            sessionId: 'sess_test',
            participantMode: 'anonymous',
            consentGiven: true,
            startedAt: new Date().toISOString(),
            submittedAt: new Date().toISOString(),
            durationSeconds: 45,
            status: 'Submitted',
            validationStatus: 'Valid',
            rawResponses: { [testItemCode]: '5' },
            createdAt: new Date().toISOString(),
          },
        ],
        statusCode: 200,
      });

      // Call getProcessingPrerequisites in Node.js
      const prereqResult = processingService.getProcessingPrerequisites(questionnaireId, projectId, userId);

      if (!prereqResult.success) {
        throw new Error(`getProcessingPrerequisites failed: ${prereqResult.error}`);
      }

      const prereqData = prereqResult.data;
      if (!prereqData?.canProcess) {
        throw new Error(`getProcessingPrerequisites returned canProcess=false: ${prereqData?.errorMessages?.join('; ')}`);
      }

      // Static and semantic payload assertion:
      // Likert items have non-empty scaleOptions; submissionCount >= 1; itemCount >= 1
      if (prereqData.submissionCount !== 1) {
        throw new Error(`Expected submissionCount=1, got ${prereqData.submissionCount}`);
      }
      if (prereqData.itemCount !== 1) {
        throw new Error(`Expected itemCount=1, got ${prereqData.itemCount}`);
      }

      return `getProcessingPrerequisites passed in Node (canProcess: true, submissions: ${prereqData.submissionCount}, items: ${prereqData.itemCount}, errors: 0).`;
    });

  } finally {
    // Teardown
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      db.close();
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      if (fs.existsSync(`${tempDbPath}-wal`)) fs.unlinkSync(`${tempDbPath}-wal`);
      if (fs.existsSync(`${tempDbPath}-shm`)) fs.unlinkSync(`${tempDbPath}-shm`);
    } catch {
      // Ignore temporary file cleanup errors
    }
  }

  const passedCount = results.filter(r => r.status === 'PASS').length;
  const failedCount = results.filter(r => r.status === 'FAIL').length;
  const allPassed = failedCount === 0 && results.length > 0;

  return {
    allPassed,
    totalSteps: results.length,
    passedCount,
    failedCount,
    results,
  };
}

// If run directly from CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('================================================================');
  console.log(' quantitative-research-platform - INF-1b-C End-to-End Smoke Test');
  console.log('================================================================\n');

  runEndToEndSmokeTest()
    .then((report) => {
      console.log('| Step | Action / Assertion | Status | Duration | Details |');
      console.log('|---|---|---|---|---|');
      for (const r of report.results) {
        const details = r.error ? `ERR: ${r.error}` : r.details;
        console.log(`| ${r.step} | ${r.name} | **${r.status}** | ${r.durationMs}ms | ${details} |`);
      }
      console.log('\n----------------------------------------------------------------');
      console.log(`Summary: ${report.passedCount}/${report.totalSteps} PASSED (${report.failedCount} failed)`);
      console.log('----------------------------------------------------------------\n');
      if (!report.allPassed) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal unhandled error in smoke test execution:', err);
      process.exit(1);
    });
}

export { runEndToEndSmokeTest };
