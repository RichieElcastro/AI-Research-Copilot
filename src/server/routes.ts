import { Router, Request, Response } from 'express';
import { db } from './db.js';
import {
  authenticate,
  requireProjectAccess,
  createSession,
  revokeSession,
  AuthenticatedRequest,
  AuthUser,
} from './auth.js';
import {
  publicSurveyRateLimiter,
  publicSubmissionRateLimiter,
  authRateLimiter,
} from './rateLimiter.js';
import {
  createDatabaseBackup,
  listBackups,
  runRestoreTest,
  verifyDatabaseIntegrity,
} from './backup.js';

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & USER ENDPOINTS
// ==========================================

apiRouter.get('/auth/users', (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, name, email, institution, role, created_at FROM users').all();
  res.json({ success: true, users });
});

apiRouter.post('/auth/login', authRateLimiter, (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const user = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email) as { id: string } | undefined;
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found with this email' });
  }

  const session = createSession(user.id);
  res.json({ success: true, token: session.token, user: session.user });
});

apiRouter.post('/auth/switch-user', authRateLimiter, (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: string } | undefined;
  if (!user) {
    return res.status(404).json({ success: false, error: `User with ID ${userId} does not exist` });
  }

  const session = createSession(user.id);
  res.json({ success: true, token: session.token, user: session.user });
});

apiRouter.post('/auth/register', authRateLimiter, (req: Request, res: Response) => {
  const { name, email, institution, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, error: 'Name and email are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(409).json({ success: false, error: 'User with this email already exists' });
  }

  const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, name, email, institution, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), email.trim(), institution?.trim() || null, role || 'researcher', now);

  const session = createSession(id);
  res.status(201).json({ success: true, token: session.token, user: session.user });
});

apiRouter.get('/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, user: req.user });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    revokeSession(token);
  }
  res.json({ success: true, message: 'Logged out and session invalidated' });
});

// ==========================================
// 2. PUBLIC SURVEY ENDPOINTS (NO AUTH REQUIRED)
// ==========================================

apiRouter.get('/public/surveys/:slug', publicSurveyRateLimiter, (req: Request, res: Response) => {
  const { slug } = req.params;
  const q = db.prepare(`
    SELECT id, project_id, title, description, instructions, status, current_version, slug, response_mode, anonymity_mode, allow_multiple_submissions, close_date
    FROM questionnaires
    WHERE slug = ?
  `).get(slug) as any;

  if (!q) {
    return res.status(404).json({ success: false, error: 'Questionnaire not found.' });
  }

  if (q.status !== 'Active') {
    return res.status(403).json({
      success: false,
      error: `This survey is currently ${q.status}. Submissions are not being accepted.`,
      status: q.status,
    });
  }

  // Get current version snapshot
  const v = db.prepare(`
    SELECT id, version_number, status, title, instructions, items_snapshot_json, scales_snapshot_json, published_at
    FROM questionnaire_versions
    WHERE questionnaire_id = ? AND version_number = ?
  `).get(q.id, q.current_version) as any;

  if (!v) {
    return res.status(404).json({ success: false, error: 'Published questionnaire version snapshot not found.' });
  }

  const items = JSON.parse(v.items_snapshot_json);
  const scales = JSON.parse(v.scales_snapshot_json);

  // Safe DTO: Strips internal database IDs, researcher identity, hypotheses, processing rules
  const publicDto = {
    id: q.id,
    versionId: v.id,
    versionNumber: v.version_number,
    slug: q.slug,
    title: v.title || q.title,
    description: q.description,
    instructions: v.instructions || q.instructions,
    responseMode: q.response_mode,
    anonymityMode: q.anonymity_mode,
    allowMultipleSubmissions: Boolean(q.allow_multiple_submissions),
    closeDate: q.close_date,
    items,
    scales,
    publishedAt: v.published_at,
  };

  res.json({ success: true, data: publicDto });
});

