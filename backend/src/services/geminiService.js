const { GoogleGenAI } = require("@google/genai");

const MODEL_COOLDOWN_MS = Number(process.env.GEMINI_MODEL_COOLDOWN_MS || 60_000);
const modelCooldownUntil = new Map();

class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

const summaryLengthInstructions = {
  short: "about 3-5 sentences",
  medium: "about 8-10 sentences",
  long: "about 12-15 sentences",
};

const formatInstructions = {
  paragraph: "Return a cohesive plain-text paragraph style summary.",
  bullet: "Return a concise plain-text bullet-point summary with each bullet on a new line starting with '- '.",
};

const toneInstructions = {
  formal: "Use professional and formal wording.",
  simple: "Use simple and easy-to-understand wording.",
};

const depthInstructions = {
  basic: "Focus on high-level ideas and avoid deep technical detail.",
  balanced: "Provide a balanced explanation with moderate detail and practical clarity.",
  detailed: "Provide detailed explanation with important nuances and supporting context.",
  technical: "Include deeper technical and conceptual details where relevant.",
  expert: "Provide expert-level depth including advanced concepts, assumptions, and implications.",
};

const audienceInstructions = {
  student: "Write for students who want clear learning-oriented explanations.",
  professional: "Write for professionals who need concise and actionable insights.",
};

const isModelNotFoundError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("is not supported for generatecontent")
  );
};

const isRetryableModelError = (error) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("429") ||
    message.includes("quota exceeded") ||
    message.includes("resource_exhausted") ||
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    message.includes("temporarily") ||
    message.includes("try again later") ||
    message.includes("deadline exceeded") ||
    message.includes("timeout")
  );
};

const mapGeminiErrorMessage = (error) => {
  const message = String(error?.message || "");
  const normalized = message.toLowerCase();

  if (normalized.includes("429") || normalized.includes("quota exceeded")) {
    return "Gemini API quota exceeded. Please check billing/quota or try again later.";
  }

  if (normalized.includes("401") || normalized.includes("api key not valid")) {
    return "Gemini API key is invalid or unauthorized. Update GEMINI_API_KEY in backend .env.";
  }

  return message || "Failed to generate summary with Gemini.";
};

const extractTextFromResponse = (response) => {
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  if (Array.isArray(response?.candidates)) {
    const candidateText = response.candidates
      .flatMap((candidate) => candidate?.content?.parts || [])
      .map((part) => part?.text || "")
      .join(" ")
      .trim();

    if (candidateText) {
      return candidateText;
    }
  }

  return "";
};

const parseJsonFromText = (text) => {
  const direct = text.trim();
  try {
    return JSON.parse(direct);
  } catch (error) {
    const startIndex = direct.indexOf("{");
    const endIndex = direct.lastIndexOf("}");
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return null;
    }

    const candidate = direct.slice(startIndex, endIndex + 1);
    try {
      return JSON.parse(candidate);
    } catch (innerError) {
      return null;
    }
  }
};

const getAiClientAndModels = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const candidateModels = [
    "gemini-3-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ];

  const uniqueModels = [...new Set(candidateModels)];

  if (!apiKey) {
    throw new ApiError("Missing GEMINI_API_KEY in backend environment.", 500);
  }

  return {
    ai: new GoogleGenAI({ apiKey }),
    candidateModels: uniqueModels,
  };
};

const isModelInCooldown = (modelName) => {
  const cooldownUntil = modelCooldownUntil.get(modelName) || 0;
  return Date.now() < cooldownUntil;
};

const setModelCooldown = (modelName) => {
  modelCooldownUntil.set(modelName, Date.now() + MODEL_COOLDOWN_MS);
};

const clearModelCooldown = (modelName) => {
  modelCooldownUntil.delete(modelName);
};

const generateTextWithFallback = async (prompt) => {
  const { ai, candidateModels } = getAiClientAndModels();
  let lastError;
  const triedModels = [];
  const skippedForCooldown = [];

  for (const modelName of candidateModels) {
    if (isModelInCooldown(modelName)) {
      skippedForCooldown.push(modelName);
      continue;
    }

    triedModels.push(modelName);

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });
      const outputText = extractTextFromResponse(response);

      if (!outputText || !outputText.trim()) {
        throw new ApiError("Gemini returned an empty response.", 502);
      }

      clearModelCooldown(modelName);

      return outputText.trim();
    } catch (error) {
      lastError = error;

      if (isModelNotFoundError(error) || isRetryableModelError(error)) {
        setModelCooldown(modelName);
        continue;
      }

      throw new ApiError(mapGeminiErrorMessage(error), 502);
    }
  }

  if (triedModels.length === 0 && skippedForCooldown.length > 0) {
    throw new ApiError(
      `All configured Gemini models are cooling down after recent limits. Please retry in about ${Math.ceil(
        MODEL_COOLDOWN_MS / 1000
      )} seconds.`,
      429
    );
  }

  const mappedMessage = mapGeminiErrorMessage(lastError);
  throw new ApiError(
    `All Gemini fallback models failed. Tried: ${triedModels.join(", ")}. Last error: ${mappedMessage}.`,
    502
  );
};

