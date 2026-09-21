import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from './db.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  institution?: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function createSession(userId: string): { token: string; user: AuthUser; expiresAt: string } {
  const user = db.prepare('SELECT id, name, email, institution, role FROM users WHERE id = ?').get(userId) as AuthUser | undefined;
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const token = `sess_${crypto.randomBytes(32).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  db.prepare(`
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, now.toISOString(), expiresAt);

  return { token, user, expiresAt };
}

export function getSessionUser(token: string): AuthUser | null {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.institution, u.role, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token) as (AuthUser & { expires_at: string }) | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    institution: row.institution,
    role: row.role,
  };
}

export function revokeSession(token: string): boolean {
  if (!token) return false;
  const result = db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  return result.changes > 0;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Valid researcher session token is required',
    });
  }

  const token = authHeader.substring(7).trim();
  const user = getSessionUser(token);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Session expired or invalid',
    });
  }

  req.user = user;
  next();
}

export function verifyProjectAccess(userId: string, projectId: string): boolean {
  if (!userId || !projectId) return false;
  const row = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  return Boolean(row);
}

export function requireProjectAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const projectId = req.params.projectId || req.params.id;
  if (!projectId) {
    return res.status(400).json({ success: false, error: 'Project ID is required' });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const hasAccess = verifyProjectAccess(userId, projectId);
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Researcher ${userId} does not have access to project ${projectId}`,
    });
  }

  next();
}
