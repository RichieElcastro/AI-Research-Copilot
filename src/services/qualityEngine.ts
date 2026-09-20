/**
 * Quality Check Engine for Quantitative Research Items
 * Implements deterministic psychometric heuristics, bias detection, and duplicate detection
 */

export interface QualityIssue {
  type: 'error' | 'warning' | 'info';
  category:
    | 'double_barreled'
    | 'leading_loaded'
    | 'excessive_length'
    | 'double_negative'
    | 'extreme_qualifier'
    | 'duplicate_risk'
    | 'scale_mismatch';
  message: string;
  matchedPhrase?: string;
}

// Tokenize text into normalized lower-case words
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

// Compute Jaccard token similarity (0.0 to 1.0)
export function computeTokenSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) {
      intersection++;
    }
  }

  const union = tokens1.size + tokens2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const qualityEngine = {
  /**
   * Evaluates question text against deterministic psychometric guidelines
   */
  checkItemQuality(
    questionText: string,
    scaleType?: string,
    reverseCoded?: boolean
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const text = questionText.trim();
    const lower = text.toLowerCase();

    if (!text) {
      issues.push({
        type: 'error',
        category: 'excessive_length',
        message: 'Question text is empty.',
      });
      return issues;
    }

    // 1. Double-barreled wording detection
    const doubleBarreledPatterns = [
      /\b(and also|as well as|while at the same time|while also|along with)\b/i,
      /\b(dan juga|serta|sekaligus|di samping itu)\b/i,
    ];
    for (const pattern of doubleBarreledPatterns) {
      const match = text.match(pattern);
      if (match) {
        issues.push({
          type: 'warning',
          category: 'double_barreled',
          message:
            'Potential double-barreled statement: connects multiple distinct predicates or thoughts.',
          matchedPhrase: match[0],
        });
        break;
      }
    }

    // 2. Leading or loaded wording detection
    const leadingPatterns = [
      /\b(obviously|clearly|naturally|everyone knows|undeniably|without doubt)\b/i,
      /\b(tentu saja|jelas bahwa|sudah pasti|semua orang tahu)\b/i,
    ];
    for (const pattern of leadingPatterns) {
      const match = text.match(pattern);
      if (match) {
        issues.push({
          type: 'warning',
          category: 'leading_loaded',
          message:
            'Potential leading/loaded wording: suggests a socially desirable response.',
          matchedPhrase: match[0],
        });
        break;
      }
    }

    // 3. Excessive length check
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 25 || text.length > 150) {
      issues.push({
        type: 'warning',
        category: 'excessive_length',
        message: `Statement is overly lengthy (${words.length} words, ${text.length} chars). Concise items under 22 words reduce participant cognitive fatigue.`,
      });
    }

    // 4. Double negative detection
    const doubleNegativePatterns = [
      /\b(not (unhappy|disagree|unpleasant|impossible|unlikely|incapable|rarely))\b/i,
      /\b(tidak (tidak|bukan|jarang|mustahil))\b/i,
    ];
    for (const pattern of doubleNegativePatterns) {
      const match = text.match(pattern);
      if (match) {
        issues.push({
          type: 'warning',
          category: 'double_negative',
          message:
            'Double negative phrasing detected: can confuse respondents and inflate error variance.',
          matchedPhrase: match[0],
        });
        break;
      }
    }

    // 5. Extreme qualifiers check (caution)
    const extremePatterns = [
      /\b(always|never|completely|impossible|every single time)\b/i,
      /\b(selalu|tidak pernah|sama sekali tidak|pasti selalu)\b/i,
    ];
    for (const pattern of extremePatterns) {
      const match = text.match(pattern);
      if (match && !reverseCoded) {
        issues.push({
          type: 'info',
          category: 'extreme_qualifier',
          message:
            'Absolute qualifier used: absolute words like "always" or "never" may create floor or ceiling response clustering.',
          matchedPhrase: match[0],
        });
        break;
      }
    }

    // 6. Scale type mismatch check
    if (scaleType === 'Frequency') {
      if (lower.startsWith('i agree that') || lower.startsWith('saya setuju bahwa')) {
        issues.push({
          type: 'warning',
          category: 'scale_mismatch',
          message:
            'Agreement phrasing used with a Frequency scale. Frequency scales require behavioral or temporal statements.',
        });
      }
    }

    return issues;
  },

  /**
   * Compares a candidate text against existing items and flags duplicate risks
   */
  findDuplicates(
    candidateText: string,
    existingItems: { id: string; itemCode?: string; questionText: string }[]
  ): { targetId: string; itemCode?: string; similarity: number; text: string }[] {
    const duplicates = [];

    for (const item of existingItems) {
      const sim = computeTokenSimilarity(candidateText, item.questionText);
      if (sim >= 0.65) {
        duplicates.push({
          targetId: item.id,
          itemCode: item.itemCode,
          similarity: Math.round(sim * 100),
          text: item.questionText,
        });
      }
    }

    return duplicates.sort((a, b) => b.similarity - a.similarity);
  },
};
