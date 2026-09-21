import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { runMigrations } from './migrations.js';

// Ensure data directory exists with restricted permissions (0700)
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
} else {
  try {
    fs.chmodSync(dataDir, 0o700);
  } catch {
    // Platform may not support POSIX chmod
  }
}

export const DB_PATH = path.join(dataDir, 'research_platform.db');
export const db = new DatabaseSync(DB_PATH);

// Restrict database file permissions (0600)
try {
  if (fs.existsSync(DB_PATH)) {
    fs.chmodSync(DB_PATH, 0o600);
  }
} catch {
  // Platform may not support POSIX chmod
}

// Enable WAL mode for high concurrency
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

// Run schema migrations idempotently and atomically
runMigrations(db);

// Tables, indexes and schema versions are managed via runMigrations(db)


// Seed default users if empty
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
if (userCount.c === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, institution, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'usr_amelia_ross',
    'Dr. Amelia Ross',
    'dr.amelia@research.edu',
    'Department of Behavioral Sciences, National Institute of Research',
    'researcher',
    '2026-01-15T08:00:00.000Z'
  );

  insertUser.run(
    'usr_kenji_sato',
    'Kenji Sato, M.Sc.',
    'kenji.sato@university.edu',
    'Graduate School of Education & Psychology, Metropolitan University',
    'student',
    '2026-02-01T09:30:00.000Z'
  );
}

