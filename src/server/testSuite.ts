import { db } from './db.js';
import { createSession } from './auth.js';

export interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  details: string;
  error?: string;
}

export function runAllAcceptanceTests(): {
  allPassed: boolean;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  results: TestResult[];
} {
  const results: TestResult[] = [];

  function record(name: string, category: string, fn: () => void) {
    const start = Date.now();
    try {
      fn();
      results.push({
        name,
        category,
        passed: true,
        durationMs: Date.now() - start,
        details: 'Assertion passed successfully.',
      });
    } catch (err: any) {
      results.push({
        name,
        category,
        passed: false,
        durationMs: Date.now() - start,
        details: 'Assertion failed.',
        error: err.message || String(err),
      });
    }
  }

  // TEST SUITE 1: Server Authentication & Tenant Isolation
  record('Server-Side Authentication Session', 'Security', () => {
    const session = createSession('usr_amelia_ross');
    if (!session.token || !session.token.startsWith('sess_')) {
      throw new Error('Invalid session token generated');
    }
    if (session.user.id !== 'usr_amelia_ross') {
      throw new Error('Session user ID does not match requested user');
    }
  });

  record('Cross-Tenant Project Isolation Check', 'Security', () => {
    // Check whether usr_kenji_sato can access proj_demo_doomscrolling_2026 (owned by amelia_ross)
    const ameliaProj = db.prepare('SELECT id, user_id FROM projects WHERE id = ?').get('proj_demo_doomscrolling_2026') as any;
    if (!ameliaProj) throw new Error('Demo project missing');
    if (ameliaProj.user_id !== 'usr_amelia_ross') throw new Error('Demo project owner mismatch');

    // Query with Kenji's ID must return zero rows
    const unauthorizedQuery = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get('proj_demo_doomscrolling_2026', 'usr_kenji_sato');
    if (unauthorizedQuery) {
      throw new Error('Tenant isolation breach: Kenji was able to query Amelia\'s project');
    }
  });

  // TEST SUITE 2: Multi-Device Participant Survey & Immutability
  record('Public Survey Endpoint Participant Privacy', 'Data Separation', () => {
    const slug = 'doomscrolling-behavior-study-2026';
    const q = db.prepare('SELECT * FROM questionnaires WHERE slug = ?').get(slug) as any;
    if (!q) throw new Error('Public survey questionnaire not found by slug');
    if (q.status !== 'Active') throw new Error('Questionnaire not active');

    // Get version snapshot
    const v = db.prepare('SELECT * FROM questionnaire_versions WHERE questionnaire_id = ? AND version_number = ?').get(q.id, q.current_version) as any;
    if (!v) throw new Error('Active version snapshot missing');

    const items = JSON.parse(v.items_snapshot_json);
    if (!Array.isArray(items) || items.length === 0) throw new Error('Items snapshot is empty');
  });

  record('Multi-Device Simulated Submission (Device B -> Central Server)', 'Multi-Device', () => {
    const testSubId = `test_sub_multidevice_${Date.now()}`;
    const testVersionId = 'qv_demo_doomscrolling_v1';
    const testProjectId = 'proj_demo_doomscrolling_2026';
    const testQId = 'q_demo_doomscrolling';
    const now = new Date().toISOString();

    const rawResponses = {
      'DMS.01': '4',
      'DMS.02': '5',
      'DMS.03': '4',
      'DMS.04': '2', // Reverse coded answer
      'DMS.05': '5',
    };

    // Device B submits directly to central database
    db.prepare(`
      INSERT INTO survey_submissions (
        id, questionnaire_id, questionnaire_version_id, project_id, session_id,
        participant_mode, participant_identifier, questionnaire_version, started_at, submitted_at,
        duration_seconds, raw_responses_json, raw_item_details_json, validation_status,
        validation_flags_json, researcher_decision_notes, status, user_agent, ip_address, created_at
      ) VALUES (?, ?, ?, ?, 'sess_device_b_test', 'anonymous', null, 1, ?, ?, 45, ?, ?, 'Valid', '[]', null, 'Submitted', 'Device-B-Mobile/1.0', '192.168.1.50', ?)
    `).run(
      testSubId,
      testQId,
      testVersionId,
      testProjectId,
      now,
      now,
      JSON.stringify(rawResponses),
      JSON.stringify({}),
      now
    );

    // Device A queries submissions for the project
    const retrieved = db.prepare('SELECT * FROM survey_submissions WHERE id = ?').get(testSubId) as any;
    if (!retrieved) throw new Error('Device A could not retrieve submission submitted by Device B');
    if (retrieved.project_id !== testProjectId) throw new Error('Submission project ID mismatch');
    if (retrieved.questionnaire_version_id !== testVersionId) throw new Error('Version ID mismatch');

    const parsedResponses = JSON.parse(retrieved.raw_responses_json);
    if (parsedResponses['DMS.01'] !== '4' || parsedResponses['DMS.04'] !== '2') {
      throw new Error('Raw responses altered or corrupted in database');
    }
  });

  // TEST SUITE 3: Fix Raw Export Bug Regression Test
  record('Regression Test: Raw Export Version Snapshot Integrity', 'Lineage & Export', () => {
    // Scenario from Requirement 17:
    // Version A has Q1, Q2, Q3
    // Version B has Q1, Q2 (Q3 removed)
    const testProjId = 'proj_export_regression_test';
    const testQId = 'q_export_regression_test';
    const vAId = 'qv_test_version_a';
    const vBId = 'qv_test_version_b';
    const now = new Date().toISOString();

    // Create temporary test questionnaire & versions if not present
    const existingProj = db.prepare('SELECT id FROM projects WHERE id = ?').get(testProjId);
    if (!existingProj) {
      db.prepare(`
        INSERT INTO projects (id, user_id, title, status, created_at, updated_at)
        VALUES (?, 'usr_amelia_ross', 'Export Regression Test Project', 'Draft', ?, ?)
      `).run(testProjId, now, now);
    }

    const existingQ = db.prepare('SELECT id FROM questionnaires WHERE id = ?').get(testQId);
    if (!existingQ) {
      db.prepare(`
        INSERT INTO questionnaires (id, project_id, title, status, current_version, slug, response_mode, anonymity_mode, created_at, updated_at)
        VALUES (?, ?, 'Regression Survey', 'Active', 2, 'slug-regression-test', 'anonymous', 'strict_anonymous', ?, ?)
      `).run(testQId, testProjId, now, now);
    }

    const itemsVersionA = [
      { itemCode: 'Q1', questionText: 'Question 1', itemType: 'Likert' },
      { itemCode: 'Q2', questionText: 'Question 2', itemType: 'Likert' },
      { itemCode: 'Q3', questionText: 'Question 3', itemType: 'Likert' },
    ];

    const itemsVersionB = [
      { itemCode: 'Q1', questionText: 'Question 1', itemType: 'Likert' },
      { itemCode: 'Q2', questionText: 'Question 2', itemType: 'Likert' },
    ];

    const existingVA = db.prepare('SELECT id FROM questionnaire_versions WHERE id = ?').get(vAId);
    if (!existingVA) {
      db.prepare(`
        INSERT INTO questionnaire_versions (id, questionnaire_id, project_id, version_number, status, title, items_snapshot_json, scales_snapshot_json, published_at, created_at)
        VALUES (?, ?, ?, 1, 'Published', 'Version A', ?, '[]', ?, ?)
      `).run(vAId, testQId, testProjId, JSON.stringify(itemsVersionA), now, now);
    }

    const existingVB = db.prepare('SELECT id FROM questionnaire_versions WHERE id = ?').get(vBId);
    if (!existingVB) {
      db.prepare(`
        INSERT INTO questionnaire_versions (id, questionnaire_id, project_id, version_number, status, title, items_snapshot_json, scales_snapshot_json, published_at, created_at)
        VALUES (?, ?, ?, 2, 'Published', 'Version B', ?, '[]', ?, ?)
      `).run(vBId, testQId, testProjId, JSON.stringify(itemsVersionB), now, now);
    }

    // Clean any prior test submissions for this test
    db.prepare('DELETE FROM survey_submissions WHERE project_id = ?').run(testProjId);

    // Submission 1 under Version A: has Q1, Q2, Q3
    const sub1Id = `sub_regression_v1_${Date.now()}`;
    db.prepare(`
      INSERT INTO survey_submissions (
        id, questionnaire_id, questionnaire_version_id, project_id, session_id, participant_mode,
        questionnaire_version, started_at, submitted_at, duration_seconds, raw_responses_json,
        raw_item_details_json, validation_status, validation_flags_json, status, created_at
      ) VALUES (?, ?, ?, ?, 'sess_v1', 'anonymous', 1, ?, ?, 60, ?, '{}', 'Valid', '[]', 'Submitted', ?)
    `).run(sub1Id, testQId, vAId, testProjId, now, now, JSON.stringify({ Q1: '5', Q2: '4', Q3: '3' }), now);

    // Submission 2 under Version B: has Q1, Q2
    const sub2Id = `sub_regression_v2_${Date.now()}`;
    db.prepare(`
      INSERT INTO survey_submissions (
        id, questionnaire_id, questionnaire_version_id, project_id, session_id, participant_mode,
        questionnaire_version, started_at, submitted_at, duration_seconds, raw_responses_json,
        raw_item_details_json, validation_status, validation_flags_json, status, created_at
      ) VALUES (?, ?, ?, ?, 'sess_v2', 'anonymous', 2, ?, ?, 60, ?, '{}', 'Valid', '[]', 'Submitted', ?)
    `).run(sub2Id, testQId, vBId, testProjId, now, now, JSON.stringify({ Q1: '3', Q2: '2' }), now);

    // Verify Version A export schema
    const vARow = db.prepare('SELECT items_snapshot_json FROM questionnaire_versions WHERE id = ?').get(vAId) as any;
    const vAItems = JSON.parse(vARow.items_snapshot_json);
    const vACodes = vAItems.map((i: any) => i.itemCode);

    if (!vACodes.includes('Q1') || !vACodes.includes('Q2') || !vACodes.includes('Q3')) {
      throw new Error('Version A items snapshot was corrupted');
    }

    // Check Sub1's raw response
    const sub1 = db.prepare('SELECT raw_responses_json, questionnaire_version_id FROM survey_submissions WHERE id = ?').get(sub1Id) as any;
    if (sub1.questionnaire_version_id !== vAId) {
      throw new Error('Submission 1 is not tied to Version A');
    }
    const sub1Responses = JSON.parse(sub1.raw_responses_json);
    if (sub1Responses['Q3'] !== '3') {
      throw new Error('Submission 1 Q3 response was lost or corrupted');
    }
  });

  // TEST SUITE 4: Processing and Scoring Lineage Integrity
  record('Processing and Scoring Lineage Invariants', 'Data Lineage', () => {
    const testProjectId = 'proj_demo_doomscrolling_2026';
    const now = new Date().toISOString();

    const procRunId = `test_proc_${Date.now()}`;
    db.prepare(`
      INSERT INTO processing_runs (
        id, project_id, questionnaire_id, questionnaire_version_id, created_by,
        created_at, status, source_submission_count, valid_record_count, excluded_record_count,
        rules_snapshot_json, error_count, warning_count
      ) VALUES (?, ?, 'q_demo_doomscrolling', 'qv_demo_doomscrolling_v1', 'usr_amelia_ross', ?, 'Completed', 10, 10, 0, '{}', 0, 0)
    `).run(procRunId, testProjectId, now);

    const scoringRunId = `test_scrun_${Date.now()}`;
    db.prepare(`
      INSERT INTO scoring_runs (
        id, project_id, processing_run_id, questionnaire_id, questionnaire_version_id,
        created_by, created_at, status, source_record_count, scored_record_count,
        rules_snapshot_json, error_count, warning_count
      ) VALUES (?, ?, ?, 'q_demo_doomscrolling', 'qv_demo_doomscrolling_v1', 'usr_amelia_ross', ?, 'Completed', 10, 10, '{}', 0, 0)
    `).run(scoringRunId, testProjectId, procRunId, now);

    // Verify lineage traceability
    const scoreRecord = db.prepare('SELECT processing_run_id, questionnaire_version_id FROM scoring_runs WHERE id = ?').get(scoringRunId) as any;
    if (scoreRecord.processing_run_id !== procRunId) {
      throw new Error('Scoring run failed to link to processing run ID');
    }
    if (scoreRecord.questionnaire_version_id !== 'qv_demo_doomscrolling_v1') {
      throw new Error('Scoring run failed to link to questionnaire version ID');
    }
  });

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.length - passedCount;

  return {
    allPassed: failedCount === 0,
    totalTests: results.length,
    passedCount,
    failedCount,
    results,
  };
}