apiRouter.post('/public/surveys/:slug/submissions', publicSubmissionRateLimiter, (req: Request, res: Response) => {
  const { slug } = req.params;
  const {
    questionnaireVersionId,
    sessionId,
    startedAt,
    consentGiven,
    participantIdentifier,
    rawResponses,
  } = req.body;

  if (!consentGiven) {
    return res.status(400).json({ success: false, error: 'Consent must be granted to participate.' });
  }

  if (!rawResponses || typeof rawResponses !== 'object' || Array.isArray(rawResponses)) {
    return res.status(400).json({ success: false, error: 'Invalid response payload.' });
  }

  // Verify questionnaire status
  const q = db.prepare('SELECT id, project_id, status, current_version, response_mode, allow_multiple_submissions FROM questionnaires WHERE slug = ?').get(slug) as any;
  if (!q) {
    return res.status(404).json({ success: false, error: 'Survey not found.' });
  }

  if (q.status !== 'Active') {
    return res.status(403).json({ success: false, error: `Survey is currently ${q.status}. Submissions are closed.` });
  }

  // Duplicate check for identified mode
  if (q.response_mode === 'identified') {
    if (!participantIdentifier || !String(participantIdentifier).trim()) {
      return res.status(422).json({
        success: false,
        error: 'Participant identifier is required for identified surveys.',
      });
    }

    if (!q.allow_multiple_submissions) {
      const existing = db.prepare(`
        SELECT id FROM survey_submissions
        WHERE questionnaire_id = ? AND LOWER(TRIM(participant_identifier)) = LOWER(TRIM(?))
      `).get(q.id, String(participantIdentifier).trim());

      if (existing) {
        return res.status(409).json({
          success: false,
          error: `A submission with identifier "${String(participantIdentifier).trim()}" has already been recorded for this study. Duplicate submissions are not permitted.`,
        });
      }
    }
  }

  // Verify version snapshot
  const v = db.prepare('SELECT id, version_number, items_snapshot_json FROM questionnaire_versions WHERE id = ?').get(questionnaireVersionId) as any;
  if (!v) {
    return res.status(400).json({ success: false, error: 'Invalid questionnaire version snapshot reference.' });
  }

  const items = JSON.parse(v.items_snapshot_json);
  const allowedItemCodes = new Set(items.map((i: any) => i.itemCode));
  const rawKeys = Object.keys(rawResponses);

  // Payload size constraints
  if (rawKeys.length > 150) {
    return res.status(413).json({ success: false, error: 'Submissions cannot exceed 150 items.' });
  }

  for (const key of rawKeys) {
    if (!allowedItemCodes.has(key)) {
      return res.status(400).json({ success: false, error: `Invalid item code "${key}" submitted. Not in published survey snapshot.` });
    }
    const valStr = String(rawResponses[key] ?? '');
    if (valStr.length > 10000) {
      return res.status(413).json({ success: false, error: `Response for item "${key}" exceeds maximum allowed length of 10,000 characters.` });
    }
  }

  const rawItemDetails: Record<string, any> = {};
  const validationFlags: string[] = [];

  // Check required items
  for (const item of items) {
    const val = rawResponses[item.itemCode];
    const isProvided = val !== undefined && val !== null && String(val).trim() !== '';

    if (item.required && !isProvided) {
      return res.status(422).json({
        success: false,
        error: `Item "${item.itemCode}" is required.`,
        itemCode: item.itemCode,
      });
    }

    rawItemDetails[item.itemCode] = {
      itemCode: item.itemCode,
      rawValue: isProvided ? String(val).trim() : null,
      itemType: item.itemType,
      reverseCoded: item.reverseCoded,
      timestamp: new Date().toISOString(),
    };
  }

  // Calculate duration
  const submittedAt = new Date().toISOString();
  const startTime = startedAt ? new Date(startedAt).getTime() : Date.now() - 30000;
  const durationSeconds = Math.max(1, Math.round((new Date(submittedAt).getTime() - startTime) / 1000));

  if (durationSeconds < 10) {
    validationFlags.push('Speeder: Completed survey in under 10 seconds.');
  }

  // Check straightlining if Likert
  const numericValues = Object.values(rawResponses)
    .map(v => Number(v))
    .filter(n => !isNaN(n));
  if (numericValues.length >= 4) {
    const allSame = numericValues.every(v => v === numericValues[0]);
    if (allSame) {
      validationFlags.push('Straightlining: All numeric answers are identical.');
    }
  }

  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const validationStatus = validationFlags.length > 0 ? 'Flagged' : 'Valid';
  const auditId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // ATOMIC TRANSACTION: submission + audit trail
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(`
      INSERT INTO survey_submissions (
        id, questionnaire_id, questionnaire_version_id, project_id, session_id,
        participant_mode, participant_identifier, questionnaire_version, started_at, submitted_at,
        duration_seconds, raw_responses_json, raw_item_details_json, validation_status,
        validation_flags_json, researcher_decision_notes, status, user_agent, ip_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, 'Submitted', ?, ?, ?)
    `).run(
      submissionId,
      q.id,
      v.id,
      q.project_id,
      sessionId || `sess_${Date.now()}`,
      q.response_mode,
      participantIdentifier ? String(participantIdentifier).trim() : null,
      v.version_number,
      startedAt || submittedAt,
      submittedAt,
      durationSeconds,
      JSON.stringify(rawResponses),
      JSON.stringify(rawItemDetails),
      validationStatus,
      JSON.stringify(validationFlags),
      req.headers['user-agent'] || null,
      req.ip || null,
      submittedAt
    );

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, project_id, action, entity_type, entity_id, entity_name, timestamp, metadata_json)
      VALUES (?, 'participant', 'Survey Participant', ?, 'SUBMISSION_RECEIVED', 'survey_submission', ?, ?, ?, ?)
    `).run(
      auditId,
      q.project_id,
      submissionId,
      `Submission ${submissionId}`,
      submittedAt,
      JSON.stringify({ questionnaireId: q.id, versionId: v.id, durationSeconds, validationStatus })
    );

    db.exec('COMMIT;');
  } catch (txErr) {
    db.exec('ROLLBACK;');
    console.error('Submission transaction failed:', txErr);
    return res.status(500).json({ success: false, error: 'Failed to record submission securely. Transaction rolled back.' });
  }

  res.status(201).json({
    success: true,
    data: {
      submissionId,
      submittedAt,
      validationStatus,
      message: 'Your response has been securely and immutably recorded.',
    },
  });
});

// ==========================================
// 3. RESEARCHER PROJECT ENDPOINTS (AUTH REQUIRED)
// ==========================================

// List projects owned by authenticated researcher
apiRouter.get('/projects', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const rows = db.prepare(`
    SELECT id, user_id as userId, title, research_topic as researchTopic,
           research_objective as researchObjective, research_method as researchMethod,
           population, sample_description as sampleDescription, research_design as researchDesign,
           status, is_demo as isDemo, created_at as createdAt, updated_at as updatedAt
    FROM projects
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId) as any[];

  const projects = rows.map(p => ({ ...p, isDemo: Boolean(p.isDemo) }));
  res.json({ success: true, data: projects });
});

// Create project
apiRouter.post('/projects', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { title, researchTopic, researchObjective, researchMethod, population, sampleDescription, researchDesign } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, error: 'Project title is required' });
  }

  const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO projects (
      id, user_id, title, research_topic, research_objective, research_method,
      population, sample_description, research_design, status, is_demo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', 0, ?, ?)
  `).run(
    id,
    userId,
    title.trim(),
    researchTopic?.trim() || null,
    researchObjective?.trim() || null,
    researchMethod?.trim() || null,
    population?.trim() || null,
    sampleDescription?.trim() || null,
    researchDesign?.trim() || null,
    now,
    now
  );

  const created = db.prepare(`
    SELECT id, user_id as userId, title, research_topic as researchTopic,
           research_objective as researchObjective, research_method as researchMethod,
           population, sample_description as sampleDescription, research_design as researchDesign,
           status, is_demo as isDemo, created_at as createdAt, updated_at as updatedAt
    FROM projects WHERE id = ?
  `).get(id) as any;

  res.status(201).json({ success: true, data: { ...created, isDemo: Boolean(created.isDemo) } });
});

// Get project by ID (strictly enforces ownership)
apiRouter.get('/projects/:projectId', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const row = db.prepare(`
    SELECT id, user_id as userId, title, research_topic as researchTopic,
           research_objective as researchObjective, research_method as researchMethod,
           population, sample_description as sampleDescription, research_design as researchDesign,
           status, is_demo as isDemo, created_at as createdAt, updated_at as updatedAt
    FROM projects WHERE id = ?
  `).get(projectId) as any;

  if (!row) {
    return res.status(404).json({ success: false, error: 'Project not found' });
  }

  res.json({ success: true, data: { ...row, isDemo: Boolean(row.isDemo) } });
});

// Update project
apiRouter.put('/projects/:projectId', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { title, researchTopic, researchObjective, researchMethod, population, sampleDescription, researchDesign, status } = req.body;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE projects SET
      title = COALESCE(?, title),
      research_topic = COALESCE(?, research_topic),
      research_objective = COALESCE(?, research_objective),
      research_method = COALESCE(?, research_method),
      population = COALESCE(?, population),
      sample_description = COALESCE(?, sample_description),
      research_design = COALESCE(?, research_design),
      status = COALESCE(?, status),
      updated_at = ?
    WHERE id = ?
  `).run(title, researchTopic, researchObjective, researchMethod, population, sampleDescription, researchDesign, status, now, projectId);

  const updated = db.prepare(`
    SELECT id, user_id as userId, title, research_topic as researchTopic,
           research_objective as researchObjective, research_method as researchMethod,
           population, sample_description as sampleDescription, research_design as researchDesign,
           status, is_demo as isDemo, created_at as createdAt, updated_at as updatedAt
    FROM projects WHERE id = ?
  `).get(projectId) as any;

  res.json({ success: true, data: { ...updated, isDemo: Boolean(updated.isDemo) } });
});

