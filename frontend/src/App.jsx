import { useEffect, useMemo, useRef, useState } from "react";
import {
  askFollowUp,
  getSummaryHistory,
  loginUser,
  saveSummaryHistory,
  signupUser,
  summarizeDocument,
  summarizeVideo,
} from "./api";
import {
  copyToClipboard,
  downloadPresentationDeck,
  downloadSummaryAsMarkdown,
  downloadSummaryAsPdf,
} from "./utils";
import "./App.css";

const SUMMARY_LENGTHS = ["short", "medium", "long"];
const SUMMARY_FORMATS = [
  { label: "Paragraph", value: "paragraph" },
  { label: "Bullet Points", value: "bullet" },
];
const PRESETS = ["Quick Brief", "Study Notes", "Executive Summary", "Creative Outline", "Exam Prep"];
const TONES = ["neutral", "simple", "professional", "friendly", "analytical"];
const DEPTHS = ["standard", "detailed", "ultra-detailed"];
const AUDIENCES = ["general", "student", "executive", "creator", "researcher"];
const VIEW_TABS = [
  { label: "Hierarchy", value: "hierarchy" },
  { label: "Compare", value: "compare" },
  { label: "Follow-up", value: "followup" },
];

const LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Arabic",
  "Portuguese",
  "Italian",
  "Japanese",
  "Korean",
  "Chinese",
  "Bengali",
  "Tamil",
  "Telugu",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Russian",
  "Turkish",
  "Dutch",
  "Polish",
  "Ukrainian",
  "Indonesian",
  "Vietnamese",
  "Thai",
  "Malay",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Greek",
  "Hebrew",
  "Romanian",
  "Czech",
  "Hungarian",
];

const LANGUAGE_TO_LOCALE = {
  english: "en-US",
  hindi: "hi-IN",
  spanish: "es-ES",
  french: "fr-FR",
  german: "de-DE",
  arabic: "ar-SA",
  portuguese: "pt-PT",
  italian: "it-IT",
  japanese: "ja-JP",
  korean: "ko-KR",
  chinese: "zh-CN",
  bengali: "bn-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
  marathi: "mr-IN",
  gujarati: "gu-IN",
  punjabi: "pa-IN",
  urdu: "ur-PK",
  russian: "ru-RU",
  turkish: "tr-TR",
  dutch: "nl-NL",
  polish: "pl-PL",
  ukrainian: "uk-UA",
  indonesian: "id-ID",
  vietnamese: "vi-VN",
  thai: "th-TH",
  malay: "ms-MY",
  swedish: "sv-SE",
  norwegian: "nb-NO",
  danish: "da-DK",
  finnish: "fi-FI",
  greek: "el-GR",
  hebrew: "he-IL",
  romanian: "ro-RO",
  czech: "cs-CZ",
  hungarian: "hu-HU",
};

const DEFAULT_FORM = {
  length: "medium",
  format: "paragraph",
  preset: "Quick Brief",
  tone: "neutral",
  depth: "standard",
  audience: "general",
  language: "English",
};

