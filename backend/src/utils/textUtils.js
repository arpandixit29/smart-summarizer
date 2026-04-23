const stopwords = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "this",
  "from",
  "have",
  "are",
  "was",
  "were",
  "will",
  "would",
  "there",
  "their",
  "about",
  "into",
  "which",
  "your",
  "you",
  "has",
  "had",
  "its",
  "our",
  "but",
  "can",
  "not",
  "they",
  "them",
  "his",
  "her",
  "she",
  "him",
  "who",
  "what",
  "when",
  "where",
  "why",
  "how",
  "also",
  "than",
  "then",
  "out",
  "over",
  "under",
  "each",
  "any",
  "all",
  "some",
  "more",
  "most",
  "such",
  "very",
  "just",
]);

const cleanText = (text = "") =>
  text.replace(/\s+/g, " ").replace(/\u0000/g, "").trim();

const cleanSummaryOutput = (text = "") => {
  const normalized = String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\\\$/g, "$")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]")
    .replace(/[ \t]+/g, " ")
    .trim();

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
    .join("\n")
    .trim();
};

const validateSummaryLength = (length = "medium") => {
  const allowed = ["short", "medium", "long"];
  return allowed.includes(length) ? length : "medium";
};

const validateSummaryFormat = (format = "paragraph") => {
  const allowed = ["paragraph", "bullet"];
  return allowed.includes(format) ? format : "paragraph";
};

const extractKeywords = (text, limit = 8) => {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalized.split(/\s+/).filter((token) => token.length > 3);

  const counts = tokens.reduce((acc, token) => {
    if (stopwords.has(token)) {
      return acc;
    }

    acc[token] = (acc[token] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
};

module.exports = {
  cleanText,
  cleanSummaryOutput,
  validateSummaryLength,
  validateSummaryFormat,
  extractKeywords,
};