// Delete project
apiRouter.delete('/projects/:projectId', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;

  // Check if project has active questionnaires or submissions
  const subCount = db.prepare('SELECT COUNT(*) as c FROM survey_submissions WHERE project_id = ?').get(projectId) as { c: number };
  if (subCount.c > 0) {
    return res.status(400).json({
      success: false,
      error: `Cannot delete project with ${subCount.c} participant submissions. Archive the project instead to preserve data integrity.`,
    });
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  res.json({ success: true, message: 'Project safely deleted' });
});

// ==========================================
// 4. VARIABLES, DIMENSIONS, INDICATORS
// ==========================================

apiRouter.get('/projects/:projectId/variables', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;

  const vars = db.prepare(`
    SELECT id, project_id as projectId, name, code, variable_type as variableType,
           role, measurement_scale as measurementScale, conceptual_definition as conceptualDefinition,
           operational_definition as operationalDefinition, description, order_index as orderIndex,
           created_at as createdAt, updated_at as updatedAt
    FROM variables WHERE project_id = ? ORDER BY order_index ASC
  `).all(projectId) as any[];

  const dims = db.prepare(`
    SELECT id, variable_id as variableId, project_id as projectId, name, code, definition,
           description, order_index as orderIndex, created_at as createdAt, updated_at as updatedAt
    FROM dimensions WHERE project_id = ? ORDER BY order_index ASC
  `).all(projectId) as any[];

  const inds = db.prepare(`
    SELECT id, dimension_id as dimensionId, variable_id as variableId, project_id as projectId,
           name, code, definition, description, order_index as orderIndex,
           created_at as createdAt, updated_at as updatedAt
    FROM indicators WHERE project_id = ? ORDER BY order_index ASC
  `).all(projectId) as any[];

  const result = vars.map(v => ({
    ...v,
    dimensions: dims
      .filter(d => d.variableId === v.id)
      .map(d => ({
        ...d,
        indicators: inds.filter(i => i.dimensionId === d.id),
      })),
  }));

  res.json({ success: true, data: result });
});

apiRouter.post('/projects/:projectId/variables', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { name, code, variableType, role, measurementScale, conceptualDefinition, operationalDefinition, description, orderIndex } = req.body;

  if (!name || !code) {
    return res.status(400).json({ success: false, error: 'Variable name and code are required' });
  }

  const id = `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO variables (
      id, project_id, name, code, variable_type, role, measurement_scale,
      conceptual_definition, operational_definition, description, order_index, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    projectId,
    name.trim(),
    code.trim(),
    variableType || 'Latent Construct',
    role || 'Independent Variable',
    measurementScale || 'Interval',
    conceptualDefinition || null,
    operationalDefinition || null,
    description || null,
    orderIndex || 1,
    now,
    now
  );

  res.status(201).json({
    success: true,
    data: {
      id,
      projectId,
      name,
      code,
      variableType,
      role,
      measurementScale,
      conceptualDefinition,
      operationalDefinition,
      description,
      orderIndex: orderIndex || 1,
      dimensions: [],
      createdAt: now,
      updatedAt: now,
    },
  });
});

apiRouter.put('/projects/:projectId/variables/:id', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, code, variableType, role, measurementScale, conceptualDefinition, operationalDefinition, description } = req.body;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE variables SET
      name = COALESCE(?, name),
      code = COALESCE(?, code),
      variable_type = COALESCE(?, variable_type),
      role = COALESCE(?, role),
      measurement_scale = COALESCE(?, measurement_scale),
      conceptual_definition = COALESCE(?, conceptual_definition),
      operational_definition = COALESCE(?, operational_definition),
      description = COALESCE(?, description),
      updated_at = ?
    WHERE id = ?
  `).run(name, code, variableType, role, measurementScale, conceptualDefinition, operationalDefinition, description, now, id);

  res.json({ success: true, message: 'Variable updated' });
});

apiRouter.delete('/projects/:projectId/variables/:id', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM variables WHERE id = ?').run(id);
  res.json({ success: true, message: 'Variable deleted' });
});

// Dimensions
apiRouter.post('/projects/:projectId/dimensions', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { variableId, name, code, definition, description, orderIndex } = req.body;

  if (!variableId || !name) {
    return res.status(400).json({ success: false, error: 'Variable ID and Dimension name are required' });
  }

  const id = `dim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO dimensions (id, variable_id, project_id, name, code, definition, description, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, variableId, projectId, name.trim(), code || 'DIM', definition || null, description || null, orderIndex || 1, now, now);

  res.status(201).json({ success: true, data: { id, variableId, projectId, name, code, definition, description, orderIndex: orderIndex || 1, indicators: [], createdAt: now, updatedAt: now } });
});

apiRouter.delete('/projects/:projectId/dimensions/:id', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM dimensions WHERE id = ?').run(id);
  res.json({ success: true, message: 'Dimension deleted' });
});

// Indicators
apiRouter.post('/projects/:projectId/indicators', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { dimensionId, variableId, name, code, definition, description, orderIndex } = req.body;

  if (!dimensionId || !name) {
    return res.status(400).json({ success: false, error: 'Dimension ID and Indicator name are required' });
  }

  const id = `ind_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO indicators (id, dimension_id, variable_id, project_id, name, code, definition, description, order_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, dimensionId, variableId, projectId, name.trim(), code || 'IND', definition || null, description || null, orderIndex || 1, now, now);

  res.status(201).json({ success: true, data: { id, dimensionId, variableId, projectId, name, code, definition, description, orderIndex: orderIndex || 1, createdAt: now, updatedAt: now } });
});

apiRouter.delete('/projects/:projectId/indicators/:id', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM indicators WHERE id = ?').run(id);
  res.json({ success: true, message: 'Indicator deleted' });
});

// ==========================================
// 5. RESPONSE SCALES
// ==========================================

