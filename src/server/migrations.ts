import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_relational_schema',
    sql: `
      -- Users
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        institution TEXT,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Server Sessions (Tokens)
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      -- Research Projects
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        research_topic TEXT,
        research_objective TEXT,
        research_method TEXT,
        population TEXT,
        sample_description TEXT,
        research_design TEXT,
        status TEXT NOT NULL,
        is_demo INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Research Variables
      CREATE TABLE IF NOT EXISTS variables (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        variable_type TEXT,
        role TEXT NOT NULL,
        measurement_scale TEXT NOT NULL,
        conceptual_definition TEXT,
        operational_definition TEXT,
        description TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Dimensions
      CREATE TABLE IF NOT EXISTS dimensions (
        id TEXT PRIMARY KEY,
        variable_id TEXT NOT NULL REFERENCES variables(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        definition TEXT,
        description TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Indicators
      CREATE TABLE IF NOT EXISTS indicators (
        id TEXT PRIMARY KEY,
        dimension_id TEXT NOT NULL REFERENCES dimensions(id) ON DELETE CASCADE,
        variable_id TEXT NOT NULL REFERENCES variables(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        definition TEXT,
        description TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Response Scales
      CREATE TABLE IF NOT EXISTS response_scales (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        scale_type TEXT NOT NULL,
        min_value INTEGER NOT NULL,
        max_value INTEGER NOT NULL,
        is_archived INTEGER DEFAULT 0,
        is_system_preset INTEGER DEFAULT 0,
        options_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Measurement Instruments
      CREATE TABLE IF NOT EXISTS instruments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        description TEXT,
        purpose TEXT,
        source_type TEXT NOT NULL,
        source_reference TEXT,
        version TEXT NOT NULL DEFAULT '1.0',
        status TEXT NOT NULL DEFAULT 'Draft',
        variable_ids_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Instrument Items
      CREATE TABLE IF NOT EXISTS instrument_items (
        id TEXT PRIMARY KEY,
        instrument_id TEXT NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        item_code TEXT NOT NULL,
        item_number INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        item_type TEXT NOT NULL,
        variable_id TEXT,
        dimension_id TEXT,
        indicator_id TEXT,
        response_scale_id TEXT,
        required INTEGER DEFAULT 1,
        reverse_coded INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        source TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Instrument Immutable Version Snapshots
      CREATE TABLE IF NOT EXISTS instrument_versions (
        id TEXT PRIMARY KEY,
        instrument_id TEXT NOT NULL REFERENCES instruments(id),
        project_id TEXT NOT NULL REFERENCES projects(id),
        version_number TEXT NOT NULL,
        status TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Questionnaires
      CREATE TABLE IF NOT EXISTS questionnaires (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        instrument_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        instructions TEXT,
        status TEXT NOT NULL DEFAULT 'Draft',
        current_version INTEGER NOT NULL DEFAULT 1,
        slug TEXT UNIQUE NOT NULL,
        response_mode TEXT NOT NULL DEFAULT 'anonymous',
        anonymity_mode TEXT NOT NULL DEFAULT 'strict_anonymous',
        allow_multiple_submissions INTEGER DEFAULT 0,
        close_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Questionnaire Immutable Version Snapshots
      CREATE TABLE IF NOT EXISTS questionnaire_versions (
        id TEXT PRIMARY KEY,
        questionnaire_id TEXT NOT NULL REFERENCES questionnaires(id),
        project_id TEXT NOT NULL REFERENCES projects(id),
        version_number INTEGER NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        instructions TEXT,
        items_snapshot_json TEXT NOT NULL,
        scales_snapshot_json TEXT NOT NULL,
        scoring_rules_snapshot_json TEXT,
        change_summary TEXT,
        published_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Raw Survey Submissions (LAYER 1 - IMMUTABLE RAW DATA)
      CREATE TABLE IF NOT EXISTS survey_submissions (
        id TEXT PRIMARY KEY,
        questionnaire_id TEXT NOT NULL REFERENCES questionnaires(id),
        questionnaire_version_id TEXT NOT NULL REFERENCES questionnaire_versions(id),
        project_id TEXT NOT NULL REFERENCES projects(id),
        session_id TEXT NOT NULL,
        participant_mode TEXT NOT NULL,
        participant_identifier TEXT,
        questionnaire_version INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        raw_responses_json TEXT NOT NULL,
        raw_item_details_json TEXT NOT NULL,
        validation_status TEXT NOT NULL DEFAULT 'Valid',
        validation_flags_json TEXT NOT NULL DEFAULT '[]',
        researcher_decision_notes TEXT,
        status TEXT NOT NULL DEFAULT 'Submitted',
        user_agent TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL
      );

      -- Processing Runs (LAYER 2 - IMMUTABLE RUN METADATA)
      CREATE TABLE IF NOT EXISTS processing_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        questionnaire_id TEXT NOT NULL,
        questionnaire_version_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        source_submission_count INTEGER NOT NULL,
        valid_record_count INTEGER NOT NULL,
        excluded_record_count INTEGER NOT NULL,
        rules_snapshot_json TEXT NOT NULL,
        error_count INTEGER DEFAULT 0,
        warning_count INTEGER DEFAULT 0,
        errors_json TEXT DEFAULT '[]',
        warnings_json TEXT DEFAULT '[]',
        notes TEXT
      );

      -- Processed Datasets (LAYER 2 - IMMUTABLE TRANSFORMED RECORDS)
      CREATE TABLE IF NOT EXISTS processed_datasets (
        id TEXT PRIMARY KEY,
        processing_run_id TEXT NOT NULL REFERENCES processing_runs(id),
        project_id TEXT NOT NULL REFERENCES projects(id),
        columns_json TEXT NOT NULL,
        records_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Codebooks (LAYER 2 - RUN SPECIFIC CODEBOOK)
      CREATE TABLE IF NOT EXISTS codebooks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        processing_run_id TEXT NOT NULL REFERENCES processing_runs(id),
        questionnaire_version_id TEXT NOT NULL,
        version TEXT NOT NULL,
        entries_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Scoring Rules (CONFIGURABLE RULES)
      CREATE TABLE IF NOT EXISTS scoring_rules (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        target_code TEXT NOT NULL,
        target_name TEXT NOT NULL,
        method TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_item_ids_json TEXT,
        source_item_codes_json TEXT,
        source_dimension_ids_json TEXT,
        source_dimension_codes_json TEXT,
        missing_value_policy TEXT NOT NULL,
        minimum_required_items INTEGER,
        expected_range_json TEXT,
        version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Scoring Runs (LAYER 3 - IMMUTABLE SCORING RUN METADATA)
      CREATE TABLE IF NOT EXISTS scoring_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        processing_run_id TEXT NOT NULL REFERENCES processing_runs(id),
        questionnaire_id TEXT NOT NULL,
        questionnaire_version_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        source_record_count INTEGER NOT NULL,
        scored_record_count INTEGER NOT NULL,
        rules_snapshot_json TEXT NOT NULL,
        error_count INTEGER DEFAULT 0,
        warning_count INTEGER DEFAULT 0,
        errors_json TEXT DEFAULT '[]',
        warnings_json TEXT DEFAULT '[]',
        notes TEXT
      );

      -- Scored Datasets (LAYER 3 - IMMUTABLE CONSTRUCT SCORE RECORDS)
      CREATE TABLE IF NOT EXISTS scored_datasets (
        id TEXT PRIMARY KEY,
        scoring_run_id TEXT NOT NULL REFERENCES scoring_runs(id),
        processing_run_id TEXT NOT NULL REFERENCES processing_runs(id),
        project_id TEXT NOT NULL REFERENCES projects(id),
        columns_json TEXT NOT NULL,
        records_json TEXT NOT NULL,
        summary_statistics_json TEXT,
        created_at TEXT NOT NULL
      );

      -- Audit Logs (IMMUTABLE APPEND-ONLY LOGS)
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT,
        project_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        entity_name TEXT,
        timestamp TEXT NOT NULL,
        metadata_json TEXT
      );

      -- Core Indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_variables_proj ON variables(project_id);
      CREATE INDEX IF NOT EXISTS idx_dimensions_var ON dimensions(variable_id);
      CREATE INDEX IF NOT EXISTS idx_indicators_dim ON indicators(dimension_id);
      CREATE INDEX IF NOT EXISTS idx_scales_proj ON response_scales(project_id);
      CREATE INDEX IF NOT EXISTS idx_instruments_proj ON instruments(project_id);
      CREATE INDEX IF NOT EXISTS idx_items_inst ON instrument_items(instrument_id);
      CREATE INDEX IF NOT EXISTS idx_questionnaires_proj ON questionnaires(project_id);
      CREATE INDEX IF NOT EXISTS idx_questionnaires_slug ON questionnaires(slug);
      CREATE INDEX IF NOT EXISTS idx_qversions_q ON questionnaire_versions(questionnaire_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_q ON survey_submissions(questionnaire_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_proj ON survey_submissions(project_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_version ON survey_submissions(questionnaire_version_id);
      CREATE INDEX IF NOT EXISTS idx_proc_runs_proj ON processing_runs(project_id);
      CREATE INDEX IF NOT EXISTS idx_scoring_runs_proj ON scoring_runs(project_id);
      CREATE INDEX IF NOT EXISTS idx_audit_proj ON audit_logs(project_id);
    `,
  },
  {
    version: 2,
    name: '002_security_and_immutability_hardening',
    sql: `
      -- Backup & Integrity Audit Register
      CREATE TABLE IF NOT EXISTS backup_audit_records (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        integrity_check TEXT NOT NULL,
        foreign_key_check TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Unique Constraint Index on questionnaire versions (questionnaire_id + version_number)
      CREATE UNIQUE INDEX IF NOT EXISTS idx_qversions_unique ON questionnaire_versions(questionnaire_id, version_number);

      -- Unique Constraint Index on instrument versions (instrument_id + version_number)
      CREATE UNIQUE INDEX IF NOT EXISTS idx_inst_versions_unique ON instrument_versions(instrument_id, version_number);

      -- Index for participant identifier lookups to enforce duplicate check in identified mode
      CREATE INDEX IF NOT EXISTS idx_submissions_participant ON survey_submissions(questionnaire_id, participant_identifier);
    `,
  },
  {
    version: 3,
    name: '003_server_authoritative_persistence_and_lineage',
    sql: `
      -- 1. Instruments validation summary
      ALTER TABLE instruments ADD COLUMN validation_summary_json TEXT;

      -- 2. Instrument Items AI lineage & provenance
      ALTER TABLE instrument_items ADD COLUMN ai_candidate_id TEXT;
      ALTER TABLE instrument_items ADD COLUMN ai_generation_id TEXT;
      ALTER TABLE instrument_items ADD COLUMN original_ai_text TEXT;
      ALTER TABLE instrument_items ADD COLUMN modified_by_researcher INTEGER DEFAULT 0;

      -- 3. Instrument Versions metadata
      ALTER TABLE instrument_versions ADD COLUMN approved_by TEXT;
      ALTER TABLE instrument_versions ADD COLUMN approved_at TEXT;
      ALTER TABLE instrument_versions ADD COLUMN notes TEXT;

      -- 4. Questionnaire fields for client settings & lifecycle
      ALTER TABLE questionnaires ADD COLUMN owner_id TEXT;
      ALTER TABLE questionnaires ADD COLUMN introduction TEXT;
      ALTER TABLE questionnaires ADD COLUMN consent_statement TEXT;
      ALTER TABLE questionnaires ADD COLUMN closing_message TEXT;
      ALTER TABLE questionnaires ADD COLUMN start_date TEXT;
      ALTER TABLE questionnaires ADD COLUMN end_date TEXT;
      ALTER TABLE questionnaires ADD COLUMN max_responses INTEGER;

      -- 5. Questionnaire Versions lineage and lock
      ALTER TABLE questionnaire_versions ADD COLUMN instrument_id TEXT;
      ALTER TABLE questionnaire_versions ADD COLUMN instrument_version_id TEXT;
      ALTER TABLE questionnaire_versions ADD COLUMN is_locked INTEGER DEFAULT 1;
      ALTER TABLE questionnaire_versions ADD COLUMN notes TEXT;

      -- 6. AI Generation Records
      CREATE TABLE IF NOT EXISTS ai_generations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        instrument_id TEXT NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
        variable_id TEXT NOT NULL,
        dimension_id TEXT,
        indicator_id TEXT,
        model TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        generation_parameters_json TEXT NOT NULL,
        is_demo_mode INTEGER DEFAULT 0,
        generated_at TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        status TEXT NOT NULL,
        generation_notes_json TEXT,
        warnings_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ai_gen_project ON ai_generations(project_id);
      CREATE INDEX IF NOT EXISTS idx_ai_gen_inst ON ai_generations(instrument_id);

      -- 7. AI Candidate Items
      CREATE TABLE IF NOT EXISTS ai_candidates (
        id TEXT PRIMARY KEY,
        generation_id TEXT NOT NULL REFERENCES ai_generations(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        instrument_id TEXT NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
        candidate_id TEXT NOT NULL,
        question_text TEXT NOT NULL,
        suggested_item_type TEXT NOT NULL,
        variable_id TEXT NOT NULL,
        dimension_id TEXT,
        indicator_id TEXT,
        response_scale_id TEXT,
        reverse_coded INTEGER DEFAULT 0,
        quality_flags_json TEXT,
        potential_issues_json TEXT,
        confidence TEXT,
        status TEXT NOT NULL,
        accepted_item_id TEXT,
        original_text TEXT NOT NULL,
        final_text TEXT,
        modified_by_researcher INTEGER DEFAULT 0,
        duplicate_warning TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ai_cand_gen ON ai_candidates(generation_id);
      CREATE INDEX IF NOT EXISTS idx_ai_cand_proj ON ai_candidates(project_id);
    `,
  },
  {
    version: 4,
    name: '004_instrument_versions_snapshots_and_summary',
    sql: `
      ALTER TABLE instrument_versions ADD COLUMN items_snapshot_json TEXT;
      ALTER TABLE instrument_versions ADD COLUMN scales_snapshot_json TEXT;
      ALTER TABLE instrument_versions ADD COLUMN validation_summary_json TEXT;
      ALTER TABLE instrument_versions ADD COLUMN change_summary TEXT;
    `,
  },
];

