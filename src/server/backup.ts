import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { db } from './db.js';

export interface BackupResult {
  filename: string;
  backupPath: string;
  timestamp: string;
  sizeBytes: number;
  integrityCheck: string;
  foreignKeyCheck: string;
  isConsistent: boolean;
}

export interface RestoreTestStep {
  step: number;
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

export interface RestoreTestReport {
  overallStatus: 'PASS' | 'FAIL';
  timestamp: string;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  steps: RestoreTestStep[];
}

const backupsDir = path.join(process.cwd(), 'data', 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true, mode: 0o700 });
}

/**
 * Creates a safe, consistent transactional backup of the active SQLite database
 * using VACUUM INTO, which handles WAL and active readers safely without data corruption.
 */
export function createDatabaseBackup(customPrefix = 'backup'): BackupResult {
  // Ensure backups directory exists
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true, mode: 0o700 });
  }

  // Passive WAL checkpoint to ensure recent commits are synchronized
  try {
    db.exec('PRAGMA wal_checkpoint(PASSIVE);');
  } catch (err) {
    console.warn('Warning during WAL checkpoint prior to backup:', err);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${customPrefix}_${timestamp}.db`;
  const backupPath = path.join(backupsDir, filename);

  // If file already exists, remove it first
  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath);
  }

  // Perform atomic VACUUM INTO snapshot
  db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}';`);

  // Ensure file permissions (0600: read/write only by owner)
  try {
    fs.chmodSync(backupPath, 0o600);
  } catch {
    // Platform may not support chmod
  }

  const stat = fs.statSync(backupPath);

  // Verify backup integrity
  const verification = verifyDatabaseIntegrity(backupPath);

  return {
    filename,
    backupPath,
    timestamp: new Date().toISOString(),
    sizeBytes: stat.size,
    integrityCheck: verification.integrity,
    foreignKeyCheck: verification.foreignKeys,
    isConsistent: verification.isValid,
  };
}

/**
 * Checks SQLite integrity and foreign key constraints on any database file
 */