apiRouter.get('/projects/:projectId/scales', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const rows = db.prepare(`
    SELECT id, project_id as projectId, name, scale_type as scaleType, min_value as minValue,
           max_value as maxValue, is_archived as isArchived, is_system_preset as isSystemPreset,
           options_json as optionsJson, created_at as createdAt, updated_at as updatedAt
    FROM response_scales WHERE project_id = ? AND is_archived = 0
    ORDER BY is_system_preset DESC, name ASC
  `).all(projectId) as any[];

  const scales = rows.map(r => ({
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    scaleType: r.scaleType,
    minValue: r.minValue,
    maxValue: r.maxValue,
    isArchived: Boolean(r.isArchived),
    isSystemPreset: Boolean(r.isSystemPreset),
    options: JSON.parse(r.optionsJson),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  res.json({ success: true, data: scales });
});

apiRouter.post('/projects/:projectId/scales', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { name, scaleType, minValue, maxValue, options } = req.body;

  if (!name || !options || !Array.isArray(options)) {
    return res.status(400).json({ success: false, error: 'Scale name and options array are required' });
  }

  const id = `scale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO response_scales (id, project_id, name, scale_type, min_value, max_value, is_archived, is_system_preset, options_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
  `).run(id, projectId, name.trim(), scaleType || 'Likert', minValue || 1, maxValue || options.length, JSON.stringify(options), now, now);

  res.status(201).json({
    success: true,
    data: {
      id,
      projectId,
      name,
      scaleType: scaleType || 'Likert',
      minValue: minValue || 1,
      maxValue: maxValue || options.length,
      isArchived: false,
      isSystemPreset: false,
      options,
      createdAt: now,
      updatedAt: now,
    },
  });
});

// ==========================================
// 6. INSTRUMENTS & ITEMS
// ==========================================

apiRouter.get('/projects/:projectId/instruments', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const rows = db.prepare(`
    SELECT id, project_id as projectId, name, code, description, purpose,
           source_type as sourceType, source_reference as sourceReference,
           version, status, variable_ids_json as variableIdsJson,
           created_at as createdAt, updated_at as updatedAt
    FROM instruments WHERE project_id = ? ORDER BY created_at DESC
  `).all(projectId) as any[];

  const instruments = rows.map(r => ({
    ...r,
    variableIds: JSON.parse(r.variableIdsJson),
  }));

  res.json({ success: true, data: instruments });
});

apiRouter.get('/projects/:projectId/instruments/:id', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const row = db.prepare(`
    SELECT id, project_id as projectId, name, code, description, purpose,
           source_type as sourceType, source_reference as sourceReference,
           version, status, variable_ids_json as variableIdsJson,
           created_at as createdAt, updated_at as updatedAt
    FROM instruments WHERE id = ?
  `).get(id) as any;

  if (!row) {
    return res.status(404).json({ success: false, error: 'Instrument not found' });
  }

  const items = db.prepare(`
    SELECT id, instrument_id as instrumentId, project_id as projectId, item_code as itemCode,
           item_number as itemNumber, question_text as questionText, item_type as itemType,
           variable_id as variableId, dimension_id as dimensionId, indicator_id as indicatorId,
           response_scale_id as responseScaleId, required, reverse_coded as reverseCoded,
           status, source, notes, created_at as createdAt, updated_at as updatedAt
    FROM instrument_items WHERE instrument_id = ? ORDER BY item_number ASC
  `).all(id) as any[];

  res.json({
    success: true,
    data: {
      ...row,
      variableIds: JSON.parse(row.variableIdsJson),
      items: items.map(item => ({
        ...item,
        required: Boolean(item.required),
        reverseCoded: Boolean(item.reverseCoded),
      })),
    },
  });
});

apiRouter.post('/projects/:projectId/instruments', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { name, code, description, purpose, sourceType, sourceReference, variableIds } = req.body;

  if (!name || !code) {
    return res.status(400).json({ success: false, error: 'Instrument name and code are required' });
  }

  const id = `inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO instruments (id, project_id, name, code, description, purpose, source_type, source_reference, version, status, variable_ids_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1.0', 'Draft', ?, ?, ?)
  `).run(id, projectId, name.trim(), code.trim(), description || null, purpose || null, sourceType || 'Original Scale', sourceReference || null, JSON.stringify(variableIds || []), now, now);

  res.status(201).json({
    success: true,
    data: {
      id,
      projectId,
      name,
      code,
      description,
      purpose,
      sourceType,
      sourceReference,
      version: '1.0',
      status: 'Draft',
      variableIds: variableIds || [],
      createdAt: now,
      updatedAt: now,
    },
  });
});

apiRouter.post('/projects/:projectId/instruments/:id/items', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId, id } = req.params;
  const { itemCode, itemNumber, questionText, itemType, variableId, dimensionId, indicatorId, responseScaleId, required, reverseCoded, source, notes } = req.body;

  if (!itemCode || !questionText) {
    return res.status(400).json({ success: false, error: 'Item code and question text are required' });
  }

  const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO instrument_items (id, instrument_id, project_id, item_code, item_number, question_text, item_type, variable_id, dimension_id, indicator_id, response_scale_id, required, reverse_coded, status, source, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `).run(itemId, id, projectId, itemCode.trim(), itemNumber || 1, questionText.trim(), itemType || 'Likert', variableId || null, dimensionId || null, indicatorId || null, responseScaleId || null, required ? 1 : 0, reverseCoded ? 1 : 0, source || null, notes || null, now, now);

  res.status(201).json({
    success: true,
    data: {
      id: itemId,
      instrumentId: id,
      projectId,
      itemCode,
      itemNumber: itemNumber || 1,
      questionText,
      itemType: itemType || 'Likert',
      variableId,
      dimensionId,
      indicatorId,
      responseScaleId,
      required: Boolean(required),
      reverseCoded: Boolean(reverseCoded),
      status: 'active',
      source,
      notes,
      createdAt: now,
      updatedAt: now,
    },
  });
});

apiRouter.delete('/projects/:projectId/instruments/:id/items/:itemId', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { itemId } = req.params;
  db.prepare('DELETE FROM instrument_items WHERE id = ?').run(itemId);
  res.json({ success: true, message: 'Item deleted' });
});

// Approve instrument -> creates immutable InstrumentVersion snapshot
apiRouter.post('/projects/:projectId/instruments/:id/approve', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId, id } = req.params;
  const inst = db.prepare('SELECT * FROM instruments WHERE id = ?').get(id) as any;
  if (!inst) {
    return res.status(404).json({ success: false, error: 'Instrument not found' });
  }

  const items = db.prepare('SELECT * FROM instrument_items WHERE instrument_id = ? ORDER BY item_number ASC').all(id) as any[];
  if (items.length === 0) {
    return res.status(400).json({ success: false, error: 'Cannot approve instrument with zero items' });
  }

  const versionId = `iv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  // Create immutable version snapshot
  db.prepare(`
    INSERT INTO instrument_versions (id, instrument_id, project_id, version_number, status, snapshot_json, created_at)
    VALUES (?, ?, ?, ?, 'Approved', ?, ?)
  `).run(versionId, id, projectId, inst.version || '1.0', JSON.stringify({ instrument: inst, items }), now);

  // Update instrument status to Approved
  db.prepare("UPDATE instruments SET status = 'Approved', updated_at = ? WHERE id = ?").run(now, id);

  res.json({ success: true, versionId, message: 'Instrument psychometrically approved and locked into version snapshot.' });
});

