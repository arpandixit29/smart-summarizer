import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

export const summarizeDocument = async ({
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
  const formData = new FormData();

  if (file) {
    formData.append("file", file);
  }

  if (text) {
    formData.append("text", text);
  }

  formData.append("length", length);
  formData.append("format", format);
  formData.append("language", language);
  formData.append("preset", preset);
  formData.append("tone", tone);
  formData.append("depth", depth);
  formData.append("audience", audience);

  const response = await api.post("/api/summarize/document", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data.data;
};

export const summarizeVideo = async ({
  youtubeUrl,
  length,
  format,
  language,
  preset,
  tone,
  depth,
  audience,
}) => {
  const response = await api.post("/api/summarize/video", {
    youtubeUrl,
    length,
    format,
    language,
    preset,
    tone,
    depth,
    audience,
  });

  return response.data.data;
};

export const askFollowUp = async ({ contextText, question, language }) => {
  const response = await api.post("/api/summarize/followup", {
    contextText,
    question,
    language,
  });

  return response.data.data;
};

export const signupUser = async ({ email, password }) => {
  const response = await api.post("/api/auth/signup", { email, password });
  return response.data.data;
};

export const loginUser = async ({ email, password }) => {
  const response = await api.post("/api/auth/login", { email, password });
  return response.data.data;
};

export const saveSummaryHistory = async ({ type, input, summary, metadata = {} }) => {
  const response = await api.post(
    "/api/save-summary",
    { type, input, summary, metadata },
    { headers: getAuthHeader() }
  );

  return response.data.data;
};

export const getSummaryHistory = async () => {
  const response = await api.get("/api/history", {
    headers: getAuthHeader(),
  });

  return response.data.data;
};
