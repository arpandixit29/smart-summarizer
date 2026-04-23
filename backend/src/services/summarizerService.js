const pdfParseModule = require("pdf-parse");
const { generateInsightPack, askFollowUpWithGemini } = require("./geminiService");
const { fetchYouTubeTranscript, extractYouTubeVideoId } = require("../utils/youtubeUtils");
const {
  cleanText,
  cleanSummaryOutput,
  extractKeywords,
  validateSummaryLength,
  validateSummaryFormat,
} = require("../utils/textUtils");

const MAX_TEXT_CHARS = 50000;

class ApiError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const parsePdfText = async (buffer) => {
  if (typeof pdfParseModule === "function") {
    const result = await pdfParseModule(buffer);
    return result?.text || "";
  }

  const PDFParseClass = pdfParseModule?.PDFParse;
  if (typeof PDFParseClass === "function") {
    const parser = new PDFParseClass({ data: buffer });
    try {
      const result = await parser.getText();
      return result?.text || "";
    } finally {
      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }
    }
  }

  throw new ApiError("PDF parser is not available in current backend setup.", 500);
};

const getDocumentText = async (file, plainText) => {
  if (file) {
    if (file.mimetype === "application/pdf") {
      const extractedText = await parsePdfText(file.buffer);
      return {
        rawText: extractedText,
        cleanedText: cleanText(extractedText),
        isPdf: true,
      };
    }

    const rawText = file.buffer.toString("utf-8");
    return {
      rawText,
      cleanedText: cleanText(rawText),
      isPdf: false,
    };
  }

  if (plainText && plainText.trim()) {
    return {
      rawText: plainText,
      cleanedText: cleanText(plainText),
      isPdf: false,
    };
  }

  throw new ApiError("Please upload a document or paste text.", 400);
};

const buildResponse = ({
  insightPack,
  sourceType,
  sourceMeta,
  contextText,
  preferredFormat,
}) => {
  const paragraphSummary = cleanSummaryOutput(insightPack.paragraphSummary || insightPack.coreSummary);
  const bulletSummaryList = Array.isArray(insightPack.bulletSummary)
    ? insightPack.bulletSummary.map((item) => cleanSummaryOutput(item)).filter(Boolean)
    : [];
  const keyTakeaways = Array.isArray(insightPack.keyTakeaways)
    ? insightPack.keyTakeaways.map((item) => cleanSummaryOutput(item)).filter(Boolean)
    : [];
  const actionItems = Array.isArray(insightPack.actionItems)
    ? insightPack.actionItems.map((item) => cleanSummaryOutput(item)).filter(Boolean)
    : [];
  const confidenceHints = Array.isArray(insightPack.confidenceHints)
    ? insightPack.confidenceHints.map((item) => cleanSummaryOutput(item)).filter(Boolean)
    : [];
  const chapterSummaries = Array.isArray(insightPack.chapterSummaries)
    ? insightPack.chapterSummaries
        .map((item) => ({
          title: cleanSummaryOutput(item.title || "Section"),
          summary: cleanSummaryOutput(item.summary || ""),
        }))
        .filter((item) => item.summary)
    : [];

  const defaultCoreSummary = cleanSummaryOutput(insightPack.coreSummary || paragraphSummary);
  const selectedSummary =
    preferredFormat === "bullet" && bulletSummaryList.length > 0
      ? bulletSummaryList.map((item) => `- ${item.replace(/^[-\s]+/, "")}`).join("\n")
      : defaultCoreSummary;

  return {
    summary: selectedSummary,
    paragraphSummary,
    bulletSummary: bulletSummaryList,
    keyTakeaways,
    actionItems,
    confidenceHints,
    chapterSummaries,
    dualLanguage: {
      targetLanguage: insightPack?.dualLanguage?.targetLanguage || "",
      targetSummary: cleanSummaryOutput(insightPack?.dualLanguage?.targetSummary || ""),
      sourceLanguage: insightPack?.dualLanguage?.sourceLanguage || "",
      sourceSummary: cleanSummaryOutput(insightPack?.dualLanguage?.sourceSummary || ""),
    },
    keywords: extractKeywords(paragraphSummary || selectedSummary),
    sourceType,
    sourceMeta,
    contextText,
  };
};

const summarizeDocument = async ({
  file,
  text,
  length,
  format,
  language,
  preset,
  tone,
  depth,
  audience,
}) => {
  const normalizedLength = validateSummaryLength(length);
  const normalizedFormat = validateSummaryFormat(format);
  const normalizedLanguage = language || "English";

  const { cleanedText, isPdf } = await getDocumentText(file, text);

  if (!cleanedText) {
    throw new ApiError("Could not extract readable text from the input.", 422);
  }

  const textForSummary = cleanedText.slice(0, MAX_TEXT_CHARS);

  const insightPack = await generateInsightPack({
    inputText: textForSummary,
    length: normalizedLength,
    format: normalizedFormat,
    language: normalizedLanguage,
    preset,
    tone,
    depth,
    audience,
  });

  return buildResponse({
    insightPack,
    sourceType: "document",
    preferredFormat: normalizedFormat,
    contextText: textForSummary,
    sourceMeta: {
      fileName: file?.originalname || "Pasted Text",
      originalCharCount: cleanedText.length,
      processedCharCount: textForSummary.length,
      hasChapterSummaries: isPdf,
    },
  });
};

const summarizeVideo = async ({
  youtubeUrl,
  length,
  format,
  language,
  preset,
  tone,
  depth,
  audience,
}) => {
  const normalizedLength = validateSummaryLength(length);
  const normalizedFormat = validateSummaryFormat(format);
  const normalizedLanguage = language || "English";

  if (!youtubeUrl) {
    throw new ApiError("Please provide a valid YouTube video URL.", 400);
  }

  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new ApiError("Invalid YouTube URL. Please try a valid link.", 400);
  }

  const transcript = await fetchYouTubeTranscript(videoId);
  const cleanedTranscript = cleanText(transcript);

  if (!cleanedTranscript) {
    throw new ApiError("Transcript is unavailable for this video.", 422);
  }

  const textForSummary = cleanedTranscript.slice(0, MAX_TEXT_CHARS);

  const insightPack = await generateInsightPack({
    inputText: textForSummary,
    length: normalizedLength,
    format: normalizedFormat,
    language: normalizedLanguage,
    preset,
    tone,
    depth,
    audience,
  });

  return buildResponse({
    insightPack,
    sourceType: "video",
    preferredFormat: normalizedFormat,
    contextText: textForSummary,
    sourceMeta: {
      videoId,
      originalCharCount: cleanedTranscript.length,
      processedCharCount: textForSummary.length,
    },
  });
};

const followUpOnSummary = async ({ contextText, question, language }) => {
  if (!contextText || !contextText.trim()) {
    throw new ApiError("Missing summary context for follow-up.", 400);
  }

  if (!question || !question.trim()) {
    throw new ApiError("Please provide a follow-up question.", 400);
  }

  const answer = await askFollowUpWithGemini({
    contextText: contextText.slice(0, MAX_TEXT_CHARS),
    question,
    language: language || "English",
  });

  return {
    answer: cleanSummaryOutput(answer),
  };
};

module.exports = {
  summarizeDocument,
  summarizeVideo,
  followUpOnSummary,
};