const getPreferredLocale = (language) => {
  if (!language) {
    return "en-US";
  }

  const normalized = language.toString().trim().toLowerCase();
  if (LANGUAGE_TO_LOCALE[normalized]) {
    return LANGUAGE_TO_LOCALE[normalized];
  }

  if (normalized.includes("hindi")) return "hi-IN";
  if (normalized.includes("spanish")) return "es-ES";
  if (normalized.includes("french")) return "fr-FR";
  if (normalized.includes("german")) return "de-DE";
  if (normalized.includes("arabic")) return "ar-SA";
  if (normalized.includes("portuguese")) return "pt-PT";
  if (normalized.includes("italian")) return "it-IT";
  if (normalized.includes("japanese")) return "ja-JP";
  if (normalized.includes("korean")) return "ko-KR";
  if (normalized.includes("chinese") || normalized.includes("mandarin")) return "zh-CN";
  if (normalized.includes("russian")) return "ru-RU";
  if (normalized.includes("turkish")) return "tr-TR";
  if (normalized.includes("dutch")) return "nl-NL";
  if (normalized.includes("polish")) return "pl-PL";
  if (normalized.includes("ukrainian")) return "uk-UA";
  if (normalized.includes("indonesian")) return "id-ID";
  if (normalized.includes("vietnamese")) return "vi-VN";
  if (normalized.includes("thai")) return "th-TH";
  if (normalized.includes("malay")) return "ms-MY";
  if (normalized.includes("swedish")) return "sv-SE";
  if (normalized.includes("norwegian")) return "nb-NO";
  if (normalized.includes("danish")) return "da-DK";
  if (normalized.includes("finnish")) return "fi-FI";
  if (normalized.includes("greek")) return "el-GR";
  if (normalized.includes("hebrew")) return "he-IL";
  if (normalized.includes("romanian")) return "ro-RO";
  if (normalized.includes("czech")) return "cs-CZ";
  if (normalized.includes("hungarian")) return "hu-HU";
  return "en-US";
};

const getPreferredFemaleVoice = (targetLocale, voices = []) => {
  if (!Array.isArray(voices) || voices.length === 0) {
    return null;
  }

  const locale = (targetLocale || "").toLowerCase();
  const localeLanguage = locale.split("-")[0];
  const femaleHints = ["female", "woman", "zira", "samantha", "karen", "fiona", "veena", "priya", "tessa", "aria", "mia", "nova"];
  const localeMatches = voices.filter((voice) => {
    const voiceLang = (voice.lang || "").toLowerCase();
    return voiceLang.startsWith(locale) || voiceLang.startsWith(`${localeLanguage}-`) || voiceLang === localeLanguage;
  });
  const femaleLocaleMatch = localeMatches.find((voice) => femaleHints.some((hint) => voice.name?.toLowerCase().includes(hint)));

  if (femaleLocaleMatch) {
    return femaleLocaleMatch;
  }

  if (localeMatches.length > 0) {
    return localeMatches[0];
  }

  return null;
};

