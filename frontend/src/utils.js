import { jsPDF } from "jspdf";

export const copyToClipboard = async (text) => {
  if (!text) {
    throw new Error("Nothing to copy.");
  }

  await navigator.clipboard.writeText(text);
};

export const downloadSummaryAsPdf = ({ summary, keywords = [], sourceType = "content" }) => {
  if (!summary) {
    throw new Error("Nothing to download.");
  }

  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("AI Summary", 14, 18);

  doc.setFontSize(11);
  doc.text(`Source Type: ${sourceType}`, 14, 26);

  let y = 34;

  if (keywords.length > 0) {
    const keywordText = `Keywords: ${keywords.join(", ")}`;
    const keywordLines = doc.splitTextToSize(keywordText, 180);
    doc.text(keywordLines, 14, y);
    y += keywordLines.length * 6 + 2;
  }

  const summaryLines = doc.splitTextToSize(summary, 180);
  doc.text(summaryLines, 14, y);

  doc.save("summary.pdf");
};

const downloadTextFile = (content, fileName, mimeType = "text/plain") => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadSummaryAsMarkdown = ({
  title = "AI Summary",
  coreSummary = "",
  keyTakeaways = [],
  actionItems = [],
  keywords = [],
}) => {
  const markdown = [
    `# ${title}`,
    "",
    "## Core Summary",
    coreSummary,
    "",
    "## Key Takeaways",
    ...keyTakeaways.map((item) => `- ${item}`),
    "",
    "## Action Items",
    ...actionItems.map((item) => `- ${item}`),
    "",
    "## Keywords",
    keywords.join(", "),
  ].join("\n");

  downloadTextFile(markdown, "summary-pack.md", "text/markdown");
};

export const downloadPresentationDeck = ({
  coreSummary = "",
  keyTakeaways = [],
  actionItems = [],
}) => {
  const deck = [
    "Slide 1: Title",
    "AI Summary Deck",
    "",
    "Slide 2: Core Summary",
    coreSummary,
    "",
    "Slide 3: Key Takeaways",
    ...keyTakeaways.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Slide 4: Action Items",
    ...actionItems.map((item, index) => `${index + 1}. ${item}`),
  ].join("\n");

  downloadTextFile(deck, "presentation-deck.txt", "text/plain");
};