/**
 * Runs pending schema migrations idempotently and safely inside transactions
 */
export function runMigrations(database: DatabaseSync): {
  appliedCount: number;
  currentVersion: number;
} {
  // Ensure migration tracking table exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      checksum TEXT NOT NULL
    );
  `);

  const appliedRows = database
    .prepare('SELECT version FROM _schema_migrations ORDER BY version ASC')
    .all() as { version: number }[];
  const appliedSet = new Set(appliedRows.map(r => r.version));

  let appliedCount = 0;
  let currentVersion = appliedRows.length > 0 ? appliedRows[appliedRows.length - 1].version : 0;

  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.version)) {
      continue;
    }

    const checksum = crypto.createHash('sha256').update(migration.sql).digest('hex');
    const now = new Date().toISOString();

    // Execute migration inside atomic transaction
    database.exec('BEGIN IMMEDIATE;');
    try {
      database.exec(migration.sql);
      database
        .prepare(
          'INSERT INTO _schema_migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)'
        )
        .run(migration.version, migration.name, now, checksum);

      database.exec('COMMIT;');
      appliedCount++;
      currentVersion = migration.version;
      console.log(`[Database Migration] Applied migration #${migration.version}: ${migration.name}`);
    } catch (err) {
      database.exec('ROLLBACK;');
      console.error(`[Database Migration] Failed migration #${migration.version}: ${migration.name}`, err);
      throw new Error(`Database migration #${migration.version} failed: ${err}`);
    }
  }

  return { appliedCount, currentVersion };
}
