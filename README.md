# Smart AI-Based Video and Document Summarizer

A full-stack MERN-style application (without database) that summarizes:

- PDF/TXT/MD documents or pasted text
- YouTube videos via transcript extraction

It uses Google Gemini for AI summarization and returns results instantly without storing user data.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- AI: Google Gemini API
- Parsing: pdf-parse, youtube-transcript

## Features

- Document summary: upload file or paste text
- YouTube summary: paste URL
- Summary length options: short / medium / long
- Output style options: paragraph / bullet points
- Multi-language summarization prompt
- Keyword extraction
- Copy summary to clipboard
- Download summary as PDF
- Responsive UI, loading indicators, and error handling

## Project Structure

- `frontend/` React app
- `backend/` Express API

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
cd ../frontend
npm install
```

### 2. Configure environment variables

Backend: create `backend/.env` from `backend/.env.example`

```env
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-1.5-flash
```

Frontend: create `frontend/.env` from `frontend/.env.example`

```env
VITE_API_BASE_URL=http://localhost:5000
```

### 3. Run the app

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173` and backend on `http://localhost:5000`.

## API Endpoints

- `POST /api/summarize/document`
  - multipart/form-data: `file` (PDF/TXT/MD) or `text`
  - fields: `length`, `format`, `language`

- `POST /api/summarize/video`
  - JSON body: `youtubeUrl`, `length`, `format`, `language`

- `GET /api/health`
  - health check endpoint

## Security Notes

- Gemini API key is server-side only in backend `.env`
- Input validation is implemented
- File upload size is limited (5 MB)
- No database or persistent user content storage
