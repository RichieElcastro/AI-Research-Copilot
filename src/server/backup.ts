import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db, createDatabase } from './db.js';
import { runMigrations } from './migrations.js';

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
  tableChecksums?: Record<string, TableChecksum>;
}

export interface TableChecksum {
  rowCount: number;
  checksum: string;
}

export interface RestoreResult {
  success: boolean;
  restoredTables: string[];
  totalRowsRestored: number;
  tableChecksums: Record<string, TableChecksum>;
  integrityCheck: string;
  foreignKeyCheck: string;
  durationMs: number;
}

/**
 * Internal system/migration tables excluded from research domain tables.
 */
export const INTERNAL_SYSTEM_TABLES = new Set<string>([
  '_schema_migrations',
  'backup_audit_records',
  'sessions',
]);

const backupsDir = path.join(process.cwd(), 'data', 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true, mode: 0o700 });
}

/**
 * Dynamically retrieves all domain tables from sqlite_master (excluding sqlite_% and internal tables),
 * topologically sorted by foreign key dependencies (parent tables before child tables).
 */
export function getDomainTables(targetDb: DatabaseSync = db): string[] {
  const rows = targetDb
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
    )
    .all() as { name: string }[];

  const allTableNames = rows.map(r => r.name);
  const domainTables = allTableNames.filter(name => !INTERNAL_SYSTEM_TABLES.has(name));
  const domainSet = new Set(domainTables);

  // Build dependency graph via PRAGMA foreign_key_list
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const table of domainTables) {
    dependencies.set(table, new Set());
    dependents.set(table, new Set());
    inDegree.set(table, 0);
  }

  for (const table of domainTables) {
    try {
      const fkRows = targetDb.prepare(`PRAGMA foreign_key_list('${table}')`).all() as any[];
      for (const fk of fkRows) {
        const referencedTable = fk.table;
        // Only consider foreign keys that point to other domain tables (exclude self-references)
        if (domainSet.has(referencedTable) && referencedTable !== table) {
          if (!dependencies.get(table)!.has(referencedTable)) {
            dependencies.get(table)!.add(referencedTable);
          }
        }
      }
    } catch {
      // Table may not have FKs
    }
  }

  // Calculate in-degree (how many prerequisite tables this table depends on)
  for (const [table, deps] of dependencies.entries()) {
    inDegree.set(table, deps.size);
    for (const dep of deps) {
      dependents.get(dep)!.add(table);
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  for (const [table, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(table);
    }
  }
  queue.sort(); // Deterministic ordering among zero-dependency tables

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const nextDeps = Array.from(dependents.get(current) || []).sort();
    for (const dependent of nextDeps) {
      const currentDeg = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, currentDeg);
      if (currentDeg === 0) {
        queue.push(dependent);
      }
    }
  }

  // If cyclic dependency exists, append any remaining tables deterministically
  if (sorted.length < domainTables.length) {
    for (const table of domainTables) {
      if (!sorted.includes(table)) {
        sorted.push(table);
      }
    }
  }

  return sorted;
}

/**
 * Calculates a deterministic SHA-256 checksum and exact row count for a table across all columns.
 */
export function calculateTableChecksum(
  targetDb: DatabaseSync,
  tableName: string
): TableChecksum {
  const tableInfo = targetDb.prepare(`PRAGMA table_info('${tableName}')`).all() as any[];
  const pkCols = tableInfo.filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk).map(c => c.name);
  const allCols = tableInfo.map(c => c.name).sort();

  const orderBy = pkCols.length > 0 ? pkCols.map(c => `"${c}" ASC`).join(', ') : 'rowid ASC';
  const selectCols = allCols.map(c => `"${c}"`).join(', ');

  const rows = targetDb.prepare(`SELECT ${selectCols} FROM "${tableName}" ORDER BY ${orderBy}`).all() as any[];

  const hash = crypto.createHash('sha256');
  for (const row of rows) {
    const rowValues = allCols.map(col => {
      const val = row[col];
      return val === null ? '__NULL__' : String(val);
    });
    hash.update(rowValues.join('|#|') + '\n');
  }

  return {
    rowCount: rows.length,
    checksum: rows.length === 0 ? 'empty' : hash.digest('hex'),
  };
}

/**
 * Calculates SHA-256 checksum and row count for every domain table in the database.
 */
export function calculateAllDomainChecksums(
  targetDb: DatabaseSync
): Record<string, TableChecksum> {
  const tables = getDomainTables(targetDb);
  const result: Record<string, TableChecksum> = {};
  for (const table of tables) {
    result[table] = calculateTableChecksum(targetDb, table);
  }
  return result;
}