// ==========================================
// 7. QUESTIONNAIRES & VERSIONS
// ==========================================

apiRouter.get('/projects/:projectId/questionnaires', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const questionnaires = db.prepare(`
    SELECT id, project_id as projectId, instrument_id as instrumentId, title, description,
           instructions, status, current_version as currentVersion, slug,
           response_mode as responseMode, anonymity_mode as anonymityMode,
           allow_multiple_submissions as allowMultipleSubmissions, close_date as closeDate,
           created_at as createdAt, updated_at as updatedAt
    FROM questionnaires WHERE project_id = ? ORDER BY created_at DESC
  `).all(projectId) as any[];

  res.json({ success: true, data: questionnaires });
});

apiRouter.post('/projects/:projectId/questionnaires', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { instrumentId, title, description, instructions, responseMode, anonymityMode, slug } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, error: 'Title is required' });
  }

  const id = `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const actualSlug = (slug || `survey-${Date.now()}`).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO questionnaires (
      id, project_id, instrument_id, title, description, instructions, status,
      current_version, slug, response_mode, anonymity_mode, allow_multiple_submissions, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'Draft', 1, ?, ?, ?, 0, ?, ?)
  `).run(id, projectId, instrumentId || null, title.trim(), description || null, instructions || null, actualSlug, responseMode || 'anonymous', anonymityMode || 'strict_anonymous', now, now);

  res.status(201).json({
    success: true,
    data: {
      id,
      projectId,
      instrumentId,
      title,
      description,
      instructions,
      status: 'Draft',
      currentVersion: 1,
      slug: actualSlug,
      responseMode: responseMode || 'anonymous',
      anonymityMode: anonymityMode || 'strict_anonymous',
      allowMultipleSubmissions: false,
      createdAt: now,
      updatedAt: now,
    },
  });
});

