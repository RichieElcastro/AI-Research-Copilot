import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Prompt Version constant for audit lineage
export const PROMPT_VERSION = 'questionnaire_generator_v1';

interface GenerateRequest {
  projectId: string;
  instrumentId: string;
  variableName: string;
  variableDefinition?: string;
  operationalDefinition?: string;
  dimensionName?: string;
  dimensionDefinition?: string;
  indicatorName: string;
  indicatorDefinition?: string;
  targetPopulation?: string;
  responseScaleName?: string;
  responseScaleType?: string;
  responseScaleOptions?: { value: number; label: string }[];
  numberOfItems?: number;
  language?: 'English' | 'Indonesian';
  additionalInstructions?: string;
}

// Deterministic rule-based item generator for Demo Mode or API fallback
function generateDemoCandidates(req: GenerateRequest, promptVersion: string) {
  const count = Math.min(Math.max(req.numberOfItems || 4, 1), 10);
  const lang = req.language === 'Indonesian' ? 'Indonesian' : 'English';
  const ind = req.indicatorName || 'the target indicator';
  const dim = req.dimensionName || req.variableName;
  const pop = req.targetPopulation || 'participants';
  const scaleType = req.responseScaleType || 'Likert';

  const items = [];

  if (lang === 'Indonesian') {
    const indonesianTemplates = [
      {
        text: `Saya secara konsisten memperhatikan ${ind.toLowerCase()} dalam aktivitas akademik saya sehari-hari.`,
        rev: false,
        note: 'Pernyataan langsung yang terfokus pada indikator spesifik.',
      },
      {
        text: `Ketika berhadapan dengan situasi terkait ${dim.toLowerCase()}, saya memprioritaskan ${ind.toLowerCase()}.`,
        rev: false,
        note: 'Menilai perilaku spesifik yang relevan dengan populasi sasaran.',
      },
      {
        text: `Saya merasa sulit untuk mengelola ${ind.toLowerCase()} saat menghadapi beban tugas yang tinggi.`,
        rev: true,
        note: 'Item negatively-keyed untuk mendeteksi acquiescence bias.',
      },
      {
        text: `Pengalaman saya mengenai ${ind.toLowerCase()} mempengaruhi keputusan belajar saya secara nyata.`,
        rev: false,
        note: 'Fokus pada dampak langsung indikator terhadap construct.',
      },
      {
        text: `Saya jarang meluangkan waktu untuk mengevaluasi ${ind.toLowerCase()} yang saya miliki.`,
        rev: true,
        note: 'Item negatively-keyed untuk mengukur konsistensi respon.',
      },
    ];

    for (let i = 0; i < count; i++) {
      const template = indonesianTemplates[i % indonesianTemplates.length];
      items.push({
        candidateId: `cand_demo_${Date.now()}_${i + 1}`,
        questionText: template.text,
        suggestedItemType: 'Likert',
        reverseCoded: template.rev,
        qualityNotes: [
          template.note,
          `Disesuaikan untuk skala ${scaleType} dengan populasi ${pop}.`,
        ],
        potentialIssues: [],
        confidence: 'high' as const,
      });
    }
  } else {
    const englishTemplates = [
      {
        text: `I consistently demonstrate ${ind.toLowerCase()} when engaging with relevant daily tasks.`,
        rev: false,
        note: 'Direct behavioral indicator mapping without double-barreling.',
      },
      {
        text: `When navigating situations related to ${dim.toLowerCase()}, I consciously prioritize ${ind.toLowerCase()}.`,
        rev: false,
        note: 'Contextualized for empirical observable behavior in the target population.',
      },
      {
        text: `I find it challenging to maintain ${ind.toLowerCase()} under demanding conditions.`,
        rev: true,
        note: 'Negatively keyed statement to mitigate acquiescence response bias.',
      },
      {
        text: `My degree of ${ind.toLowerCase()} directly influences how I approach academic objectives.`,
        rev: false,
        note: 'Single-construct measurement statement tailored for the construct definition.',
      },
      {
        text: `I rarely devote conscious effort to managing my ${ind.toLowerCase()}.`,
        rev: true,
        note: 'Negatively keyed item evaluating baseline self-regulation.',
      },
    ];

    for (let i = 0; i < count; i++) {
      const template = englishTemplates[i % englishTemplates.length];
      items.push({
        candidateId: `cand_demo_${Date.now()}_${i + 1}`,
        questionText: template.text,
        suggestedItemType: 'Likert',
        reverseCoded: template.rev,
        qualityNotes: [
          template.note,
          `Construct-tailored for ${scaleType} scale and ${pop} target group.`,
        ],
        potentialIssues: [],
        confidence: 'high' as const,
      });
    }
  }

  return {
    generationId: `gen_demo_${Date.now()}`,
    isDemoMode: true,
    model: 'demo-rule-generator',
    promptVersion,
    items,
    generationNotes: [
      'Demo Mode: Generated using deterministic scientific psychometric templates.',
      'To enable live Gemini generation, configure GEMINI_API_KEY in the environment.',
    ],
    warnings: [] as string[],
  };
}

