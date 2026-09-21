/**
 * Local Storage Layer - Strictly restricted to UI preferences and active session tokens.
 * Domain entities (projects, variables, instruments, questionnaires, submissions, audit logs, etc.)
 * are exclusively stored on the authoritative server database.
 */

const PREFIX = 'qrp_v1_';

const FORBIDDEN_DOMAIN_KEYS = [
  'projects',
  'variables',
  'response_scales',
  'instruments',
  'instrument_items',
  'instrument_versions',
  'questionnaires',
  'questionnaire_versions',
  'survey_submissions',
  'audit_logs',
  'processing_runs',
  'processed_datasets',
  'codebooks',
  'scoring_rules',
  'scoring_runs',
  'scored_datasets',
  'ai_generations',
  'ai_candidates',
];

export const storage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const serialized = localStorage.getItem(`${PREFIX}${key}`);
      if (serialized === null) {
        return defaultValue;
      }
      return JSON.parse(serialized) as T;
    } catch (error) {
      console.error(`Storage error loading key "${key}":`, error);
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): boolean {
    if (FORBIDDEN_DOMAIN_KEYS.includes(key)) {
      console.warn(`[STORAGE INTEGRITY] Attempt to store domain data "${key}" in browser localStorage blocked. Use authoritative server database repositories.`);
      return false;
    }
    try {
      localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Storage error saving key "${key}":`, error);
      return false;
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(`${PREFIX}${key}`);
    } catch (error) {
      console.error(`Storage error removing key "${key}":`, error);
    }
  },

  clearDomainData(): void {
    try {
      FORBIDDEN_DOMAIN_KEYS.forEach(key => {
        localStorage.removeItem(`${PREFIX}${key}`);
      });
    } catch (error) {
      console.error('Storage error clearing domain data:', error);
    }
  },

  clearAll(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (error) {
      console.error('Storage error clearing data:', error);
    }
  }
};