// Publish Questionnaire (creates immutable QuestionnaireVersion snapshot with items & scales)
apiRouter.post('/projects/:projectId/questionnaires/:id/publish', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId, id } = req.params;
  const { title, instructions, changeSummary, itemsSnapshot, scalesSnapshot } = req.body;

  const q = db.prepare('SELECT * FROM questionnaires WHERE id = ?').get(id) as any;
  if (!q) {
    return res.status(404).json({ success: false, error: 'Questionnaire not found' });
  }

  let finalItems = itemsSnapshot;
  let finalScales = scalesSnapshot;

  // If client did not provide items/scales, take from linked instrument or project
  if (!finalItems || !Array.isArray(finalItems) || finalItems.length === 0) {
    if (q.instrument_id) {
      finalItems = db.prepare('SELECT * FROM instrument_items WHERE instrument_id = ? ORDER BY item_number ASC').all(q.instrument_id);
    }
  }

  if (!finalScales || !Array.isArray(finalScales) || finalScales.length === 0) {
    const scales = db.prepare('SELECT * FROM response_scales WHERE project_id = ?').all(projectId) as any[];
    finalScales = scales.map(s => ({ ...s, options: JSON.parse(s.options_json) }));
  }

  if (!finalItems || finalItems.length === 0) {
    return res.status(400).json({ success: false, error: 'Cannot publish questionnaire without measurement items' });
  }

  const newVersionNumber = (q.current_version || 1) + (q.status === 'Active' ? 1 : 0);
  const versionId = `qv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const auditId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // ATOMIC TRANSACTION: Create immutable version snapshot + activate questionnaire + audit log
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(`
      INSERT INTO questionnaire_versions (
        id, questionnaire_id, project_id, version_number, status, title, instructions,
        items_snapshot_json, scales_snapshot_json, change_summary, published_at, created_at
      ) VALUES (?, ?, ?, ?, 'Published', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      versionId,
      id,
      projectId,
      newVersionNumber,
      title || q.title,
      instructions || q.instructions,
      JSON.stringify(finalItems),
      JSON.stringify(finalScales),
      changeSummary || `Published version ${newVersionNumber}`,
      now,
      now
    );

    // Set questionnaire status to Active
    db.prepare(`
      UPDATE questionnaires SET status = 'Active', current_version = ?, updated_at = ? WHERE id = ?
    `).run(newVersionNumber, now, id);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, project_id, action, entity_type, entity_id, entity_name, timestamp, metadata_json)
      VALUES (?, ?, ?, ?, 'QUESTIONNAIRE_PUBLISHED', 'questionnaire_version', ?, ?, ?, ?)
    `).run(
      auditId,
      req.user!.id,
      req.user!.name,
      projectId,
      versionId,
      `Questionnaire Version ${newVersionNumber}`,
      now,
      JSON.stringify({ questionnaireId: id, versionNumber: newVersionNumber, itemCount: finalItems.length })
    );

    db.exec('COMMIT;');
  } catch (txErr) {
    db.exec('ROLLBACK;');
    console.error('Publish transaction failed:', txErr);
    return res.status(500).json({ success: false, error: 'Failed to publish questionnaire atomically. Transaction rolled back.' });
  }

  res.json({
    success: true,
    versionId,
    versionNumber: newVersionNumber,
    message: `Questionnaire published as version ${newVersionNumber}. Public collection is live.`,
  });
});

// Enforce strict immutability on questionnaire versions
apiRouter.all('/projects/:projectId/questionnaires/:id/versions/:versionId', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  if (['PUT', 'PATCH', 'DELETE', 'POST'].includes(req.method)) {
    return res.status(403).json({
      success: false,
      error: 'Published questionnaire versions are immutable historical snapshots and cannot be modified or deleted. Publish a new version instead.',
    });
  }
  res.status(405).json({ success: false, error: 'Method Not Allowed' });
});

// Pause / Resume / Close questionnaire
apiRouter.post('/projects/:projectId/questionnaires/:id/pause', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  db.prepare("UPDATE questionnaires SET status = 'Paused', updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  res.json({ success: true, status: 'Paused' });
});

apiRouter.post('/projects/:projectId/questionnaires/:id/resume', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  db.prepare("UPDATE questionnaires SET status = 'Active', updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  res.json({ success: true, status: 'Active' });
});

apiRouter.post('/projects/:projectId/questionnaires/:id/close', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  db.prepare("UPDATE questionnaires SET status = 'Closed', updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  res.json({ success: true, status: 'Closed' });
});

// Get questionnaire versions
apiRouter.get('/projects/:projectId/questionnaires/:id/versions', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const rows = db.prepare(`
    SELECT id, questionnaire_id as questionnaireId, project_id as projectId, version_number as versionNumber,
           status, title, instructions, items_snapshot_json as itemsSnapshotJson,
           scales_snapshot_json as scalesSnapshotJson, change_summary as changeSummary,
           published_at as publishedAt, created_at as createdAt
    FROM questionnaire_versions WHERE questionnaire_id = ? ORDER BY version_number DESC
  `).all(id) as any[];

  const versions = rows.map(r => ({
    ...r,
    itemsSnapshot: JSON.parse(r.itemsSnapshotJson),
    scalesSnapshot: JSON.parse(r.scalesSnapshotJson),
  }));

  res.json({ success: true, data: versions });
});

// ==========================================
// 8. RESEARCHER SUBMISSIONS & RAW EXPORT
// ==========================================

apiRouter.get('/projects/:projectId/submissions', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { questionnaireId } = req.query;

  let query = `
    SELECT id, questionnaire_id as questionnaireId, questionnaire_version_id as questionnaireVersionId,
           project_id as projectId, session_id as sessionId, participant_mode as participantMode,
           participant_identifier as participantIdentifier, questionnaire_version as questionnaireVersion,
           started_at as startedAt, submitted_at as submittedAt, duration_seconds as durationSeconds,
           raw_responses_json as rawResponsesJson, raw_item_details_json as rawItemDetailsJson,
           validation_status as validationStatus, validation_flags_json as validationFlagsJson,
           researcher_decision_notes as researcherDecisionNotes, status, created_at as createdAt
    FROM survey_submissions
    WHERE project_id = ?
  `;
  const params: any[] = [projectId];

  if (questionnaireId) {
    query += ' AND questionnaire_id = ?';
    params.push(questionnaireId);
  }

  query += ' ORDER BY submitted_at DESC';

  const rows = db.prepare(query).all(...params) as any[];
  const submissions = rows.map(r => ({
    ...r,
    rawResponses: JSON.parse(r.rawResponsesJson),
    rawItemDetails: JSON.parse(r.rawItemDetailsJson),
    validationFlags: JSON.parse(r.validationFlagsJson),
  }));

  res.json({ success: true, data: submissions });
});

// Enforce strict immutability on raw survey submissions
apiRouter.all('/projects/:projectId/submissions/:id', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response, next) => {
  if (['PUT', 'PATCH', 'POST', 'DELETE'].includes(req.method)) {
    return res.status(403).json({
      success: false,
      error: 'Raw survey submissions are immutable scientific records and cannot be modified or deleted. Validation decisions may be recorded via /submissions/:id/validation.',
    });
  }
  next();
});

// Update submission validation decision (NEVER touches raw_responses_json or provenance fields)
apiRouter.put('/projects/:projectId/submissions/:id/validation', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId, id } = req.params;
  const { validationStatus, researcherDecisionNotes } = req.body;

  // Prevent tampering with any other fields
  const forbiddenKeys = Object.keys(req.body).filter(k => !['validationStatus', 'researcherDecisionNotes'].includes(k));
  if (forbiddenKeys.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Direct modification of submission fields [${forbiddenKeys.join(', ')}] is prohibited. Only validationStatus and researcherDecisionNotes may be updated.`,
    });
  }

  if (!validationStatus || !['Valid', 'Flagged', 'Excluded'].includes(validationStatus)) {
    return res.status(400).json({ success: false, error: 'Valid status must be Valid, Flagged, or Excluded' });
  }

  const existing = db.prepare('SELECT id, validation_status FROM survey_submissions WHERE id = ? AND project_id = ?').get(id, projectId) as any;
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Submission not found in this project' });
  }

  const now = new Date().toISOString();
  const auditId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(`
      UPDATE survey_submissions
      SET validation_status = ?, researcher_decision_notes = ?
      WHERE id = ? AND project_id = ?
    `).run(validationStatus, researcherDecisionNotes || null, id, projectId);

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, project_id, action, entity_type, entity_id, entity_name, timestamp, metadata_json)
      VALUES (?, ?, ?, ?, 'SUBMISSION_VALIDATION_UPDATED', 'survey_submission', ?, ?, ?, ?)
    `).run(
      auditId,
      req.user!.id,
      req.user!.name,
      projectId,
      id,
      `Submission ${id}`,
      now,
      JSON.stringify({ previousStatus: existing.validation_status, newStatus: validationStatus, notes: researcherDecisionNotes || null })
    );

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Failed to update validation decision:', err);
    return res.status(500).json({ success: false, error: 'Failed to update validation decision' });
  }

  res.json({ success: true, message: 'Submission validation status updated.' });
});

// Version-Specific Raw CSV Export (FIXES AUDIT BUG!)
// Each submission is mapped strictly using its own questionnaireVersion snapshot
apiRouter.get('/projects/:projectId/submissions/export-raw', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { questionnaireId, versionId } = req.query;

  let query = 'SELECT * FROM survey_submissions WHERE project_id = ?';
  const params: any[] = [projectId];

  if (questionnaireId) {
    query += ' AND questionnaire_id = ?';
    params.push(questionnaireId);
  }
  if (versionId) {
    query += ' AND questionnaire_version_id = ?';
    params.push(versionId);
  }

  query += ' ORDER BY submitted_at ASC';
  const submissions = db.prepare(query).all(...params) as any[];

  if (submissions.length === 0) {
    return res.type('text/csv').send('submissionId,submittedAt,status\n');
  }

  // Load version snapshots for all submissions
  const versionIds = [...new Set(submissions.map(s => s.questionnaire_version_id))];
  const versionsMap = new Map<string, any>();

  for (const vId of versionIds) {
    const v = db.prepare('SELECT id, version_number, items_snapshot_json FROM questionnaire_versions WHERE id = ?').get(vId) as any;
    if (v) {
      versionsMap.set(v.id, {
        versionNumber: v.version_number,
        items: JSON.parse(v.items_snapshot_json),
      });
    }
  }

  // Collect all item codes in correct order
  // When exporting for a single version, items are exactly that version's items!
  let exportItemCodes: string[] = [];
  if (versionId && versionsMap.has(versionId as string)) {
    exportItemCodes = versionsMap.get(versionId as string)!.items.map((i: any) => i.itemCode);
  } else {
    // If multiple versions, preserve union of distinct items preserving order
    const set = new Set<string>();
    for (const v of versionsMap.values()) {
      for (const it of v.items) {
        if (!set.has(it.itemCode)) {
          set.add(it.itemCode);
          exportItemCodes.push(it.itemCode);
        }
      }
    }
  }

  // Standard metadata headers
  const baseHeaders = [
    'Submission_ID',
    'Questionnaire_Version',
    'Version_ID',
    'Submitted_At',
    'Duration_Seconds',
    'Validation_Status',
    'Participant_ID',
  ];

  const allHeaders = [...baseHeaders, ...exportItemCodes];

  // Build CSV rows
  const csvLines = [allHeaders.join(',')];

  for (const sub of submissions) {
    const rawResponses = JSON.parse(sub.raw_responses_json || '{}');
    const versionInfo = versionsMap.get(sub.questionnaire_version_id);
    const validCodesForThisVersion = new Set(versionInfo?.items.map((i: any) => i.itemCode) || []);

    const row = [
      `"${sub.id}"`,
      sub.questionnaire_version,
      `"${sub.questionnaire_version_id}"`,
      `"${sub.submitted_at}"`,
      sub.duration_seconds,
      `"${sub.validation_status}"`,
      `"${sub.participant_identifier || ''}"`,
    ];

    for (const code of exportItemCodes) {
      if (validCodesForThisVersion.has(code)) {
        const val = rawResponses[code];
        row.push(val !== undefined && val !== null ? `"${String(val).replace(/"/g, '""')}"` : '""');
      } else {
        // Item was not part of this submission's questionnaire version
        row.push('""');
      }
    }

    csvLines.push(row.join(','));
  }

  res.setHeader('Content-Disposition', `attachment; filename="raw_submissions_${projectId}.csv"`);
  res.type('text/csv').send(csvLines.join('\n'));
});