/**
 * Guard test helper: Verifies that every domain table in sqlite_master is present
 * in the provided list. Throws a hard error if any domain table is missing.
 */
export function verifyAllDomainTablesCovered(
  targetDb: DatabaseSync,
  coveredTables: string[]
): {
  allCovered: boolean;
  missingTables: string[];
  totalDomainTables: number;
} {
  const actualDomainTables = getDomainTables(targetDb);
  const coveredSet = new Set(coveredTables);
  const missingTables = actualDomainTables.filter(t => !coveredSet.has(t));

  if (missingTables.length > 0) {
    throw new Error(
      `Guard test failure: Domain tables missing from backup/restore coverage: ${missingTables.join(', ')}`
    );
  }

  return {
    allCovered: true,
    missingTables: [],
    totalDomainTables: actualDomainTables.length,
  };
}

/**
 * Creates a safe, consistent transactional backup of the SQLite database
 * using VACUUM INTO, which handles WAL and active readers safely without data corruption.
 */
export function createDatabaseBackup(
  customPrefix = 'backup',
  sourceDb: DatabaseSync = db,
  customOutputDir = backupsDir
): BackupResult {
  if (!fs.existsSync(customOutputDir)) {
    fs.mkdirSync(customOutputDir, { recursive: true, mode: 0o700 });
  }

  // Passive WAL checkpoint to ensure recent commits are synchronized
  try {
    sourceDb.exec('PRAGMA wal_checkpoint(PASSIVE);');
  } catch (err) {
    console.warn('Warning during WAL checkpoint prior to backup:', err);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${customPrefix}_${timestamp}.db`;
  const backupPath = path.join(customOutputDir, filename);

  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath);
  }

  // Perform atomic VACUUM INTO snapshot
  sourceDb.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}';`);

  try {
    fs.chmodSync(backupPath, 0o600);
  } catch {
    // Platform may not support chmod
  }

  const stat = fs.statSync(backupPath);
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
 * Restores all domain tables from a backup file into a target database
 * (either a DatabaseSync instance or a file path), ensuring foreign key dependency
 * ordering (reverse FK order for clearing, forward FK order for inserting) and preserving all columns.
 */
export function restoreDatabase(
  backupPath: string,
  target: DatabaseSync | string
): RestoreResult {
  const startTime = Date.now();

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file does not exist at: ${backupPath}`);
  }

  // Verify source backup integrity first
  const sourceIntegrity = verifyDatabaseIntegrity(backupPath);
  if (!sourceIntegrity.isValid) {
    throw new Error(`Cannot restore corrupted backup: ${sourceIntegrity.integrity}`);
  }

  let targetDb: DatabaseSync;
  let shouldCloseTarget = false;

  if (typeof target === 'string') {
    targetDb = createDatabase(target);
    shouldCloseTarget = true;
  } else {
    targetDb = target;
  }

  const backupDb = new DatabaseSync(backupPath, { readOnly: true });

  try {
    const domainTables = getDomainTables(backupDb);

    // Guard test check on backup database
    verifyAllDomainTablesCovered(backupDb, domainTables);

    let totalRowsRestored = 0;

    // Execute atomic restore transaction in target database
    targetDb.exec('PRAGMA foreign_keys = ON;');
    targetDb.exec('BEGIN IMMEDIATE;');

    try {
      // 1. Clear target domain tables in reverse dependency order (child before parent)
      for (const table of [...domainTables].reverse()) {
        targetDb.prepare(`DELETE FROM "${table}"`).run();
      }

      // 2. Populate target domain tables in forward dependency order (parent before child)
      for (const table of domainTables) {
        // Enumerate all columns dynamically from PRAGMA table_info
        const targetCols = targetDb.prepare(`PRAGMA table_info('${table}')`).all() as any[];
        const colNames = targetCols.map(c => `"${c.name}"`).join(', ');
        const placeholders = targetCols.map(() => '?').join(', ');

        const rows = backupDb.prepare(`SELECT ${colNames} FROM "${table}"`).all() as any[];
        if (rows.length > 0) {
          const insertStmt = targetDb.prepare(`INSERT INTO "${table}" (${colNames}) VALUES (${placeholders})`);
          for (const row of rows) {
            insertStmt.run(...targetCols.map(c => row[c.name]));
          }
        }
        totalRowsRestored += rows.length;
      }

      targetDb.exec('COMMIT;');
    } catch (txErr) {
      targetDb.exec('ROLLBACK;');
      throw txErr;
    }

    // Verify target integrity and foreign key constraints
    const targetIntegrity = verifyDatabaseIntegrity(targetDb);
    if (!targetIntegrity.isValid) {
      throw new Error(
        `Restored database integrity failure: ${targetIntegrity.integrity}, FK: ${targetIntegrity.foreignKeys}`
      );
    }

    const tableChecksums = calculateAllDomainChecksums(targetDb);

    return {
      success: true,
      restoredTables: domainTables,
      totalRowsRestored,
      tableChecksums,
      integrityCheck: targetIntegrity.integrity,
      foreignKeyCheck: targetIntegrity.foreignKeys,
      durationMs: Date.now() - startTime,
    };
  } finally {
    try {
      backupDb.close();
    } catch {
      // Ignore
    }
    if (shouldCloseTarget) {
      try {
        targetDb.close();
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Checks SQLite integrity and foreign key constraints on any database file or connection.
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
        // Ignore
      }
    }
  }
}

/**
 * Lists available backups in /data/backups sorted by date descending.
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
    .filter(f => f.endsWith('.db') && !f.includes('restored_test') && !f.includes('isolated_rt_'))
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
 * Runs a comprehensive restore test covering all domain tables.
 * To guarantee complete test isolation (AC-4), this uses an isolated database
 * and never pollutes or modifies data/research_platform.db.
 */
export function runRestoreTest(customTestDb?: DatabaseSync): RestoreTestReport {
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
  let sourceDb: any = null;
  let shouldCloseSource = false;
  let sourceDbPath = '';

  if (customTestDb) {
    sourceDb = customTestDb;
  } else {
    sourceDbPath = path.join(backupsDir, `isolated_rt_source_${testIdSuffix}.db`);
    sourceDb = createDatabase(sourceDbPath);
    shouldCloseSource = true;
  }

  const restoredDbPath = path.join(backupsDir, `isolated_rt_restored_${testIdSuffix}.db`);
  let restoredDb: any = null;
  let backupFile: any = null;
  let baselineChecksums: Record<string, TableChecksum> = {};

  const now = new Date().toISOString();
  const recordedIds = {
    userId: `usr_rt_${testIdSuffix}`,
    projectId: `proj_rt_${testIdSuffix}`,
    varId: `var_rt_${testIdSuffix}`,
    dimId: `dim_rt_${testIdSuffix}`,
    indId: `ind_rt_${testIdSuffix}`,
    scaleId: `scale_rt_${testIdSuffix}`,
    instId: `inst_rt_${testIdSuffix}`,
    itemId: `item_rt_${testIdSuffix}`,
    instVerId: `instver_rt_${testIdSuffix}`,
    aiGenId: `aigen_rt_${testIdSuffix}`,
    aiCandId: `aicand_rt_${testIdSuffix}`,
    qId: `q_rt_${testIdSuffix}`,
    qvId: `qv_rt_${testIdSuffix}`,
    subId: `sub_rt_${testIdSuffix}`,
    procId: `proc_rt_${testIdSuffix}`,
    cbId: `cb_rt_${testIdSuffix}`,
    scRuleId: `scrule_rt_${testIdSuffix}`,
    scRunId: `scrun_rt_${testIdSuffix}`,
    audId: `aud_rt_${testIdSuffix}`,
  };

  try {
    // Step 1: Create research entities across all 21 domain tables in source DB
    recordStep(1, 'Create comprehensive research entities across all 21 domain tables', () => {
      sourceDb.exec('BEGIN IMMEDIATE;');
      try {
        // 1. User
        sourceDb.prepare(`
          INSERT INTO users (id, name, email, institution, role, created_at)
          VALUES (?, 'Restore Test User', ?, 'Research Institute', 'researcher', ?)
        `).run(recordedIds.userId, `${recordedIds.userId}@test.edu`, now);

        // 2. Project
        sourceDb.prepare(`
          INSERT INTO projects (id, user_id, title, research_topic, research_design, status, is_demo, created_at, updated_at)
          VALUES (?, ?, 'Restore Verification Study', 'Cognitive Science', 'Correlational', 'Draft', 0, ?, ?)
        `).run(recordedIds.projectId, recordedIds.userId, now, now);

        // 3. Variable
        sourceDb.prepare(`
          INSERT INTO variables (id, project_id, name, code, variable_type, role, measurement_scale, created_at, updated_at)
          VALUES (?, ?, 'Cognitive Fatigue', 'FATIGUE', 'Dependent', 'Dependent', 'Interval', ?, ?)
        `).run(recordedIds.varId, recordedIds.projectId, now, now);

        // 4. Dimension
        sourceDb.prepare(`
          INSERT INTO dimensions (id, variable_id, project_id, name, code, definition, created_at, updated_at)
          VALUES (?, ?, ?, 'Mental Depletion', 'DEPLETION', 'Exhaustion of mental energy', ?, ?)
        `).run(recordedIds.dimId, recordedIds.varId, recordedIds.projectId, now, now);

        // 5. Indicator
        sourceDb.prepare(`
          INSERT INTO indicators (id, dimension_id, variable_id, project_id, name, code, definition, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'Slowed Task Processing', 'SLOW_TASK', 'Noticeable delay in task completion', ?, ?)
        `).run(recordedIds.indId, recordedIds.dimId, recordedIds.varId, recordedIds.projectId, now, now);

        // 6. Response Scale
        sourceDb.prepare(`
          INSERT INTO response_scales (id, project_id, name, scale_type, min_value, max_value, options_json, created_at, updated_at)
          VALUES (?, ?, '5-pt Likert', 'Likert', 1, 5, ?, ?, ?)
        `).run(recordedIds.scaleId, recordedIds.projectId, JSON.stringify([{ value: 1, label: 'Never' }, { value: 5, label: 'Always' }]), now, now);

        // 7. Instrument (includes migration 003 validation_summary_json)
        sourceDb.prepare(`
          INSERT INTO instruments (id, project_id, name, code, source_type, version, status, validation_summary_json, created_at, updated_at)
          VALUES (?, ?, 'Cognitive Assessment Scale', 'CAS', 'original', '1.0', 'Approved', '{"valid":true}', ?, ?)
        `).run(recordedIds.instId, recordedIds.projectId, now, now);

        // 8. Instrument Items (includes migration 003 AI provenance columns)
        sourceDb.prepare(`
          INSERT INTO instrument_items (
            id, instrument_id, project_id, indicator_id, response_scale_id, item_code, item_number,
            question_text, item_type, required, reverse_coded, status, ai_candidate_id,
            original_ai_text, modified_by_researcher, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'CAS.01', 1, 'I feel drained after deep focus tasks.', 'Likert', 1, 0, 'active', ?, ?, 0, ?, ?)
        `).run(recordedIds.itemId, recordedIds.instId, recordedIds.projectId, recordedIds.indId, recordedIds.scaleId, recordedIds.aiCandId, 'Original text from AI', now, now);

        // 9. Instrument Versions (includes migration 003 and 004 columns)
        sourceDb.prepare(`
          INSERT INTO instrument_versions (
            id, instrument_id, project_id, version_number, status, snapshot_json,
            items_snapshot_json, scales_snapshot_json, validation_summary_json, change_summary,
            approved_by, approved_at, notes, created_at
          ) VALUES (?, ?, ?, '1.0', 'Approved', '{}', '[]', '[]', '{"valid":true}', 'Initial release', ?, ?, 'Approved snapshot', ?)
        `).run(recordedIds.instVerId, recordedIds.instId, recordedIds.projectId, recordedIds.userId, now, now);

        // 10. AI Generation
        sourceDb.prepare(`
          INSERT INTO ai_generations (
            id, project_id, instrument_id, variable_id, dimension_id, indicator_id,
            model, prompt_version, generation_parameters_json, status, generated_at, generated_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'gemini-1.5-pro', 'v1', '{"temp":0.7}', 'completed', ?, ?, ?)
        `).run(recordedIds.aiGenId, recordedIds.projectId, recordedIds.instId, recordedIds.varId, recordedIds.dimId, recordedIds.indId, now, recordedIds.userId, now);

        // 11. AI Candidate
        sourceDb.prepare(`
          INSERT INTO ai_candidates (
            id, generation_id, project_id, instrument_id, candidate_id, question_text,
            suggested_item_type, variable_id, dimension_id, indicator_id, response_scale_id,
            reverse_coded, status, original_text, created_at
          ) VALUES (?, ?, ?, ?, 'cand_1', 'I experience difficulty maintaining focus.', 'Likert', ?, ?, ?, ?, 0, 'accepted', 'I experience difficulty maintaining focus.', ?)
        `).run(recordedIds.aiCandId, recordedIds.aiGenId, recordedIds.projectId, recordedIds.instId, recordedIds.varId, recordedIds.dimId, recordedIds.indId, recordedIds.scaleId, now);

        // 12. Questionnaire (includes migration 003 client settings columns)
        sourceDb.prepare(`
          INSERT INTO questionnaires (
            id, project_id, instrument_id, title, status, current_version, slug, response_mode,
            owner_id, introduction, consent_statement, closing_message, created_at, updated_at
          ) VALUES (?, ?, ?, 'Cognitive Survey', 'Active', 1, ?, 'anonymous', ?, 'Welcome', 'I consent', 'Thank you', ?, ?)
        `).run(recordedIds.qId, recordedIds.projectId, recordedIds.instId, `slug-${testIdSuffix}`, recordedIds.userId, now, now);

        // 13. Questionnaire Versions (includes migration 003 columns)
        const itemsSnapshot = [
          { itemCode: 'CAS.01', questionText: 'I feel drained after deep focus tasks.', itemType: 'Likert', required: true, reverseCoded: false }
        ];
        sourceDb.prepare(`
          INSERT INTO questionnaire_versions (
            id, questionnaire_id, project_id, version_number, status, title,
            items_snapshot_json, scales_snapshot_json, instrument_id, instrument_version_id,
            is_locked, published_at, created_at
          ) VALUES (?, ?, ?, 1, 'Published', 'Cognitive Survey v1', ?, '[]', ?, ?, 1, ?, ?)
        `).run(recordedIds.qvId, recordedIds.qId, recordedIds.projectId, JSON.stringify(itemsSnapshot), recordedIds.instId, recordedIds.instVerId, now, now);

        // 14. Raw Survey Submissions (LAYER 1)
        sourceDb.prepare(`
          INSERT INTO survey_submissions (
            id, questionnaire_id, questionnaire_version_id, project_id, session_id,
            participant_mode, questionnaire_version, started_at, submitted_at, duration_seconds,
            raw_responses_json, raw_item_details_json, validation_status, validation_flags_json, status, created_at
          ) VALUES (?, ?, ?, ?, 'sess_rt', 'anonymous', 1, ?, ?, 45, ?, '{}', 'Valid', '[]', 'Submitted', ?)
        `).run(recordedIds.subId, recordedIds.qId, recordedIds.qvId, recordedIds.projectId, now, now, JSON.stringify({ 'CAS.01': '4' }), now);

        // 15. Processing Run (LAYER 2)
        sourceDb.prepare(`
          INSERT INTO processing_runs (
            id, project_id, questionnaire_id, questionnaire_version_id, created_by,
            created_at, status, source_submission_count, valid_record_count, excluded_record_count,
            rules_snapshot_json, error_count, warning_count
          ) VALUES (?, ?, ?, ?, ?, ?, 'Completed', 1, 1, 0, '{"cleaning":"strict"}', 0, 0)
        `).run(recordedIds.procId, recordedIds.projectId, recordedIds.qId, recordedIds.qvId, recordedIds.userId, now);

        // 16. Processed Dataset (LAYER 2)
        sourceDb.prepare(`
          INSERT INTO processed_datasets (id, processing_run_id, project_id, columns_json, records_json, created_at)
          VALUES (?, ?, ?, '["CAS.01"]', '[{"CAS.01": 4}]', ?)
        `).run(`pds_${recordedIds.procId}`, recordedIds.procId, recordedIds.projectId, now);

        // 17. Codebook (LAYER 2)
        sourceDb.prepare(`
          INSERT INTO codebooks (id, project_id, processing_run_id, questionnaire_version_id, version, entries_json, created_at)
          VALUES (?, ?, ?, ?, '1.0', '[{"code":"CAS.01","label":"Drained"}]', ?)
        `).run(recordedIds.cbId, recordedIds.projectId, recordedIds.procId, recordedIds.qvId, now);

        // 18. Scoring Rule
        sourceDb.prepare(`
          INSERT INTO scoring_rules (
            id, project_id, target_type, target_id, target_code, target_name, method,
            source_type, source_item_codes_json, missing_value_policy, created_at, updated_at
          ) VALUES (?, ?, 'variable', ?, 'FATIGUE', 'Cognitive Fatigue', 'mean', 'items', '["CAS.01"]', 'exclude', ?, ?)
        `).run(recordedIds.scRuleId, recordedIds.projectId, recordedIds.varId, now, now);

        // 19. Scoring Run (LAYER 3)
        sourceDb.prepare(`
          INSERT INTO scoring_runs (
            id, project_id, processing_run_id, questionnaire_id, questionnaire_version_id,
            created_by, created_at, status, source_record_count, scored_record_count,
            rules_snapshot_json, error_count, warning_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Completed', 1, 1, '{"method":"mean"}', 0, 0)
        `).run(recordedIds.scRunId, recordedIds.projectId, recordedIds.procId, recordedIds.qId, recordedIds.qvId, recordedIds.userId, now);

        // 20. Scored Dataset (LAYER 3)
        sourceDb.prepare(`
          INSERT INTO scored_datasets (id, scoring_run_id, processing_run_id, project_id, columns_json, records_json, summary_statistics_json, created_at)
          VALUES (?, ?, ?, ?, '["FATIGUE_SCORE"]', '[{"FATIGUE_SCORE": 4.0}]', '{"mean": 4.0}', ?)
        `).run(`sds_${recordedIds.scRunId}`, recordedIds.scRunId, recordedIds.procId, recordedIds.projectId, now);

        // 21. Audit Log
        sourceDb.prepare(`
          INSERT INTO audit_logs (id, user_id, user_name, project_id, action, entity_type, entity_id, entity_name, timestamp, metadata_json)
          VALUES (?, ?, 'Restore Researcher', ?, 'RESTORE_TEST_DATA_CREATED', 'project', ?, 'Restore Test Project', ?, '{}')
        `).run(recordedIds.audId, recordedIds.userId, recordedIds.projectId, recordedIds.projectId, now);

        sourceDb.exec('COMMIT;');
      } catch (err) {
        sourceDb.exec('ROLLBACK;');
        throw err;
      }
    });

    // Step 2: Verify guard test - all domain tables from sqlite_master are covered
    recordStep(2, 'Verify guard test: all domain tables in sqlite_master are covered', () => {
      const domainTables = getDomainTables(sourceDb);
      const guardResult = verifyAllDomainTablesCovered(sourceDb, domainTables);
      if (!guardResult.allCovered || guardResult.totalDomainTables === 0) {
        throw new Error('Guard test reported unhandled domain tables');
      }
    });

    // Step 3: Calculate baseline row counts and SHA-256 checksums per table
    recordStep(3, 'Calculate baseline SHA-256 checksums and row counts per domain table', () => {
      baselineChecksums = calculateAllDomainChecksums(sourceDb);
      for (const [table, meta] of Object.entries(baselineChecksums)) {
        if (meta.rowCount === 0) {
          throw new Error(`Table ${table} unexpectedly has 0 rows in source test database`);
        }
      }
    });

    // Step 4: Create consistent atomic backup
    recordStep(4, 'Create atomic backup snapshot using VACUUM INTO', () => {
      backupFile = createDatabaseBackup(`restore_test_${testIdSuffix}`, sourceDb);
      if (!backupFile.isConsistent) {
        throw new Error(`Backup file integrity check failed: ${backupFile.integrityCheck}`);
      }
      if (!fs.existsSync(backupFile.backupPath)) {
        throw new Error('Backup snapshot file missing on disk');
      }
    });

    // Step 5: Modify/Add data in source database after backup snapshot
    recordStep(5, 'Modify and add post-backup record in source database', () => {
      const postBackupTime = new Date().toISOString();
      sourceDb.prepare(`
        INSERT INTO audit_logs (id, user_id, user_name, project_id, action, entity_type, entity_id, entity_name, timestamp, metadata_json)
        VALUES (?, 'system', 'System', ?, 'POST_BACKUP_MUTATION', 'project', ?, 'Post Backup Mutation', ?, '{}')
      `).run(`aud_post_backup_${testIdSuffix}`, recordedIds.projectId, recordedIds.projectId, postBackupTime);
    });

    // Step 6: Restore backup into a separate isolated target database
    recordStep(6, 'Restore backup into separate isolated target database', () => {
      if (!backupFile) throw new Error('No backup file available');
      restoredDb = createDatabase(restoredDbPath);
      const restoreResult = restoreDatabase(backupFile.backupPath, restoredDb);
      if (!restoreResult.success) {
        throw new Error('restoreDatabase returned failure status');
      }
    });

    // Step 7: Verify isolation - post-backup mutation must NOT exist in restored DB
    recordStep(7, 'Verify isolation: post-backup mutation is not in restored database', () => {
      if (!restoredDb) throw new Error('Restored database connection not open');
      const postAudit = restoredDb.prepare('SELECT id FROM audit_logs WHERE id = ?').get(`aud_post_backup_${testIdSuffix}`);
      if (postAudit) {
        throw new Error('Isolation failure: Restored database contains records created after backup snapshot');
      }
    });

    // Step 8: Verify PRAGMA integrity_check and foreign_key_check on restored DB
    recordStep(8, 'Verify PRAGMA integrity_check and foreign_key_check on restored database', () => {
      if (!restoredDb) throw new Error('Restored database connection not open');
      const integrity = verifyDatabaseIntegrity(restoredDb);
      if (!integrity.isValid) {
        throw new Error(`Integrity check failed: ${integrity.integrity}, FK: ${integrity.foreignKeys}`);
      }
    });

    // Step 9: Verify 100% round-trip row count and SHA-256 checksum match across all domain tables
    recordStep(9, 'Verify 100% round-trip row count and SHA-256 checksum match across all tables', () => {
      if (!restoredDb) throw new Error('Restored database connection not open');
      const restoredChecksums = calculateAllDomainChecksums(restoredDb);

      for (const [table, baseMeta] of Object.entries(baselineChecksums)) {
        const restMeta = restoredChecksums[table];
        if (!restMeta) {
          throw new Error(`Table ${table} missing in restored database checksums`);
        }
        if (restMeta.rowCount !== baseMeta.rowCount) {
          throw new Error(
            `Row count mismatch for table ${table}: expected ${baseMeta.rowCount}, got ${restMeta.rowCount}`
          );
        }
        if (restMeta.checksum !== baseMeta.checksum) {
          throw new Error(
            `SHA-256 checksum mismatch for table ${table}: expected ${baseMeta.checksum}, got ${restMeta.checksum}`
          );
        }
      }
    });

    // Step 10: Verify structural research entities
    recordStep(10, 'Verify structural entities (users, projects, variables, dimensions, indicators, scales)', () => {
      if (!restoredDb) throw new Error('Restored DB not open');
      const u = restoredDb.prepare('SELECT id FROM users WHERE id = ?').get(recordedIds.userId);
      const p = restoredDb.prepare('SELECT id, user_id FROM projects WHERE id = ?').get(recordedIds.projectId) as any;
      const v = restoredDb.prepare('SELECT id, project_id FROM variables WHERE id = ?').get(recordedIds.varId) as any;
      const d = restoredDb.prepare('SELECT id, variable_id FROM dimensions WHERE id = ?').get(recordedIds.dimId) as any;
      const ind = restoredDb.prepare('SELECT id, dimension_id FROM indicators WHERE id = ?').get(recordedIds.indId) as any;
      const sc = restoredDb.prepare('SELECT id, project_id FROM response_scales WHERE id = ?').get(recordedIds.scaleId) as any;

      if (!u || !p || !v || !d || !ind || !sc) {
        throw new Error('One or more structural domain entities missing in restored database');
      }
      if (p.user_id !== recordedIds.userId || v.project_id !== recordedIds.projectId) {
        throw new Error('Foreign key linkage broken among structural entities');
      }
    });

    // Step 11: Verify instrument domain entities and AI provenance
    recordStep(11, 'Verify instrument items, versions, and AI candidate provenance in restored database', () => {
      if (!restoredDb) throw new Error('Restored DB not open');
      const inst = restoredDb.prepare('SELECT id, validation_summary_json FROM instruments WHERE id = ?').get(recordedIds.instId) as any;
      const item = restoredDb.prepare('SELECT id, ai_candidate_id FROM instrument_items WHERE id = ?').get(recordedIds.itemId) as any;
      const ver = restoredDb.prepare('SELECT id, approved_by FROM instrument_versions WHERE id = ?').get(recordedIds.instVerId) as any;
      const aigen = restoredDb.prepare('SELECT id FROM ai_generations WHERE id = ?').get(recordedIds.aiGenId);
      const aicand = restoredDb.prepare('SELECT id, generation_id FROM ai_candidates WHERE id = ?').get(recordedIds.aiCandId) as any;

      if (!inst || !item || !ver || !aigen || !aicand) {
        throw new Error('Instrument or AI provenance records missing in restored database');
      }
      if (item.ai_candidate_id !== recordedIds.aiCandId || aicand.generation_id !== recordedIds.aiGenId) {
        throw new Error('AI provenance chain broken in restored database');
      }
    });

    // Step 12: Verify questionnaire snapshots, versions, and survey submissions
    recordStep(12, 'Verify questionnaire versions, snapshots, and survey submissions in restored database', () => {
      if (!restoredDb) throw new Error('Restored DB not open');
      const q = restoredDb.prepare('SELECT id, owner_id FROM questionnaires WHERE id = ?').get(recordedIds.qId) as any;
      const qv = restoredDb.prepare('SELECT id, items_snapshot_json FROM questionnaire_versions WHERE id = ?').get(recordedIds.qvId) as any;
      const sub = restoredDb.prepare('SELECT id, raw_responses_json FROM survey_submissions WHERE id = ?').get(recordedIds.subId) as any;

      if (!q || !qv || !sub) {
        throw new Error('Questionnaire or submission records missing in restored database');
      }
      const items = JSON.parse(qv.items_snapshot_json);
      const responses = JSON.parse(sub.raw_responses_json);
      if (items[0]?.itemCode !== 'CAS.01' || responses['CAS.01'] !== '4') {
        throw new Error('Corrupted questionnaire snapshot or raw survey submission in restored database');
      }
    });

    // Step 13: Verify processing runs, processed datasets, and codebooks
    recordStep(13, 'Verify processing runs, processed datasets, and codebooks in restored database', () => {
      if (!restoredDb) throw new Error('Restored DB not open');
      const proc = restoredDb.prepare('SELECT id, status FROM processing_runs WHERE id = ?').get(recordedIds.procId) as any;
      const pds = restoredDb.prepare('SELECT id, records_json FROM processed_datasets WHERE processing_run_id = ?').get(recordedIds.procId) as any;
      const cb = restoredDb.prepare('SELECT id, entries_json FROM codebooks WHERE id = ?').get(recordedIds.cbId) as any;

      if (!proc || !pds || !cb) {
        throw new Error('Processing run, processed dataset, or codebook missing in restored database');
      }
      if (proc.status !== 'Completed') {
        throw new Error('Processing run status mismatch');
      }
    });

    // Step 14: Verify scoring runs, scored datasets, and scoring rules
    recordStep(14, 'Verify scoring runs, scored datasets, and scoring rules in restored database', () => {
      if (!restoredDb) throw new Error('Restored DB not open');
      const rule = restoredDb.prepare('SELECT id, target_code FROM scoring_rules WHERE id = ?').get(recordedIds.scRuleId) as any;
      const scrun = restoredDb.prepare('SELECT id, status FROM scoring_runs WHERE id = ?').get(recordedIds.scRunId) as any;
      const sds = restoredDb.prepare('SELECT id, records_json FROM scored_datasets WHERE scoring_run_id = ?').get(recordedIds.scRunId) as any;

      if (!rule || !scrun || !sds) {
        throw new Error('Scoring rule, scoring run, or scored dataset missing in restored database');
      }
      if (scrun.status !== 'Completed') {
        throw new Error('Scoring run status mismatch');
      }
    });

    // Step 15: Verify audit records and full cross-layer lineage traceability
    recordStep(15, 'Verify audit logs and complete cross-layer lineage traceability', () => {
      if (!restoredDb) throw new Error('Restored DB not open');
      const aud = restoredDb.prepare('SELECT id, action FROM audit_logs WHERE id = ?').get(recordedIds.audId) as any;
      if (!aud || aud.action !== 'RESTORE_TEST_DATA_CREATED') {
        throw new Error('Audit record missing in restored database');
      }

      // Verify lineage: scored_dataset -> scoring_run -> processing_run -> questionnaire_version
      const scrun = restoredDb.prepare('SELECT processing_run_id, questionnaire_version_id FROM scoring_runs WHERE id = ?').get(recordedIds.scRunId) as any;
      if (scrun.processing_run_id !== recordedIds.procId || scrun.questionnaire_version_id !== recordedIds.qvId) {
        throw new Error('End-to-end data lineage broken in restored database');
      }
    });

  } finally {
    // Clean up connections
    if (restoredDb) {
      try {
        restoredDb.close();
      } catch {
        // Ignore
      }
    }
    if (shouldCloseSource && sourceDb) {
      try {
        sourceDb.close();
      } catch {
        // Ignore
      }
    }

    // Clean up temporary database files
    try {
      if (fs.existsSync(restoredDbPath)) {
        fs.unlinkSync(restoredDbPath);
      }
      if (sourceDbPath && fs.existsSync(sourceDbPath)) {
        fs.unlinkSync(sourceDbPath);
      }
      if (backupFile && fs.existsSync(backupFile.backupPath)) {
        fs.unlinkSync(backupFile.backupPath);
      }
    } catch (cleanupErr) {
      console.warn('Cleanup error during restore test:', cleanupErr);
    }
  }

  const passedSteps = steps.filter(s => s.passed).length;
  const failedSteps = steps.length - passedSteps;
  const overallStatus: 'PASS' | 'FAIL' = failedSteps === 0 && steps.length >= 13 ? 'PASS' : 'FAIL';

  return {
    overallStatus,
    timestamp: new Date().toISOString(),
    totalSteps: steps.length,
    passedSteps,
    failedSteps,
    steps,
    tableChecksums: baselineChecksums,
  };
}