// Seed default demo project if empty
const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number };
if (projectCount.c === 0) {
  const now = '2026-02-10T10:00:00.000Z';
  const demoProjectId = 'proj_demo_doomscrolling_2026';

  db.prepare(`
    INSERT INTO projects (
      id, user_id, title, research_topic, research_objective, research_method,
      population, sample_description, research_design, status, is_demo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    demoProjectId,
    'usr_amelia_ross',
    '[DEMO DATA] Doomscrolling and Academic Burnout in Undergraduate Students',
    'Compulsive Negative Information Consumption & Cognitive Fatigue in Higher Education',
    'To examine the empirical relationship between compulsive negative news browsing (doomscrolling) and dimensions of academic burnout (emotional exhaustion, cynicism, and inefficacy) among undergraduate university students.',
    'Quantitative Cross-Sectional Survey Correlational Design',
    'Full-time undergraduate students enrolled in accredited 4-year higher education programs (aged 18–25).',
    'Stratified convenience sample of N = 250 students across humanities, STEM, and social sciences.',
    'Cross-sectional survey with multivariate correlation and ordinary least squares (OLS) regression modeling.',
    'Draft',
    now,
    '2026-02-12T14:30:00.000Z'
  );

  // Seed response scales for demo project
  const insertScale = db.prepare(`
    INSERT INTO response_scales (
      id, project_id, name, scale_type, min_value, max_value, is_archived, is_system_preset, options_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)
  `);

  insertScale.run(
    'scale_likert_5_agree',
    demoProjectId,
    'Likert 5-point Agreement',
    'Likert',
    1,
    5,
    JSON.stringify([
      { value: 1, label: 'Strongly Disagree', code: 'SD' },
      { value: 2, label: 'Disagree', code: 'D' },
      { value: 3, label: 'Neutral', code: 'N' },
      { value: 4, label: 'Agree', code: 'A' },
      { value: 5, label: 'Strongly Agree', code: 'SA' },
    ]),
    now,
    now
  );

  insertScale.run(
    'scale_likert_5_freq',
    demoProjectId,
    'Likert 5-point Frequency',
    'Likert',
    1,
    5,
    JSON.stringify([
      { value: 1, label: 'Never', code: 'NEV' },
      { value: 2, label: 'Rarely', code: 'RAR' },
      { value: 3, label: 'Sometimes', code: 'SOMET' },
      { value: 4, label: 'Often', code: 'OFT' },
      { value: 5, label: 'Always', code: 'ALW' },
    ]),
    now,
    now
  );

  insertScale.run(
    'scale_mbi_7_freq',
    demoProjectId,
    'MBI-SS 7-point Burnout Frequency',
    'Likert',
    0,
    6,
    JSON.stringify([
      { value: 0, label: 'Never', code: '0' },
      { value: 1, label: 'A few times a year or less', code: '1' },
      { value: 2, label: 'Once a month or less', code: '2' },
      { value: 3, label: 'A few times a month', code: '3' },
      { value: 4, label: 'Once a week', code: '4' },
      { value: 5, label: 'A few times a week', code: '5' },
      { value: 6, label: 'Every day', code: '6' },
    ]),
    now,
    now
  );

  // Seed Variables, Dimensions, Indicators
  const insertVar = db.prepare(`
    INSERT INTO variables (
      id, project_id, name, code, variable_type, role, measurement_scale,
      conceptual_definition, operational_definition, description, order_index, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertVar.run(
    'var_demo_x1',
    demoProjectId,
    'Doomscrolling Behavior',
    'X1',
    'Multidimensional Latent Construct',
    'Independent Variable',
    'Interval',
    'The habitual, compulsive impulse to continuously scroll through distressing, catastrophic, or negative online news.',
    'Mean composite score derived from self-report frequency ratings on a 5-point Likert scale (1 = Never to 5 = Always).',
    'Primary predictor construct adapted from Sharma et al. (2022) Doomscrolling Scale.',
    1,
    now,
    now
  );

  const insertDim = db.prepare(`
    INSERT INTO dimensions (
      id, variable_id, project_id, name, code, definition, description, order_index, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertDim.run(
    'dim_demo_1',
    'var_demo_x1',
    demoProjectId,
    'Compulsive Consumption',
    'DIM-1',
    'Repetitive, uncontrolled searching and scrolling behavior directed at negative news threads.',
    'Measures behavioral automaticity and inability to abstain.',
    1,
    now,
    now
  );

  insertDim.run(
    'dim_demo_2',
    'var_demo_x1',
    demoProjectId,
    'Sleep & Bedtime Displacement',
    'DIM-2',
    'The prolongation of screen time late at night resulting in lost sleep duration.',
    'Evaluates media interference with circadian rhythms.',
    2,
    now,
    now
  );

  const insertInd = db.prepare(`
    INSERT INTO indicators (
      id, dimension_id, variable_id, project_id, name, code, definition, description, order_index, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertInd.run(
    'ind_demo_1_1',
    'dim_demo_1',
    'var_demo_x1',
    demoProjectId,
    'Compulsive News Urges',
    'IND-1.1',
    'Frequency of sudden impulses to check catastrophe updates.',
    'Measures automaticity.',
    1,
    now,
    now
  );

  insertInd.run(
    'ind_demo_1_2',
    'dim_demo_1',
    'var_demo_x1',
    demoProjectId,
    'Loss of Disengagement Control',
    'IND-1.2',
    'Inability to stop reading despite realizing negative mood.',
    'Measures self-regulation deficit.',
    2,
    now,
    now
  );

  insertInd.run(
    'ind_demo_2_1',
    'dim_demo_2',
    'var_demo_x1',
    demoProjectId,
    'Bedtime Reading Delay',
    'IND-2.1',
    'Delaying intended sleep time due to distressing news feeds.',
    'Measures sleep disruption.',
    1,
    now,
    now
  );

  // Seed Instrument & Items
  db.prepare(`
    INSERT INTO instruments (
      id, project_id, name, code, description, purpose, source_type, source_reference,
      version, status, variable_ids_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1.0', 'Draft', ?, ?, ?)
  `).run(
    'inst_demo_doomscrolling',
    demoProjectId,
    'Doomscrolling Scale (DMS-8)',
    'DMS',
    'An adapted 8-item psychometric measure assessing compulsive news monitoring and cognitive fatigue.',
    'To quantify compulsive negative news browsing, loss of disengagement control, and bedtime media displacement.',
    'Adapted Instrument',
    'Adapted from Sharma et al. (2022) Doomscrolling Scale and Satici et al. (2023)',
    JSON.stringify(['var_demo_x1']),
    now,
    now
  );

  const insertItem = db.prepare(`
    INSERT INTO instrument_items (
      id, instrument_id, project_id, item_code, item_number, question_text, item_type,
      variable_id, dimension_id, indicator_id, response_scale_id, required, reverse_coded, status, source, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `);

  insertItem.run(
    'item_demo_1',
    'inst_demo_doomscrolling',
    demoProjectId,
    'DMS.01',
    1,
    'I find myself reflexively checking news apps for breaking crisis reports without intending to.',
    'Likert',
    'var_demo_x1',
    'dim_demo_1',
    'ind_demo_1_1',
    'scale_likert_5_freq',
    1,
    0,
    'Adapted',
    'Adapted from Sharma et al. (2022) Item 1',
    now,
    now
  );

  insertItem.run(
    'item_demo_2',
    'inst_demo_doomscrolling',
    demoProjectId,
    'DMS.02',
    2,
    'I spend more than an hour continuously reading tragic or catastrophic news feeds on social media.',
    'Likert',
    'var_demo_x1',
    'dim_demo_1',
    'ind_demo_1_2',
    'scale_likert_5_freq',
    1,
    0,
    'Adapted',
    'Adapted from Sharma et al. (2022) Item 3',
    now,
    now
  );

  insertItem.run(
    'item_demo_3',
    'inst_demo_doomscrolling',
    demoProjectId,
    'DMS.03',
    3,
    'I lose track of time when browsing alarming articles about social or global crises.',
    'Likert',
    'var_demo_x1',
    'dim_demo_1',
    'ind_demo_1_2',
    'scale_likert_5_freq',
    1,
    0,
    'Adapted',
    'Adapted from Sharma et al. (2022) Item 4',
    now,
    now
  );

  insertItem.run(
    'item_demo_4',
    'inst_demo_doomscrolling',
    demoProjectId,
    'DMS.04',
    4,
    'I easily stop reading distressing online news as soon as I decide to.',
    'Likert',
    'var_demo_x1',
    'dim_demo_1',
    'ind_demo_1_2',
    'scale_likert_5_freq',
    1,
    1, // Reverse Coded!
    'Adapted',
    'Negatively-keyed item to detect acquiescence bias',
    now,
    now
  );

  insertItem.run(
    'item_demo_5',
    'inst_demo_doomscrolling',
    demoProjectId,
    'DMS.05',
    5,
    'I stay awake past my normal bedtime reading upsetting news updates on my phone.',
    'Likert',
    'var_demo_x1',
    'dim_demo_2',
    'ind_demo_2_1',
    'scale_likert_5_freq',
    1,
    0,
    'Adapted',
    'Adapted from Satici et al. (2023) Item 2',
    now,
    now
  );

  // Seed default questionnaire
  const demoQId = 'q_demo_doomscrolling';
  const demoVersionId = 'qv_demo_doomscrolling_v1';
  const slug = 'doomscrolling-behavior-study-2026';

  db.prepare(`
    INSERT INTO questionnaires (
      id, project_id, instrument_id, title, description, instructions, status,
      current_version, slug, response_mode, anonymity_mode, allow_multiple_submissions, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'Active', 1, ?, 'anonymous', 'strict_anonymous', 0, ?, ?)
  `).run(
    demoQId,
    demoProjectId,
    'inst_demo_doomscrolling',
    'Undergraduate Media Habits & Academic Well-Being Survey (2026)',
    'An empirical survey investigating smartphone news consumption patterns and daily study engagement.',
    'Please answer honestly based on your typical habits over the past 30 days. There are no right or wrong answers.',
    slug,
    now,
    now
  );

  // Capture items snapshot
  const itemsSnapshot = [
    {
      id: 'item_demo_1',
      instrumentId: 'inst_demo_doomscrolling',
      projectId: demoProjectId,
      itemCode: 'DMS.01',
      itemNumber: 1,
      questionText: 'I find myself reflexively checking news apps for breaking crisis reports without intending to.',
      itemType: 'Likert',
      variableId: 'var_demo_x1',
      dimensionId: 'dim_demo_1',
      indicatorId: 'ind_demo_1_1',
      responseScaleId: 'scale_likert_5_freq',
      required: true,
      reverseCoded: false,
      status: 'active',
    },
    {
      id: 'item_demo_2',
      instrumentId: 'inst_demo_doomscrolling',
      projectId: demoProjectId,
      itemCode: 'DMS.02',
      itemNumber: 2,
      questionText: 'I spend more than an hour continuously reading tragic or catastrophic news feeds on social media.',
      itemType: 'Likert',
      variableId: 'var_demo_x1',
      dimensionId: 'dim_demo_1',
      indicatorId: 'ind_demo_1_2',
      responseScaleId: 'scale_likert_5_freq',
      required: true,
      reverseCoded: false,
      status: 'active',
    },
    {
      id: 'item_demo_3',
      instrumentId: 'inst_demo_doomscrolling',
      projectId: demoProjectId,
      itemCode: 'DMS.03',
      itemNumber: 3,
      questionText: 'I lose track of time when browsing alarming articles about social or global crises.',
      itemType: 'Likert',
      variableId: 'var_demo_x1',
      dimensionId: 'dim_demo_1',
      indicatorId: 'ind_demo_1_2',
      responseScaleId: 'scale_likert_5_freq',
      required: true,
      reverseCoded: false,
      status: 'active',
    },
    {
      id: 'item_demo_4',
      instrumentId: 'inst_demo_doomscrolling',
      projectId: demoProjectId,
      itemCode: 'DMS.04',
      itemNumber: 4,
      questionText: 'I easily stop reading distressing online news as soon as I decide to.',
      itemType: 'Likert',
      variableId: 'var_demo_x1',
      dimensionId: 'dim_demo_1',
      indicatorId: 'ind_demo_1_2',
      responseScaleId: 'scale_likert_5_freq',
      required: true,
      reverseCoded: true,
      status: 'active',
    },
    {
      id: 'item_demo_5',
      instrumentId: 'inst_demo_doomscrolling',
      projectId: demoProjectId,
      itemCode: 'DMS.05',
      itemNumber: 5,
      questionText: 'I stay awake past my normal bedtime reading upsetting news updates on my phone.',
      itemType: 'Likert',
      variableId: 'var_demo_x1',
      dimensionId: 'dim_demo_2',
      indicatorId: 'ind_demo_2_1',
      responseScaleId: 'scale_likert_5_freq',
      required: true,
      reverseCoded: false,
      status: 'active',
    },
  ];

  const scalesSnapshot = [
    {
      id: 'scale_likert_5_freq',
      projectId: demoProjectId,
      name: 'Likert 5-point Frequency',
      scaleType: 'Likert',
      minValue: 1,
      maxValue: 5,
      options: [
        { value: 1, label: 'Never', code: 'NEV' },
        { value: 2, label: 'Rarely', code: 'RAR' },
        { value: 3, label: 'Sometimes', code: 'SOMET' },
        { value: 4, label: 'Often', code: 'OFT' },
        { value: 5, label: 'Always', code: 'ALW' },
      ],
    },
  ];

  db.prepare(`
    INSERT INTO questionnaire_versions (
      id, questionnaire_id, project_id, version_number, status, title, instructions,
      items_snapshot_json, scales_snapshot_json, change_summary, published_at, created_at
    ) VALUES (?, ?, ?, 1, 'Published', ?, ?, ?, ?, 'Initial empirical release v1.0', ?, ?)
  `).run(
    demoVersionId,
    demoQId,
    demoProjectId,
    'Undergraduate Media Habits & Academic Well-Being Survey (2026)',
    'Please answer honestly based on your typical habits over the past 30 days. There are no right or wrong answers.',
    JSON.stringify(itemsSnapshot),
    JSON.stringify(scalesSnapshot),
    now,
    now
  );
}

// Ensure demo instrument has an approved version and questionnaire links to it with full lineage
const demoInstVer = db.prepare('SELECT id FROM instrument_versions WHERE id = ?').get('inst_ver_demo_doomscrolling_v1');
if (!demoInstVer) {
  const now = '2026-02-10T10:00:00.000Z';
  const demoProjectId = 'proj_demo_doomscrolling_2026';
  const demoInstId = 'inst_demo_doomscrolling';

  const demoItems = db.prepare('SELECT * FROM instrument_items WHERE instrument_id = ?').all(demoInstId);
  const demoScales = db.prepare('SELECT * FROM response_scales WHERE project_id = ?').all(demoProjectId);

  db.prepare(`
    INSERT OR REPLACE INTO instrument_versions (
      id, instrument_id, project_id, version_number, status, snapshot_json, items_snapshot_json, scales_snapshot_json,
      validation_summary_json, change_summary, approved_by, approved_at, notes, created_at
    ) VALUES (?, ?, ?, 1, 'Approved', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'inst_ver_demo_doomscrolling_v1',
    demoInstId,
    demoProjectId,
    JSON.stringify({ items: demoItems, scales: demoScales }),
    JSON.stringify(demoItems),
    JSON.stringify(demoScales),
    JSON.stringify({ isValid: true, readinessScore: 92, passedChecks: 5 }),
    'Initial empirical baseline approval',
    'Dr. Amelia Ross',
    now,
    'Psychometrically validated demo baseline',
    now
  );

  db.prepare(`
    UPDATE instruments SET status = 'Approved', version = '1.0' WHERE id = ?
  `).run(demoInstId);

  db.prepare(`
    UPDATE questionnaires
    SET owner_id = 'usr_amelia_ross',
        introduction = 'Welcome to the Undergraduate Media Habits Survey. Your responses contribute directly to empirical academic research.',
        consent_statement = 'By continuing, you acknowledge that you are 18+ and consent to anonymous academic data collection.',
        closing_message = 'Thank you for participating! Your responses have been securely recorded.'
    WHERE id = 'q_demo_doomscrolling'
  `).run();

  db.prepare(`
    UPDATE questionnaire_versions
    SET instrument_id = ?, instrument_version_id = ?
    WHERE id = 'qv_demo_doomscrolling_v1'
  `).run(demoInstId, 'inst_ver_demo_doomscrolling_v1');
}