// ==========================================
// 9. DATA PROCESSING (STAGE 6)
// ==========================================

apiRouter.get('/projects/:projectId/processing/runs', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const runs = db.prepare(`
    SELECT id, project_id as projectId, questionnaire_id as questionnaireId,
           questionnaire_version_id as questionnaireVersionId, created_by as createdBy,
           created_at as createdAt, status, source_submission_count as sourceSubmissionCount,
           valid_record_count as validRecordCount, excluded_record_count as excludedRecordCount,
           rules_snapshot_json as rulesSnapshotJson, error_count as errorCount,
           warning_count as warningCount, notes
    FROM processing_runs WHERE project_id = ? ORDER BY created_at DESC
  `).all(projectId) as any[];

  res.json({
    success: true,
    data: runs.map(r => ({ ...r, rulesSnapshot: JSON.parse(r.rulesSnapshotJson) })),
  });
});

apiRouter.get('/projects/:projectId/processing/runs/:runId/dataset', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { runId } = req.params;
  const ds = db.prepare('SELECT columns_json as columnsJson, records_json as recordsJson FROM processed_datasets WHERE processing_run_id = ?').get(runId) as any;
  if (!ds) {
    return res.status(404).json({ success: false, error: 'Processed dataset not found' });
  }

  res.json({
    success: true,
    data: {
      columns: JSON.parse(ds.columnsJson),
      records: JSON.parse(ds.recordsJson),
    },
  });
});

apiRouter.post('/projects/:projectId/processing/run', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { questionnaireId, questionnaireVersionId, rulesSnapshot, processedColumns, processedRecords, codebookEntries } = req.body;

  const runId = `proc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const auditId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const validCount = processedRecords.filter((r: any) => r.exclusionStatus === 'Included' || !r.exclusionStatus).length;
  const excludedCount = processedRecords.length - validCount;

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(`
      INSERT INTO processing_runs (
        id, project_id, questionnaire_id, questionnaire_version_id, created_by,
        created_at, status, source_submission_count, valid_record_count, excluded_record_count,
        rules_snapshot_json, error_count, warning_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 'Completed', ?, ?, ?, ?, 0, 0, 'Deterministic server processing completed')
    `).run(
      runId,
      projectId,
      questionnaireId,
      questionnaireVersionId,
      req.user!.id,
      now,
      processedRecords.length,
      validCount,
      excludedCount,
      JSON.stringify(rulesSnapshot || {})
    );

    db.prepare(`
      INSERT INTO processed_datasets (id, processing_run_id, project_id, columns_json, records_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`ds_${runId}`, runId, projectId, JSON.stringify(processedColumns || []), JSON.stringify(processedRecords || []), now);

    if (codebookEntries) {
      db.prepare(`
        INSERT INTO codebooks (id, project_id, processing_run_id, questionnaire_version_id, version, entries_json, created_at)
        VALUES (?, ?, ?, ?, '1.0', ?, ?)
      `).run(`cb_${runId}`, projectId, runId, questionnaireVersionId, JSON.stringify(codebookEntries), now);
    }

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, project_id, action, entity_type, entity_id, entity_name, timestamp, metadata_json)
      VALUES (?, ?, ?, ?, 'PROCESSING_RUN_COMPLETED', 'processing_run', ?, ?, ?, ?)
    `).run(
      auditId,
      req.user!.id,
      req.user!.name,
      projectId,
      runId,
      `Processing Run ${runId}`,
      now,
      JSON.stringify({ validCount, excludedCount, total: processedRecords.length })
    );

    db.exec('COMMIT;');
  } catch (txErr) {
    db.exec('ROLLBACK;');
    console.error('Processing run transaction failed:', txErr);
    return res.status(500).json({ success: false, error: 'Failed to record processing run atomically.' });
  }

  res.status(201).json({ success: true, runId, validCount, excludedCount });
});

// Enforce strict immutability on processing runs
apiRouter.all('/projects/:projectId/processing/runs/:runId', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response, next) => {
  if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(403).json({
      success: false,
      error: 'Processing runs are immutable historical records and cannot be modified or deleted.',
    });
  }
  next();
});

// ==========================================
// 10. SCORING (STAGE 7)
// ==========================================

apiRouter.get('/projects/:projectId/scoring/rules', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const rules = db.prepare(`
    SELECT id, project_id as projectId, target_type as targetType, target_id as targetId,
           target_code as targetCode, target_name as targetName, method, source_type as sourceType,
           source_item_ids_json as sourceItemIdsJson, source_item_codes_json as sourceItemCodesJson,
           missing_value_policy as missingValuePolicy, minimum_required_items as minimumRequiredItems,
           expected_range_json as expectedRangeJson, version, created_at as createdAt, updated_at as updatedAt
    FROM scoring_rules WHERE project_id = ?
  `).all(projectId) as any[];

  res.json({
    success: true,
    data: rules.map(r => ({
      ...r,
      sourceItemIds: r.sourceItemIdsJson ? JSON.parse(r.sourceItemIdsJson) : [],
      sourceItemCodes: r.sourceItemCodesJson ? JSON.parse(r.sourceItemCodesJson) : [],
      expectedRange: r.expectedRangeJson ? JSON.parse(r.expectedRangeJson) : null,
    })),
  });
});

apiRouter.post('/projects/:projectId/scoring/rules', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { targetType, targetId, targetCode, targetName, method, sourceType, sourceItemIds, sourceItemCodes, missingValuePolicy, minimumRequiredItems, expectedRange } = req.body;

  const id = `srule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO scoring_rules (
      id, project_id, target_type, target_id, target_code, target_name, method, source_type,
      source_item_ids_json, source_item_codes_json, missing_value_policy, minimum_required_items,
      expected_range_json, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    projectId,
    targetType || 'Dimension',
    targetId,
    targetCode,
    targetName,
    method || 'Mean',
    sourceType || 'Items',
    JSON.stringify(sourceItemIds || []),
    JSON.stringify(sourceItemCodes || []),
    missingValuePolicy || 'ExcludeRecord',
    minimumRequiredItems || 1,
    expectedRange ? JSON.stringify(expectedRange) : null,
    now,
    now
  );

  res.status(201).json({ success: true, id });
});