// POST /api/ai/generate-items
app.post('/api/ai/generate-items', async (req, res) => {
  try {
    const {
      projectId,
      instrumentId,
      variableName,
      variableDefinition,
      operationalDefinition,
      dimensionName,
      dimensionDefinition,
      indicatorName,
      indicatorDefinition,
      targetPopulation,
      responseScaleName,
      responseScaleType,
      responseScaleOptions,
      numberOfItems = 4,
      language = 'English',
      additionalInstructions,
    } = req.body as GenerateRequest;

    if (!projectId || !instrumentId || !variableName || !indicatorName) {
      return res.status(400).json({
        error: 'Missing required fields: projectId, instrumentId, variableName, and indicatorName are mandatory.',
      });
    }

    const requestedCount = Math.min(Math.max(Number(numberOfItems) || 4, 1), 10);
    const selectedLanguage = language === 'Indonesian' ? 'Indonesian' : 'English';
    const apiKey = process.env.GEMINI_API_KEY;

    // Fall back to transparent Demo Generator if no key is configured or requested
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      const demoResult = generateDemoCandidates(req.body, PROMPT_VERSION);
      return res.json(demoResult);
    }

    // Call Gemini API via @google/genai
    const ai = new GoogleGenAI({ apiKey });

    const scaleOptionsStr = (responseScaleOptions || [])
      .map((opt) => `${opt.value} = ${opt.label}`)
      .join(', ');

    const systemInstruction = `You are a quantitative research measurement specialist and psychometrician.
Your objective is to generate candidate questionnaire items (measurement statements) for empirical research.
You MUST adhere strictly to scientific survey design standards:
1. FOCUS: Generate items that operationalize the specific INDICATOR within the designated DIMENSION and VARIABLE.
2. SCALE COMPATIBILITY: Word statements to align with the response scale (${responseScaleType || 'Likert'}: ${scaleOptionsStr || '1 to 5'}). For Agreement scales, provide declarative statements. For Frequency scales, describe habitual behaviors.
3. ANTI-BIAS RULES:
   - NEVER create double-barreled questions (avoid combining two clauses with 'and', 'as well as', 'while also').
   - NEVER create leading or loaded questions.
   - Avoid extreme qualifiers ('always', 'never', 'completely') unless theoretically necessary.
   - Keep statements concise (under 25 words).
   - Create exactly 1 or 2 negatively-keyed (reverse-scored) items to mitigate acquiescence bias, marked clearly with reverseCoded: true.
4. LANGUAGE: Generate in ${selectedLanguage}. For Indonesian, use natural, grammatically sound Indonesian suitable for the target population (${targetPopulation || 'university students'}).
5. NO FABRICATION: Do NOT invent citations, authors, empirical validity statistics, or claim the items are already psychometrically validated. They are candidate items awaiting researcher review.

You MUST respond strictly in valid JSON matching this structure:
{
  "items": [
    {
      "candidateId": "cand_1",
      "questionText": "Clear measurement statement...",
      "suggestedItemType": "Likert",
      "reverseCoded": false,
      "qualityNotes": ["Why this maps to the indicator"],
      "potentialIssues": ["Any potential ambiguity or note"],
      "confidence": "high"
    }
  ],
  "generationNotes": ["Brief psychometric observation"],
  "warnings": []
}`;

    const userPrompt = `Generate exactly ${requestedCount} candidate measurement items for this research context:
- Variable: "${variableName}"
  Conceptual Definition: "${variableDefinition || 'N/A'}"
  Operational Definition: "${operationalDefinition || 'N/A'}"
- Dimension: "${dimensionName || 'N/A'}"
  Dimension Definition: "${dimensionDefinition || 'N/A'}"
- Indicator: "${indicatorName}"
  Indicator Definition: "${indicatorDefinition || 'N/A'}"
- Target Population: "${targetPopulation || 'University Students'}"
- Response Scale: "${responseScaleName || 'Likert 5-point'}" (${scaleOptionsStr})
- Language: ${selectedLanguage}
- Additional Researcher Instructions: "${additionalInstructions || 'None'}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseErr) {
      console.warn('Failed to parse Gemini JSON response directly, cleaning markdown wrapper...', parseErr);
      const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const formattedItems = items.map((item: any, idx: number) => ({
      candidateId: item.candidateId || `cand_ai_${Date.now()}_${idx + 1}`,
      questionText: String(item.questionText || '').trim(),
      suggestedItemType: item.suggestedItemType || 'Likert',
      reverseCoded: Boolean(item.reverseCoded),
      qualityNotes: Array.isArray(item.qualityNotes) ? item.qualityNotes : [],
      potentialIssues: Array.isArray(item.potentialIssues) ? item.potentialIssues : [],
      confidence: item.confidence === 'low' || item.confidence === 'medium' ? item.confidence : 'high',
    }));

    return res.json({
      generationId: `gen_ai_${Date.now()}`,
      isDemoMode: false,
      model: 'gemini-3.8-flash',
      promptVersion: PROMPT_VERSION,
      items: formattedItems,
      generationNotes: Array.isArray(parsed?.generationNotes) ? parsed.generationNotes : [],
      warnings: Array.isArray(parsed?.warnings) ? parsed.warnings : [],
    });
  } catch (err: any) {
    console.error('Error generating AI items via Gemini API:', err);
    // Graceful fallback to transparent demo mode if Gemini API throws (e.g. invalid key or network)
    const fallbackResult = generateDemoCandidates(req.body, PROMPT_VERSION);
    fallbackResult.warnings.push(`Gemini API connection error: ${err.message || 'Unknown'}. Served via scientific rule-based Demo Generator.`);
    return res.json(fallbackResult);
  }
});

// Vite middleware and production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quantitative Research Platform server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