const formatHistoryDate = (value) => {
  if (!value) {
    return "Recently";
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildInputPreview = ({ mode, text, youtubeUrl, file }) => {
  if (mode === "video") {
    return youtubeUrl || "YouTube video";
  }

  if (file?.name) {
    return file.name;
  }

  const trimmed = text?.trim() || "Document text";
  const preview = trimmed.slice(0, 140);
  return trimmed.length > 140 ? `${preview}...` : preview;
};

const fetchHistoryItems = async () => {
  const response = await getSummaryHistory();
  return Array.isArray(response) ? response : [];
};

function App() {
  const [theme, setTheme] = useState("light");
  const [mode, setMode] = useState("document");
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [length, setLength] = useState(DEFAULT_FORM.length);
  const [format, setFormat] = useState(DEFAULT_FORM.format);
  const [preset, setPreset] = useState(DEFAULT_FORM.preset);
  const [tone, setTone] = useState(DEFAULT_FORM.tone);
  const [depth, setDepth] = useState(DEFAULT_FORM.depth);
  const [audience, setAudience] = useState(DEFAULT_FORM.audience);
  const [language, setLanguage] = useState(DEFAULT_FORM.language);
  const [summaryResult, setSummaryResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState("idle");
  const [activeView, setActiveView] = useState("hierarchy");
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [voices, setVoices] = useState([]);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [followUpMessages, setFollowUpMessages] = useState([]);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = localStorage.getItem("summary_user");
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const copyTimerRef = useRef(null);

  const canSubmit = useMemo(() => {
    if (mode === "document") {
      return Boolean(file || text.trim());
    }

    return Boolean(youtubeUrl.trim());
  }, [file, mode, text, youtubeUrl]);

  const summaryText = summaryResult?.summary || summaryResult?.paragraphSummary || "";
  const locale = getPreferredLocale(language);

  const clearSpeech = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return undefined;
    }

    const syncVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    syncVoices();
    window.speechSynthesis.onvoiceschanged = syncVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      if (!currentUser) {
        setHistory([]);
        return;
      }

      setHistoryLoading(true);
      try {
        const items = await fetchHistoryItems();
        if (active) {
          setHistory(items);
        }
      } catch (historyError) {
        if (active) {
          setHistory([]);
          setError(historyError?.response?.data?.error || historyError.message || "Unable to load history.");
        }
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, [currentUser]);

  useEffect(
    () => () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }

      clearSpeech();
    },
    []
  );

  const resetOutputState = () => {
    setError("");
    setSummaryResult(null);
    setCopyState("idle");
    setActiveView("hierarchy");
    setActiveChapterIndex(0);
    setFollowUpMessages([]);
    setFollowUpQuestion("");
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    resetOutputState();
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);

    if (selectedFile) {
      setText("");
    }
  };

  const handleSummarize = async (event) => {
    event.preventDefault();

    if (!canSubmit) {
      setError("Please provide valid input before summarizing.");
      return;
    }

    setLoading(true);
    setError("");
    setSummaryResult(null);

    try {
      const payload =
        mode === "document"
          ? await summarizeDocument({
              file,
              text,
              length,
              format,
              language,
              preset,
              tone,
              depth,
              audience,
            })
          : await summarizeVideo({
              youtubeUrl: youtubeUrl.trim(),
              length,
              format,
              language,
              preset,
              tone,
              depth,
              audience,
            });

      setSummaryResult(payload);
      setActiveView("hierarchy");
      setActiveChapterIndex(0);

      if (currentUser && payload?.summary) {
        try {
          await saveSummaryHistory({
            type: mode,
            input: buildInputPreview({ mode, text, youtubeUrl, file }),
            summary: payload.summary,
            metadata: {
              mode,
              fileName: file?.name || null,
              form: {
                length,
                format,
                preset,
                tone,
                depth,
                audience,
                language,
              },
              snapshot: payload,
            },
          });

          const items = await fetchHistoryItems();
          setHistory(items);
        } catch {
          // History persistence is optional.
        }
      }
    } catch (apiError) {
      setError(apiError?.response?.data?.error || apiError?.message || "Something failed while generating the summary.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopySummary = async () => {
    try {
      await copyToClipboard(summaryText || "");
      setCopyState("copied");

      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }

      copyTimerRef.current = window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
    }
  };

  const handleDownloadSummary = () => {
    try {
      downloadSummaryAsPdf({
        summary: summaryText,
        keywords: summaryResult?.keywords,
        sourceType: summaryResult?.sourceType,
      });
    } catch (downloadError) {
      setError(downloadError.message);
    }
  };

  const handleDownloadMarkdown = () => {
    try {
      downloadSummaryAsMarkdown({
        title: "AI Summary Pack",
        coreSummary: summaryResult?.paragraphSummary || summaryText,
        keyTakeaways: summaryResult?.keyTakeaways || [],
        actionItems: summaryResult?.actionItems || [],
        keywords: summaryResult?.keywords || [],
      });
    } catch (downloadError) {
      setError(downloadError.message);
    }
  };

  const handleDownloadDeck = () => {
    try {
      downloadPresentationDeck({
        coreSummary: summaryResult?.paragraphSummary || summaryText,
        keyTakeaways: summaryResult?.keyTakeaways || [],
        actionItems: summaryResult?.actionItems || [],
      });
    } catch (downloadError) {
      setError(downloadError.message);
    }
  };

  const persistAuth = (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("summary_user", JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Email and password are required.");
      return;
    }

    setAuthLoading(true);

    try {
      if (authMode === "signup") {
        await signupUser({ email: authEmail, password: authPassword });
      }

      const loginPayload = await loginUser({ email: authEmail, password: authPassword });
      persistAuth(loginPayload.token, loginPayload.user);
      setAuthMessage(`Welcome back, ${loginPayload.user.email}.`);
      setAuthPassword("");
      const items = await fetchHistoryItems();
      setHistory(items);
    } catch (authSubmitError) {
      setAuthError(authSubmitError?.response?.data?.error || authSubmitError.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("summary_user");
    setCurrentUser(null);
    setHistory([]);
    setAuthMessage("Signed out.");
  };

  const handleSpeakSummary = () => {
    if (!summaryText || typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    clearSpeech();

    const utterance = new SpeechSynthesisUtterance(summaryText);
    const preferredVoice = getPreferredFemaleVoice(locale, voices);

    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang || locale;
    } else {
      utterance.lang = locale;
    }

    utterance.rate = speechRate;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleAskFollowUp = async (event) => {
    event.preventDefault();
    const question = followUpQuestion.trim();

    if (!summaryResult?.contextText || !question) {
      setError("Add a follow-up question after generating a summary.");
      return;
    }

    setFollowUpMessages((currentMessages) => [...currentMessages, { role: "user", text: question }]);
    setFollowUpQuestion("");

    try {
      const response = await askFollowUp({
        contextText: summaryResult.contextText,
        question,
        language,
      });

      setFollowUpMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", text: response?.answer || "No answer returned." },
      ]);
    } catch (followUpError) {
      setFollowUpMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          text: followUpError?.response?.data?.error || followUpError.message || "Follow-up request failed.",
        },
      ]);
    }
  };

  const handleHistorySelect = (item) => {
    const snapshot = item?.metadata?.snapshot;
    const loadedResult = snapshot || {
      summary: item.summary,
      paragraphSummary: item.summary,
      bulletSummary: [],
      keyTakeaways: [],
      actionItems: [],
      confidenceHints: [],
      chapterSummaries: [],
      dualLanguage: {},
      keywords: [],
      sourceType: item.type,
      sourceMeta: item.metadata || {},
      contextText: item.input,
    };

    setSummaryResult(loadedResult);
    setActiveView("hierarchy");
    setActiveChapterIndex(0);
    setFollowUpMessages([]);
    setFollowUpQuestion("");

    if (item?.type === "video") {
      setMode("video");
      setYoutubeUrl(item.input);
    } else {
      setMode("document");
      setText(item.input);
      setFile(null);
    }

    const savedForm = item?.metadata?.form || {};
    setLength(savedForm.length || DEFAULT_FORM.length);
    setFormat(savedForm.format || DEFAULT_FORM.format);
    setPreset(savedForm.preset || DEFAULT_FORM.preset);
    setTone(savedForm.tone || DEFAULT_FORM.tone);
    setDepth(savedForm.depth || DEFAULT_FORM.depth);
    setAudience(savedForm.audience || DEFAULT_FORM.audience);
    setLanguage(savedForm.language || DEFAULT_FORM.language);
  };

  const toggleTheme = () => {
    setTheme((previousTheme) => (previousTheme === "light" ? "dark" : "light"));
  };

  return (
    <main className={`app-shell ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      <section className="hero-panel">
        <button type="button" className="theme-toggle" onClick={toggleTheme}>
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <h1>Turn Long Content Into Clear Insights</h1>
        <p className="subtext">
          Upload documents or paste a YouTube link to get clean, readable summaries in seconds with adjustable length, tone, audience, and voice playback.
        </p>
        <div className="hero-highlights">
          <span>PDF and Text</span>
          <span>YouTube Transcript</span>
          <span>Auth and History</span>
          <span>Voice and Follow-up</span>
        </div>
        <div className="flow-line">
          <span>Summarize</span>
          <i></i>
          <span>Explore</span>
          <i></i>
          <span>Ask</span>
          <i></i>
          <span>Save</span>
        </div>
      </section>

      <section className="card auth-card">
        <div className="auth-top">
          <h2>{currentUser ? "Signed In" : authMode === "signup" ? "Create Account" : "Sign In"}</h2>
          <div className="actions">
            <button type="button" className="secondary-btn" onClick={() => setAuthMode("login")}>Login</button>
            <button type="button" className="secondary-btn" onClick={() => setAuthMode("signup")}>Sign Up</button>
            {currentUser && <button type="button" className="secondary-btn" onClick={handleLogout}>Logout</button>}
          </div>
        </div>

        {currentUser ? (
          <div className="auth-success">
            <p>
              Logged in as <strong>{currentUser.email}</strong>
            </p>
            <p>{history.length > 0 ? `${history.length} saved summaries` : "History will appear after your first save."}</p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <div className="auth-grid">
              <div>
                <label className="field-label" htmlFor="authEmail">Email</label>
                <input
                  id="authEmail"
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="authPassword">Password</label>
                <input
                  id="authPassword"
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                />
              </div>
            </div>
            <button className="primary-btn" type="submit" disabled={authLoading}>
              {authLoading ? "Working..." : authMode === "signup" ? "Create Account" : "Log In"}
            </button>
            <p className="hint">
              {authMode === "signup"
                ? "Create an account to sync summaries to history."
                : "Log in to save summaries and browse history."}
            </p>
            {(authMessage || authError) && <p className={authError ? "error-text" : "hint"}>{authError || authMessage}</p>}
          </form>
        )}
      </section>

      <section className="workspace-grid">
        <form className="card input-card" onSubmit={handleSummarize}>
          <div className="mode-switch">
            <button type="button" className={mode === "document" ? "active" : ""} onClick={() => handleModeChange("document")}>Document</button>
            <button type="button" className={mode === "video" ? "active" : ""} onClick={() => handleModeChange("video")}>YouTube Video</button>
          </div>

          {mode === "document" ? (
            <>
              <label className="field-label" htmlFor="fileUpload">Upload File</label>
              <input id="fileUpload" type="file" accept=".pdf,.txt,.md" onChange={handleFileChange} />
              {file && <p className="hint selected-file">Selected: {file.name}</p>}
              <p className="hint">or paste text directly</p>
              <label className="field-label" htmlFor="textInput">Text Input</label>
              <textarea id="textInput" value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste your document content here" rows={7} />
            </>
          ) : (
            <>
              <label className="field-label" htmlFor="youtubeUrl">YouTube URL</label>
              <input id="youtubeUrl" type="url" placeholder="https://www.youtube.com/watch?v=..." value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} />
            </>
          )}

          <div className="preset-row" aria-label="Summary presets">
            {PRESETS.map((item) => (
              <button key={item} type="button" className={`preset-chip ${preset === item ? "active" : ""}`} onClick={() => setPreset(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="controls-row">
            <div>
              <label className="field-label" htmlFor="lengthSelect">Summary Length</label>
              <select id="lengthSelect" value={length} onChange={(event) => setLength(event.target.value)}>
                {SUMMARY_LENGTHS.map((level) => (
                  <option key={level} value={level}>{level[0].toUpperCase() + level.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="formatSelect">Output Style</label>
              <select id="formatSelect" value={format} onChange={(event) => setFormat(event.target.value)}>
                {SUMMARY_FORMATS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="languageInput">Language</label>
              <select id="languageInput" value={language} onChange={(event) => setLanguage(event.target.value)}>
                {LANGUAGE_OPTIONS.map((languageOption) => (
                  <option key={languageOption} value={languageOption}>{languageOption}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="controls-row">
            <div>
              <label className="field-label" htmlFor="toneSelect">Tone</label>
              <select id="toneSelect" value={tone} onChange={(event) => setTone(event.target.value)}>
                {TONES.map((item) => (
                  <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="depthSelect">Depth</label>
              <select id="depthSelect" value={depth} onChange={(event) => setDepth(event.target.value)}>
                {DEPTHS.map((item) => (
                  <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1).replace("-", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="audienceSelect">Audience</label>
              <select id="audienceSelect" value={audience} onChange={(event) => setAudience(event.target.value)}>
                {AUDIENCES.map((item) => (
                  <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <button className="primary-btn" type="submit" disabled={!canSubmit || loading}>
            {loading ? "Generating summary..." : "Generate Summary"}
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>

        <section className="card output-card">
          <div className="output-top">
            <h2>Summary Output</h2>
            <div className="actions">
              <button type="button" className="secondary-btn" disabled={!summaryText} onClick={handleCopySummary}>
                {copyState === "copied" ? "Copied" : "Copy"}
              </button>
              <button type="button" className="secondary-btn" disabled={!summaryText} onClick={handleDownloadSummary}>
                Download PDF
              </button>
              <button type="button" className="secondary-btn" disabled={!summaryText} onClick={handleDownloadMarkdown}>
                Markdown
              </button>
              <button type="button" className="secondary-btn" disabled={!summaryText} onClick={handleDownloadDeck}>
                Deck
              </button>
            </div>
          </div>

          <div className="voice-row">
            <button type="button" className="secondary-btn" disabled={!summaryText || isSpeaking} onClick={handleSpeakSummary}>
              {isSpeaking ? "Speaking..." : "Speak Summary"}
            </button>
            <button type="button" className="secondary-btn" disabled={!isSpeaking} onClick={clearSpeech}>
              Stop Voice
            </button>
            <label className="speed-control" htmlFor="speechRate">Speed {speechRate.toFixed(1)}x</label>
            <input id="speechRate" type="range" min="0.7" max="1.3" step="0.1" value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))} />
          </div>

          <div className="view-tabs" role="tablist" aria-label="Summary views">
            {VIEW_TABS.map((tab) => (
              <button key={tab.value} type="button" className={activeView === tab.value ? "active" : ""} onClick={() => setActiveView(tab.value)}>
                {tab.label}
              </button>
            ))}
          </div>

          {!summaryResult && !loading && <p className="placeholder-text">Your summary will appear here once processing completes.</p>}

          {loading && (
            <div className="loading-skeleton" aria-live="polite" aria-label="Generating summary">
              <div className="skeleton-line"></div>
              <div className="skeleton-line"></div>
              <div className="skeleton-line short"></div>
              <p className="loading-text">Analyzing your input...</p>
            </div>
          )}

          {summaryResult?.summary && (
            <div className="stagger">
              {activeView === "hierarchy" && (
                <>
                  <section className="result-section">
                    <h3>Core Summary</h3>
                    <article className="summary-text">{summaryResult.paragraphSummary || summaryText}</article>
                  </section>

                  {Array.isArray(summaryResult.bulletSummary) && summaryResult.bulletSummary.length > 0 && (
                    <section className="result-section">
                      <h3>Bullet Summary</h3>
                      <ul className="result-list">
                        {summaryResult.bulletSummary.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {Array.isArray(summaryResult.chapterSummaries) && summaryResult.chapterSummaries.length > 0 && (
                    <section className="result-section">
                      <h3>Chapters</h3>
                      <div className="chapter-tabs">
                        {summaryResult.chapterSummaries.map((chapter, index) => (
                          <button key={`${chapter.title}-${index}`} type="button" className={activeChapterIndex === index ? "active" : ""} onClick={() => setActiveChapterIndex(index)}>
                            {chapter.title}
                          </button>
                        ))}
                      </div>
                      <p className="chapter-summary">
                        {summaryResult.chapterSummaries[activeChapterIndex]?.summary || summaryResult.chapterSummaries[0]?.summary}
                      </p>
                    </section>
                  )}

                  {summaryResult.dualLanguage?.targetSummary || summaryResult.dualLanguage?.sourceSummary ? (
                    <section className="result-section">
                      <h3>Dual Language</h3>
                      <div className="dual-panel">
                        <p>
                          <strong>{summaryResult.dualLanguage?.sourceLanguage || "Source"}</strong>
                          <br />
                          {summaryResult.dualLanguage?.sourceSummary || "Not available."}
                        </p>
                        <p>
                          <strong>{summaryResult.dualLanguage?.targetLanguage || "Target"}</strong>
                          <br />
                          {summaryResult.dualLanguage?.targetSummary || "Not available."}
                        </p>
                      </div>
                    </section>
                  ) : null}

                  {(Array.isArray(summaryResult.keyTakeaways) && summaryResult.keyTakeaways.length > 0) ||
                  (Array.isArray(summaryResult.actionItems) && summaryResult.actionItems.length > 0) ||
                  (Array.isArray(summaryResult.confidenceHints) && summaryResult.confidenceHints.length > 0) ? (
                    <section className="result-section">
                      <h3>Insights</h3>
                      <div className="compare-grid">
                        <div className="compare-card">
                          <h3>Key Takeaways</h3>
                          <p>{summaryResult.keyTakeaways?.join(" • ") || "No takeaways returned."}</p>
                        </div>
                        <div className="compare-card">
                          <h3>Action Items</h3>
                          <p>{summaryResult.actionItems?.join(" • ") || "No action items returned."}</p>
                        </div>
                        <div className="compare-card">
                          <h3>Confidence Hints</h3>
                          <p>{summaryResult.confidenceHints?.join(" • ") || "No confidence hints returned."}</p>
                        </div>
                      </div>
                    </section>
                  ) : null}
                </>
              )}

              {activeView === "compare" && (
                <section className="result-section">
                  <h3>Compare Views</h3>
                  <div className="compare-grid">
                    <div className="compare-card">
                      <h3>Paragraph</h3>
                      <p>{summaryResult.paragraphSummary || summaryText}</p>
                    </div>
                    <div className="compare-card">
                      <h3>Bullets</h3>
                      <p>{summaryResult.bulletSummary?.join(" • ") || "No bullet view returned."}</p>
                    </div>
                    <div className="compare-card">
                      <h3>Executive Notes</h3>
                      <p>
                        {summaryResult.keyTakeaways?.join(" • ") || summaryResult.actionItems?.join(" • ") || "No extra notes returned."}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {activeView === "followup" && (
                <section className="result-section followup-panel">
                  <h3>Follow-up Chat</h3>
                  <div className="chat-log">
                    {followUpMessages.length === 0 ? (
                      <p className="placeholder-text">Ask a question about the generated summary.</p>
                    ) : (
                      followUpMessages.map((message, index) => (
                        <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
                          <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
                          <p>{message.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form className="followup-input-row" onSubmit={handleAskFollowUp}>
                    <input
                      type="text"
                      value={followUpQuestion}
                      onChange={(event) => setFollowUpQuestion(event.target.value)}
                      placeholder="Ask for clarification, action items, or a deeper explanation"
                    />
                    <button className="primary-btn" type="submit" disabled={!followUpQuestion.trim()}>
                      Ask
                    </button>
                  </form>
                </section>
              )}

              {Array.isArray(summaryResult.keywords) && summaryResult.keywords.length > 0 && (
                <div className="keywords-box">
                  <h3>Keywords</h3>
                  <div className="keyword-list">
                    {summaryResult.keywords.map((keyword) => (
                      <span key={keyword}>{keyword}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <section className="history-section">
            <h3>History</h3>
            {!currentUser ? (
              <p className="placeholder-text">Log in to save and reopen previous summaries.</p>
            ) : historyLoading ? (
              <p className="placeholder-text">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="placeholder-text">No saved summaries yet.</p>
            ) : (
              <div className="history-list">
                {history.map((item) => (
                  <button key={item._id} type="button" className="history-item" onClick={() => handleHistorySelect(item)}>
                    <div className="history-head">
                      <span>{item.type}</span>
                      <span>{formatHistoryDate(item.createdAt)}</span>
                    </div>
                    <p className="history-input">{item.input}</p>
                    <p className="history-summary">{item.summary}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

export default App;