const summarizeWithGemini = async ({ inputText, length, format, language }) => {
  const prompt = `You are an expert summarizer.
Summarize the following content in ${language}.
Target length: ${summaryLengthInstructions[length]}.
${formatInstructions[format]}
Focus on key ideas, important context, and actionable details.
Do not invent information.
Avoid markdown formatting markers like **, __, #, or inline LaTeX escapes.
Keep output clean plain text only.

Content:
${inputText}`;

  return generateTextWithFallback(prompt);
};

const generateInsightPack = async ({
  inputText,
  length,
  format,
  language,
  preset = "General",
  tone = "formal",
  depth = "basic",
  audience = "student",
}) => {
  const prompt = `You are an advanced analyst and summarizer.
Return ONLY valid JSON with this exact structure and no extra text:
{
  "coreSummary": "string",
  "paragraphSummary": "string",
  "bulletSummary": ["string"],
  "keyTakeaways": ["string"],
  "actionItems": ["string"],
  "confidenceHints": ["string"],
  "dualLanguage": {
    "targetLanguage": "string",
    "targetSummary": "string",
    "sourceLanguage": "string",
    "sourceSummary": "string"
  },
  "chapterSummaries": [
    {
      "title": "string",
      "summary": "string"
    }
  ]
}

Rules:
- Target language for summaries: ${language}
- Preset mode context: ${preset}
- Length target: ${summaryLengthInstructions[length]}
- Output style preference: ${formatInstructions[format]}
- Tone instruction: ${toneInstructions[tone] || toneInstructions.formal}
- Depth instruction: ${depthInstructions[depth] || depthInstructions.basic}
- Audience instruction: ${audienceInstructions[audience] || audienceInstructions.student}
- Do not use markdown symbols.
- Keep chapterSummaries concise with max 6 items.
- Keep confidenceHints practical and concise.
- Do not invent facts.

Content:
${inputText}`;

  const responseText = await generateTextWithFallback(prompt);
  const parsed = parseJsonFromText(responseText);

  if (!parsed) {
    return {
      coreSummary: responseText,
      paragraphSummary: responseText,
      bulletSummary: [],
      keyTakeaways: [],
      actionItems: [],
      confidenceHints: [],
      dualLanguage: {
        targetLanguage: language,
        targetSummary: responseText,
        sourceLanguage: "Detected Source",
        sourceSummary: responseText,
      },
      chapterSummaries: [],
    };
  }

  return {
    coreSummary: String(parsed.coreSummary || parsed.paragraphSummary || ""),
    paragraphSummary: String(parsed.paragraphSummary || parsed.coreSummary || ""),
    bulletSummary: Array.isArray(parsed.bulletSummary) ? parsed.bulletSummary : [],
    keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    confidenceHints: Array.isArray(parsed.confidenceHints) ? parsed.confidenceHints : [],
    dualLanguage: {
      targetLanguage: String(parsed?.dualLanguage?.targetLanguage || language),
      targetSummary: String(parsed?.dualLanguage?.targetSummary || ""),
      sourceLanguage: String(parsed?.dualLanguage?.sourceLanguage || "Detected Source"),
      sourceSummary: String(parsed?.dualLanguage?.sourceSummary || ""),
    },
    chapterSummaries: Array.isArray(parsed.chapterSummaries)
      ? parsed.chapterSummaries
          .map((item) => ({
            title: String(item?.title || "Section"),
            summary: String(item?.summary || ""),
          }))
          .filter((item) => item.summary)
      : [],
  };
};

const askFollowUpWithGemini = async ({ contextText, question, language }) => {
  const prompt = `You are a strict assistant for follow-up Q&A.
Answer ONLY from the provided context.
If the answer is not present in context, say: "The requested detail is not present in the provided content."
Respond in ${language}.
Keep answer concise and clear.

Question:
${question}

Context:
${contextText}`;

  return generateTextWithFallback(prompt);
};

module.exports = {
  summarizeWithGemini,
  generateInsightPack,
  askFollowUpWithGemini,
};