apiRouter.get('/projects/:projectId/scoring/runs', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const runs = db.prepare(`
    SELECT id, project_id as projectId, processing_run_id as processingRunId,
           questionnaire_id as questionnaireId, questionnaire_version_id as questionnaireVersionId,
           created_by as createdBy, created_at as createdAt, status,
           source_record_count as sourceRecordCount, scored_record_count as scoredRecordCount,
           rules_snapshot_json as rulesSnapshotJson, notes
    FROM scoring_runs WHERE project_id = ? ORDER BY created_at DESC
  `).all(projectId) as any[];

  res.json({
    success: true,
    data: runs.map(r => ({ ...r, rulesSnapshot: JSON.parse(r.rulesSnapshotJson) })),
  });
});

apiRouter.get('/projects/:projectId/scoring/runs/:runId/dataset', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { runId } = req.params;
  const ds = db.prepare('SELECT columns_json as columnsJson, records_json as recordsJson, summary_statistics_json as statsJson FROM scored_datasets WHERE scoring_run_id = ?').get(runId) as any;
  if (!ds) {
    return res.status(404).json({ success: false, error: 'Scored dataset not found' });
  }

  res.json({
    success: true,
    data: {
      columns: JSON.parse(ds.columnsJson),
      records: JSON.parse(ds.recordsJson),
      summaryStatistics: ds.statsJson ? JSON.parse(ds.statsJson) : null,
    },
  });
});

apiRouter.post('/projects/:projectId/scoring/run', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { processingRunId, questionnaireId, questionnaireVersionId, rulesSnapshot, scoredColumns, scoredRecords, summaryStatistics } = req.body;

  const runId = `scrun_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const auditId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(`
      INSERT INTO scoring_runs (
        id, project_id, processing_run_id, questionnaire_id, questionnaire_version_id,
        created_by, created_at, status, source_record_count, scored_record_count,
        rules_snapshot_json, error_count, warning_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 'Completed', ?, ?, ?, 0, 0, 'Deterministic server scoring run completed')
    `).run(
      runId,
      projectId,
      processingRunId,
      questionnaireId,
      questionnaireVersionId,
      req.user!.id,
      now,
      scoredRecords.length,
      scoredRecords.length,
      JSON.stringify(rulesSnapshot || {})
    );

    db.prepare(`
      INSERT INTO scored_datasets (id, scoring_run_id, processing_run_id, project_id, columns_json, records_json, summary_statistics_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`sds_${runId}`, runId, processingRunId, projectId, JSON.stringify(scoredColumns || []), JSON.stringify(scoredRecords || []), summaryStatistics ? JSON.stringify(summaryStatistics) : null, now);

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, project_id, action, entity_type, entity_id, entity_name, timestamp, metadata_json)
      VALUES (?, ?, ?, ?, 'SCORING_RUN_COMPLETED', 'scoring_run', ?, ?, ?, ?)
    `).run(
      auditId,
      req.user!.id,
      req.user!.name,
      projectId,
      runId,
      `Scoring Run ${runId}`,
      now,
      JSON.stringify({ scoredCount: scoredRecords.length })
    );

    db.exec('COMMIT;');
  } catch (txErr) {
    db.exec('ROLLBACK;');
    console.error('Scoring run transaction failed:', txErr);
    return res.status(500).json({ success: false, error: 'Failed to record scoring run atomically.' });
  }

  res.status(201).json({ success: true, runId, scoredCount: scoredRecords.length });
});

// Enforce strict immutability on scoring runs
apiRouter.all('/projects/:projectId/scoring/runs/:runId', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response, next) => {
  if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(403).json({
      success: false,
      error: 'Scoring runs are immutable historical records and cannot be modified or deleted.',
    });
  }
  next();
});

// ==========================================
// 11. AUDIT LOGS
// ==========================================

apiRouter.get('/projects/:projectId/audit-logs', authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const logs = db.prepare(`
    SELECT id, user_id as userId, user_name as userName, project_id as projectId,
           action, entity_type as entityType, entity_id as entityId, entity_name as entityName,
           timestamp, metadata_json as metadataJson
    FROM audit_logs WHERE project_id = ? ORDER BY timestamp DESC
  `).all(projectId) as any[];

  res.json({
    success: true,
    data: logs.map(l => ({ ...l, metadata: l.metadataJson ? JSON.parse(l.metadataJson) : null })),
  });
});

// Enforce strict tamper-evident append-only policy on audit logs
apiRouter.all(['/projects/:projectId/audit-logs', '/projects/:projectId/audit-logs/:id'], authenticate, requireProjectAccess, (req: AuthenticatedRequest, res: Response, next) => {
  if (['DELETE', 'PUT', 'PATCH', 'POST'].includes(req.method)) {
    return res.status(403).json({
      success: false,
      error: 'Audit logs are tamper-evident, append-only scientific records. Direct modification or deletion is strictly prohibited.',
    });
  }
  next();
});

// ==========================================
// 12. LOCAL STORAGE DATA INGESTION / MIGRATION
// ==========================================

apiRouter.post('/migration/upload', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { projects, instruments, questionnaires, questionnaireVersions, submissions } = req.body;

  let importedCount = 0;

  if (Array.isArray(projects)) {
    for (const p of projects) {
      const exists = db.prepare('SELECT id FROM projects WHERE id = ?').get(p.id);
      if (!exists) {
        db.prepare(`
          INSERT INTO projects (
            id, user_id, title, research_topic, research_objective, research_method,
            population, sample_description, research_design, status, is_demo, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          p.id,
          p.userId || userId,
          p.title,
          p.researchTopic || null,
          p.researchObjective || null,
          p.researchMethod || null,
          p.population || null,
          p.sampleDescription || null,
          p.researchDesign || null,
          p.status || 'Draft',
          p.isDemo ? 1 : 0,
          p.createdAt || new Date().toISOString(),
          p.updatedAt || new Date().toISOString()
        );
        importedCount++;
      }
    }
  }

  res.json({ success: true, importedCount, message: `Successfully synced ${importedCount} records into durable database.` });
});

// ==========================================
// 13. SYSTEM & DATABASE ADMINISTRATION / BACKUP / RESTORE
// ==========================================

apiRouter.post('/admin/backup', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const backup = createDatabaseBackup(req.body?.label);
    res.json({ success: true, backup });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/admin/backups', authenticate, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const backups = listBackups();
    res.json({ success: true, backups });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/admin/restore-test', authenticate, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const report = runRestoreTest();
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/admin/integrity-check', authenticate, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = verifyDatabaseIntegrity();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