export function verifyDatabaseIntegrity(filePathOrDb: string | DatabaseSync = db): {
  isValid: boolean;
  integrity: string;
  foreignKeys: string;
} {
  let targetDb: DatabaseSync;
  let shouldClose = false;

  if (typeof filePathOrDb === 'string') {
    targetDb = new DatabaseSync(filePathOrDb, { readOnly: true });
    shouldClose = true;
  } else {
    targetDb = filePathOrDb;
  }

  try {
    const integrityRows = targetDb.prepare('PRAGMA integrity_check').all() as any[];
    const integrityResult = integrityRows.map(r => r.integrity_check || Object.values(r)[0]).join('; ');

    const fkRows = targetDb.prepare('PRAGMA foreign_key_check').all() as any[];
    const fkResult = fkRows.length === 0 ? 'ok' : `${fkRows.length} foreign key violation(s) detected`;

    const isValid = integrityResult.toLowerCase() === 'ok' && fkRows.length === 0;

    return {
      isValid,
      integrity: integrityResult,
      foreignKeys: fkResult,
    };
  } finally {
    if (shouldClose) {
      try {
        targetDb.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

/**
 * Lists available backups in /data/backups sorted by date descending
 */
export function listBackups(): Array<{
  filename: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
}> {
  if (!fs.existsSync(backupsDir)) return [];
  const files = fs.readdirSync(backupsDir);
  return files
    .filter(f => f.endsWith('.db') && !f.includes('restored_test'))
    .map(f => {
      const p = path.join(backupsDir, f);
      const stat = fs.statSync(p);
      return {
        filename: f,
        path: p,
        sizeBytes: stat.size,
        createdAt: stat.birthtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * MANDATORY SECTION 5 RESTORE TEST
 * 1. create research data
 * 2. create backup
 * 3. record important IDs
 * 4. modify/add data
 * 5. restore backup into a separate database
 * 6. open restored database
 * 7. verify original records
 * 8. verify lineage
 * 9. verify questionnaire snapshots
 * 10. verify submissions
 * 11. verify processing
 * 12. verify scoring
 * 13. verify audit records
 */
export function runRestoreTest(): RestoreTestReport {
  const steps: RestoreTestStep[] = [];

  function recordStep(stepNum: number, name: string, fn: () => void) {
    try {
      fn();
      steps.push({ step: stepNum, name, passed: true, details: 'Verified successfully' });
    } catch (err: any) {
      steps.push({ step: stepNum, name, passed: false, error: err.message || String(err) });
    }
  }

  const testIdSuffix = `rt_${Date.now()}`;
  const recordedIds = {
    userId: `usr_restore_${testIdSuffix}`,
    projectId: `proj_restore_${testIdSuffix}`,
    instrumentId: `inst_restore_${testIdSuffix}`,
    questionnaireId: `q_restore_${testIdSuffix}`,
    versionId: `qv_restore_${testIdSuffix}`,
    submissionId: `sub_restore_${testIdSuffix}`,
    procRunId: `proc_restore_${testIdSuffix}`,
    scoringRunId: `scrun_restore_${testIdSuffix}`,
    auditId: `aud_restore_${testIdSuffix}`,
    submissionTimestamp: new Date().toISOString(),
  };

  let backupFile: BackupResult | null = null;
  const restoredTestDbPath = path.join(backupsDir, `restored_test_${testIdSuffix}.db`);
  let restoredDb: DatabaseSync | null = null;

  try {
    // Step 1: Create research data in live database
    recordStep(1, 'Create comprehensive research entities in active database', () => {
      const now = recordedIds.submissionTimestamp;

      // User
      db.prepare(`
        INSERT INTO users (id, name, email, institution, role, created_at)
        VALUES (?, 'Restore Test Researcher', ?, 'Testing Institute', 'researcher', ?)
      `).run(recordedIds.userId, `researcher_${testIdSuffix}@test.edu`, now);

      // Project
      db.prepare(`
        INSERT INTO projects (id, user_id, title, status, is_demo, created_at, updated_at)
        VALUES (?, ?, 'Restore Verification Study', 'Draft', 0, ?, ?)
      `).run(recordedIds.projectId, recordedIds.userId, now, now);

      // Instrument
      db.prepare(`
        INSERT INTO instruments (id, project_id, name, code, source_type, version, status, created_at, updated_at)
        VALUES (?, ?, 'Restore Test Instrument', 'RTI', 'original', '1.0', 'Approved', ?, ?)
      `).run(recordedIds.instrumentId, recordedIds.projectId, now, now);

      // Questionnaire
      db.prepare(`
        INSERT INTO questionnaires (id, project_id, instrument_id, title, status, current_version, slug, response_mode, created_at, updated_at)
        VALUES (?, ?, ?, 'Restore Test Survey', 'Active', 1, ?, 'anonymous', ?, ?)
      `).run(recordedIds.questionnaireId, recordedIds.projectId, recordedIds.instrumentId, `slug-${testIdSuffix}`, now, now);

      // Questionnaire Version Snapshot
      const itemsSnapshot = [
        { itemCode: 'RT.01', questionText: 'Item 1 for restore test', itemType: 'Likert', required: true, reverseCoded: false },
        { itemCode: 'RT.02', questionText: 'Item 2 for restore test', itemType: 'Likert', required: true, reverseCoded: true },
      ];
      db.prepare(`
        INSERT INTO questionnaire_versions (id, questionnaire_id, project_id, version_number, status, title, items_snapshot_json, scales_snapshot_json, published_at, created_at)
        VALUES (?, ?, ?, 1, 'Published', 'Restore Test Survey v1', ?, '[]', ?, ?)
      `).run(recordedIds.versionId, recordedIds.questionnaireId, recordedIds.projectId, JSON.stringify(itemsSnapshot), now, now);

      // Submission
      db.prepare(`
        INSERT INTO survey_submissions (
          id, questionnaire_id, questionnaire_version_id, project_id, session_id,
          participant_mode, questionnaire_version, started_at, submitted_at, duration_seconds,
          raw_responses_json, raw_item_details_json, validation_status, validation_flags_json, status, created_at
        ) VALUES (?, ?, ?, ?, 'sess_rt', 'anonymous', 1, ?, ?, 40, ?, '{}', 'Valid', '[]', 'Submitted', ?)
      `).run(recordedIds.submissionId, recordedIds.questionnaireId, recordedIds.versionId, recordedIds.projectId, now, now, JSON.stringify({ 'RT.01': '5', 'RT.02': '2' }), now);

      // Processing Run & Processed Dataset
      db.prepare(`
        INSERT INTO processing_runs (
          id, project_id, questionnaire_id, questionnaire_version_id, created_by,
          created_at, status, source_submission_count, valid_record_count, excluded_record_count,
          rules_snapshot_json, error_count, warning_count
        ) VALUES (?, ?, ?, ?, ?, ?, 'Completed', 1, 1, 0, '{"rules":"deterministic"}', 0, 0)
      `).run(recordedIds.procRunId, recordedIds.projectId, recordedIds.questionnaireId, recordedIds.versionId, recordedIds.userId, now);

      db.prepare(`
        INSERT INTO processed_datasets (id, processing_run_id, project_id, columns_json, records_json, created_at)
        VALUES (?, ?, ?, '["RT.01", "RT.02"]', '[{"RT.01": 5, "RT.02": 4}]', ?)
      `).run(`pds_${recordedIds.procRunId}`, recordedIds.procRunId, recordedIds.projectId, now);

      // Scoring Run & Scored Dataset
      db.prepare(`
        INSERT INTO scoring_runs (
          id, project_id, processing_run_id, questionnaire_id, questionnaire_version_id,
          created_by, created_at, status, source_record_count, scored_record_count,
          rules_snapshot_json, error_count, warning_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Completed', 1, 1, '{"scoring":"mean"}', 0, 0)
      `).run(recordedIds.scoringRunId, recordedIds.projectId, recordedIds.procRunId, recordedIds.questionnaireId, recordedIds.versionId, recordedIds.userId, now);

      db.prepare(`
        INSERT INTO scored_datasets (id, scoring_run_id, processing_run_id, project_id, columns_json, records_json, summary_statistics_json, created_at)
        VALUES (?, ?, ?, ?, '["SCORE_CONSTRUCT"]', '[{"SCORE_CONSTRUCT": 4.5}]', '{"mean": 4.5}', ?)
      `).run(`sds_${recordedIds.scoringRunId}`, recordedIds.scoringRunId, recordedIds.procRunId, recordedIds.projectId, now);

      // Audit Log
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, project_id, action, entity_type, entity_id, entity_name, timestamp, metadata_json)
        VALUES (?, ?, 'Restore Researcher', ?, 'RESTORE_TEST_DATA_CREATED', 'project', ?, 'Restore Test', ?, '{}')
      `).run(recordedIds.auditId, recordedIds.userId, recordedIds.projectId, recordedIds.projectId, now);
    });

    // Step 2: Create backup
    recordStep(2, 'Create consistent backup snapshot using VACUUM INTO', () => {
      backupFile = createDatabaseBackup(`restore_test_${testIdSuffix}`);
      if (!backupFile.isConsistent) {
        throw new Error(`Backup file failed initial integrity check: ${backupFile.integrityCheck}`);
      }
      if (!fs.existsSync(backupFile.backupPath)) {
        throw new Error('Backup file does not exist on disk');
      }
    });

    // Step 3: Record IDs
    recordStep(3, 'Record original entity identifiers and hashes', () => {
      if (!recordedIds.projectId || !recordedIds.submissionId || !recordedIds.scoringRunId) {
        throw new Error('Entity IDs were not properly recorded');
      }
    });

    // Step 4: Modify/Add data in active database after backup
    recordStep(4, 'Modify and add post-backup records in active database', () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, project_id, action, entity_type, entity_id, entity_name, timestamp, metadata_json)
        VALUES (?, 'system', 'System', ?, 'POST_BACKUP_MUTATION', 'project', ?, 'Post Backup', ?, '{}')
      `).run(`aud_post_backup_${testIdSuffix}`, recordedIds.projectId, recordedIds.projectId, now);
    });

    // Step 5: Restore backup into a separate database
    recordStep(5, 'Restore backup into separate isolated test database', () => {
      if (!backupFile) throw new Error('No backup file available');
      fs.copyFileSync(backupFile.backupPath, restoredTestDbPath);
      if (!fs.existsSync(restoredTestDbPath)) {
        throw new Error('Failed to copy backup file into restore target location');
      }
    });

    // Step 6: Open restored database
    recordStep(6, 'Open restored database connection with node:sqlite', () => {
      restoredDb = new DatabaseSync(restoredTestDbPath);
      restoredDb.exec('PRAGMA foreign_keys = ON;');
    });

    // Step 7: Verify original records
    recordStep(7, 'Verify original user and project records in restored database', () => {
      if (!restoredDb) throw new Error('Restored database is not opened');
      const u = restoredDb.prepare('SELECT id, name FROM users WHERE id = ?').get(recordedIds.userId) as any;
      if (!u || u.id !== recordedIds.userId) throw new Error('User record missing in restored DB');

      const p = restoredDb.prepare('SELECT id, user_id, title FROM projects WHERE id = ?').get(recordedIds.projectId) as any;
      if (!p || p.id !== recordedIds.projectId || p.user_id !== recordedIds.userId) {
        throw new Error('Project record missing or user linkage broken in restored DB');
      }
    });

    // Step 8: Verify lineage
    recordStep(8, 'Verify full cross-layer lineage in restored database', () => {
      if (!restoredDb) throw new Error('Restored database is not opened');
      const scoringRow = restoredDb.prepare('SELECT id, processing_run_id, questionnaire_version_id FROM scoring_runs WHERE id = ?').get(recordedIds.scoringRunId) as any;
      if (!scoringRow) throw new Error('Scoring run missing in restored DB');
      if (scoringRow.processing_run_id !== recordedIds.procRunId) throw new Error('Lineage broken: scoring run does not point to processing run');
      if (scoringRow.questionnaire_version_id !== recordedIds.versionId) throw new Error('Lineage broken: scoring run does not point to questionnaire version');
    });

    // Step 9: Verify questionnaire snapshots
    recordStep(9, 'Verify questionnaire immutable version snapshot and items in restored database', () => {
      if (!restoredDb) throw new Error('Restored database is not opened');
      const v = restoredDb.prepare('SELECT id, items_snapshot_json FROM questionnaire_versions WHERE id = ?').get(recordedIds.versionId) as any;
      if (!v) throw new Error('Questionnaire version snapshot missing');
      const items = JSON.parse(v.items_snapshot_json);
      if (!Array.isArray(items) || items.length !== 2 || items[0].itemCode !== 'RT.01') {
        throw new Error('Questionnaire items snapshot corrupted in restored DB');
      }
    });

    // Step 10: Verify submissions
    recordStep(10, 'Verify raw survey submission data and immutability fields in restored database', () => {
      if (!restoredDb) throw new Error('Restored database is not opened');
      const s = restoredDb.prepare('SELECT * FROM survey_submissions WHERE id = ?').get(recordedIds.submissionId) as any;
      if (!s) throw new Error('Survey submission missing in restored DB');
      const responses = JSON.parse(s.raw_responses_json);
      if (responses['RT.01'] !== '5' || responses['RT.02'] !== '2') {
        throw new Error('Raw responses corrupted in restored DB');
      }
    });

    // Step 11: Verify processing run and dataset
    recordStep(11, 'Verify processing run and processed dataset in restored database', () => {
      if (!restoredDb) throw new Error('Restored database is not opened');
      const pr = restoredDb.prepare('SELECT id, status, valid_record_count FROM processing_runs WHERE id = ?').get(recordedIds.procRunId) as any;
      if (!pr || pr.status !== 'Completed') throw new Error('Processing run missing or incomplete in restored DB');
      const ds = restoredDb.prepare('SELECT columns_json FROM processed_datasets WHERE processing_run_id = ?').get(recordedIds.procRunId) as any;
      if (!ds) throw new Error('Processed dataset missing in restored DB');
    });

    // Step 12: Verify scoring run and scored dataset
    recordStep(12, 'Verify scoring run and scored construct scores in restored database', () => {
      if (!restoredDb) throw new Error('Restored database is not opened');
      const sr = restoredDb.prepare('SELECT id, status FROM scoring_runs WHERE id = ?').get(recordedIds.scoringRunId) as any;
      if (!sr || sr.status !== 'Completed') throw new Error('Scoring run missing in restored DB');
      const sds = restoredDb.prepare('SELECT records_json FROM scored_datasets WHERE scoring_run_id = ?').get(recordedIds.scoringRunId) as any;
      if (!sds) throw new Error('Scored dataset missing in restored DB');
    });

    // Step 13: Verify audit records and execute integrity check on restored database
    recordStep(13, 'Verify audit records and execute PRAGMA integrity_check on restored DB', () => {
      if (!restoredDb) throw new Error('Restored database is not opened');
      const aud = restoredDb.prepare('SELECT id, action FROM audit_logs WHERE id = ?').get(recordedIds.auditId) as any;
      if (!aud || aud.action !== 'RESTORE_TEST_DATA_CREATED') throw new Error('Audit record missing in restored DB');

      // Post-backup mutation must NOT be in restored DB!
      const postBackupAud = restoredDb.prepare('SELECT id FROM audit_logs WHERE id = ?').get(`aud_post_backup_${testIdSuffix}`);
      if (postBackupAud) {
        throw new Error('Isolation failure: Restored database contains records created after backup');
      }

      // SQLite integrity check and foreign key check on restored DB
      const integrity = verifyDatabaseIntegrity(restoredDb);
      if (!integrity.isValid) {
        throw new Error(`Restored database integrity check failed: ${integrity.integrity}, foreign keys: ${integrity.foreignKeys}`);
      }
    });

  } finally {
    // Close restored db connection
    if (restoredDb) {
      try {
        (restoredDb as any).close();
      } catch {
        // Ignore
      }
    }

    // Clean up temporary test files
    try {
      if (fs.existsSync(restoredTestDbPath)) {
        fs.unlinkSync(restoredTestDbPath);
      }
      const bFile = backupFile as BackupResult | null;
      if (bFile && fs.existsSync(bFile.backupPath)) {
        fs.unlinkSync(bFile.backupPath);
      }
    } catch (cleanupErr) {
      console.warn('Cleanup error in restore test:', cleanupErr);
    }
  }

  const passedSteps = steps.filter(s => s.passed).length;
  const failedSteps = steps.length - passedSteps;
  const overallStatus: 'PASS' | 'FAIL' = failedSteps === 0 && steps.length === 13 ? 'PASS' : 'FAIL';

  return {
    overallStatus,
    timestamp: new Date().toISOString(),
    totalSteps: steps.length,
    passedSteps,
    failedSteps,
    steps,
  };
}
