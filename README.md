# Smart AI-Based Video and Document Summarizer

Smart AI-Based Video and Document Summarizer is a full-stack application for turning long documents and YouTube videos into structured summaries, follow-up answers, and exportable study or review material. The codebase is split into a React frontend and an Express backend, with Google Gemini powering summarization and MongoDB storing authentication and history data.

## What It Does

- Summarizes uploaded documents or pasted text.
- Summarizes YouTube videos by extracting transcript text.
- Produces either paragraph or bullet summaries.
- Generates a richer insight pack with core summary, takeaways, action items, confidence hints, chapter summaries, and a dual-language block.
- Answers follow-up questions using only the generated summary context.
- Supports sign-up, login, JWT-protected routes, and saved history.
- Exports summaries as PDF, Markdown, and presentation-style text.
- Reads summaries aloud in the browser with speech-synthesis voice selection.

## Languages And Runtime

- Frontend: JavaScript, JSX, HTML, CSS.
- Backend: JavaScript running in CommonJS mode.
- Data exchange: JSON and multipart form data.
- Browser features: Web Speech API for playback, `localStorage` for auth and user state.
- Backend runtime: Node.js + Express.
- Frontend runtime: React 19 + Vite.

## Tech Stack

### Frontend

- React 19.2.x
- Vite 8.x
- Axios for API calls
- jsPDF for PDF exports
- ESLint 9.x for linting

### Backend

- Express 5
- MongoDB with Mongoose 9
- Google Gemini via `@google/genai`
- Multer for file uploads
- `pdf-parse` for PDF extraction
- `fast-xml-parser` for transcript XML parsing
- `jsonwebtoken` for JWT auth
- `bcryptjs` for password hashing
- `cors` for origin control
- `dotenv` for environment variables

## Architecture

The application has two major layers.

### Frontend Layer

The frontend is responsible for user interaction, state management, API requests, and local presentation logic.

- Collects pasted text, file uploads, or YouTube URLs.
- Lets the user choose length, format, preset, tone, depth, audience, and language.
- Calls backend endpoints through a shared Axios client.
- Renders summary views, follow-up Q&A, auth UI, history UI, export controls, and voice playback.
- Stores the current user and token in `localStorage`.

### Backend Layer

The backend owns validation, file/text extraction, transcript fetching, Gemini prompting, structured response shaping, auth, and persistence.

- Receives requests from the frontend.
- Extracts text from PDFs, plain text, or YouTube transcripts.
- Normalizes and cleans inputs before summarization.
- Calls Gemini with prompt instructions and fallback logic.
- Returns a structured response object to the frontend.
- Saves and reads summary history in MongoDB.
- Protects history routes with JWT verification.

## Project Structure

```text
.
├── backend
│   └── src
│       ├── config
│       ├── middleware
│       ├── models
│       ├── routes
│       ├── services
│       └── utils
├── frontend
│   └── src
│       ├── App.jsx
│       ├── App.css
│       ├── api.js
│       ├── utils.js
│       ├── main.jsx
│       └── index.css
└── README.md
```

## Backend Architecture

### Entry Point

- [backend/src/index.js](backend/src/index.js) creates the Express app.
- It loads environment variables with `dotenv`.
- It configures CORS with allowed dev origins.
- It enables JSON parsing with a `2mb` body limit.
- It registers the health endpoint and API routers.
- It attaches not-found and error middleware.
- It starts listening on `PORT`.
- It also starts MongoDB connection startup in parallel.

### Middleware

- [backend/src/middleware/authMiddleware.js](backend/src/middleware/authMiddleware.js) reads the `Authorization` header, accepts either `Bearer <token>` or a raw token string, verifies the JWT, and attaches `req.user`.
- [backend/src/middleware/errorHandler.js](backend/src/middleware/errorHandler.js) returns JSON errors with `success: false` and an HTTP status code.
- The not-found handler returns `404` with the route name.

### Routes

- [backend/src/routes/summarizeRoutes.js](backend/src/routes/summarizeRoutes.js) handles document, video, and follow-up summarization.
- [backend/src/routes/authRoutes.js](backend/src/routes/authRoutes.js) handles sign-up and login.
- [backend/src/routes/historyRoutes.js](backend/src/routes/historyRoutes.js) handles save-summary and history retrieval.

### Services

- [backend/src/services/summarizerService.js](backend/src/services/summarizerService.js) coordinates document parsing, transcript extraction, prompt shaping, validation, output cleaning, and response formatting.
- [backend/src/services/geminiService.js](backend/src/services/geminiService.js) wraps Gemini calls, model fallback, cooldown handling, and structured prompt construction.

### Utilities

- [backend/src/utils/textUtils.js](backend/src/utils/textUtils.js) handles cleaning, validation, and keyword extraction.
- [backend/src/utils/youtubeUtils.js](backend/src/utils/youtubeUtils.js) extracts video IDs and downloads transcript text.

### Models

- [backend/src/models/User.js](backend/src/models/User.js) stores user email and password hash.
- [backend/src/models/Summary.js](backend/src/models/Summary.js) stores summary history records.

### Database

- [backend/src/config/db.js](backend/src/config/db.js) connects to MongoDB and throws if `MONGO_URI` is missing.

## Backend Data Flow

### Document Summarization Pipeline

1. Receive multipart form data or pasted text.
2. Parse PDF text with `pdf-parse` or read text/markdown from the uploaded buffer.
3. Clean text with whitespace normalization and null-byte removal.
4. Validate summary length and format.
5. Slice input to the backend limit of 50,000 characters.
6. Build a Gemini prompt with the selected language, preset, tone, depth, audience, length, and output style.
7. Ask Gemini for a structured insight pack.
8. Clean the returned output and shape the API response.

### YouTube Summarization Pipeline

1. Receive a YouTube URL.
2. Extract the video ID from `youtu.be`, `/watch?v=`, `/shorts/`, or `/embed/` URLs.
3. Request player metadata from YouTube’s `youtubei/v1/player` endpoint.
4. Read available caption track metadata.
5. Download transcript text as JSON3 when possible, otherwise fall back to XML parsing.
6. Clean the transcript and enforce the same 50,000-character processing cap.
7. Generate the summary through Gemini.

### Follow-Up Pipeline

1. Receive the summary context and a user question.
2. Limit the context to 50,000 characters.
3. Ask Gemini to answer only from that context.
4. Return a concise answer.

## Gemini Behavior

The backend uses a hardcoded model priority:

1. `gemini-3-flash`
2. `gemini-2.5-flash`
3. `gemini-2.0-flash`

Behavior details:

- The backend starts with the first model on every request.
- If a model is missing, unsupported, quota-limited, overloaded, or temporarily unavailable, it is put on cooldown.
- Cooldown duration comes from `GEMINI_MODEL_COOLDOWN_MS` and defaults to `60000` ms.
- If every model is cooling down, the API returns a `429` response.
- Empty Gemini responses are treated as errors.
- Model and quota errors are normalized into clearer messages.
- If Gemini returns JSON wrapped in text, the backend tries to extract and parse the JSON block.
- If structured JSON parsing fails, the backend falls back to a plain-text summary shape.

### Prompt Rules

The Gemini prompts explicitly ask for:

- No invention of facts.
- Plain text output for normal summaries.
- Structured JSON for the insight pack.
- Follow-up answers only from the provided context.
- Output cleaned of Markdown markers and escape noise.

## Response Shape

Most backend endpoints follow this envelope:

```json
{
  "success": true,
  "data": { }
}
```

Errors use:

```json
{
  "success": false,
  "error": "message"
}
```

## API Endpoints

### Health

`GET /api/health`

Returns:

```json
{
  "success": true,
  "message": "Smart summarizer API is running"
}
```

### Summarization

`POST /api/summarize/document`

- Content type: `multipart/form-data`
- Upload limit: `5 MB`
- Accepted file types: PDF, plain text, markdown
- Fields:
  - `file` optional upload
  - `text` optional pasted text
  - `length` expected values: `short`, `medium`, `long`
  - `format` expected values: `paragraph`, `bullet`
  - `language`
  - `preset`
  - `tone`
  - `depth`
  - `audience`

`POST /api/summarize/video`

- JSON body:
  - `youtubeUrl`
  - `length`
  - `format`
  - `language`
  - `preset`
  - `tone`
  - `depth`
  - `audience`

`POST /api/summarize/followup`

- JSON body:
  - `contextText`
  - `question`
  - `language`

### Authentication

`POST /api/auth/signup`

- JSON body:
  - `email`
  - `password`
- Response contains the new user id and email.

`POST /api/auth/login`

- JSON body:
  - `email`
  - `password`
- Response contains:
  - JWT token
  - user id
  - email
- The token expires in `1d`.

### History

`POST /api/save-summary`

- Protected route.
- Requires `Authorization: Bearer <token>`.
- JSON body:
  - `type` must be `video` or `document`
  - `input`
  - `summary`
  - `metadata` optional object

`GET /api/history`

- Protected route.
- Requires `Authorization: Bearer <token>`.
- Returns the current user’s saved summaries sorted newest first.

## API Validation Rules

- Missing auth token returns `401`.
- Invalid auth token returns `401`.
- Missing `MONGO_URI` stops database connection.
- Missing `GEMINI_API_KEY` stops Gemini generation.
- Unsupported document uploads are rejected at upload time.
- Invalid or empty inputs are rejected before model execution.
- YouTube URLs without a valid video ID are rejected.
- Videos without transcript data return an error.

## Data Model Details

### User

Collection: `User`

- `email` string, unique, lowercase, trimmed, required
- `password` string, required, stores the bcrypt hash
- timestamps enabled

### Summary

Collection: `Summary`

- `userId` ObjectId ref to `User`, indexed, required
- `type` enum: `video` or `document`
- `input` string, required
- `summary` string, required
- `metadata` object, defaults to `{}`
- timestamps enabled

## Frontend Details

### Main Files

- [frontend/src/App.jsx](frontend/src/App.jsx) contains the main UI, state, and business interaction logic.
- [frontend/src/api.js](frontend/src/api.js) centralizes backend requests.
- [frontend/src/utils.js](frontend/src/utils.js) handles copy and export helpers.
- [frontend/src/App.css](frontend/src/App.css) contains the visual design system.
- [frontend/src/index.css](frontend/src/index.css) defines global styles and theme basics.
- [frontend/src/main.jsx](frontend/src/main.jsx) bootstraps React.

### Frontend State And Behavior

The UI tracks:

- Theme choice.
- Current mode: document or video.
- File, text, and YouTube input.
- Summary length, format, preset, tone, depth, audience, and language.
- Summary result data.
- Follow-up message state.
- Authentication form state.
- Current user and auth token.
- History list and loading state.
- Speech synthesis voices and playback rate.

### Frontend Storage

- `summary_user` stores the current user object.
- `token` stores the JWT used for protected requests.

### Voice Playback

- Uses the browser Speech Synthesis API.
- Chooses a locale from the selected language.
- Attempts to prefer a matching female voice when the browser exposes one.
- Cancels playback cleanly on unmount or when requested.

## Frontend API Layer

The Axios client in [frontend/src/api.js](frontend/src/api.js) uses:

- Base URL from `VITE_API_BASE_URL`.
- A `60s` request timeout.
- `Authorization` headers for protected routes.

Available client helpers:

- `summarizeDocument`
- `summarizeVideo`
- `askFollowUp`
- `signupUser`
- `loginUser`
- `saveSummaryHistory`
- `getSummaryHistory`

## Environment Variables

### Backend `.env`

```env
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL_COOLDOWN_MS=60000
JWT_SECRET=your_secret
MONGO_URI=your_mongodb_connection_string
```

Notes:

- `CLIENT_ORIGIN` is used to allow the frontend origin in CORS.
- `GEMINI_MODEL_COOLDOWN_MS` controls how long failed Gemini models stay out of rotation.
- The model priority is hardcoded in `geminiService.js`.

### Frontend `.env`

```env
VITE_API_BASE_URL=http://localhost:5000
```

## Limits And Constraints

- JSON request bodies are limited to `2mb`.
- Uploaded files are limited to `5 MB`.
- Text processed for summary generation is capped at `50,000` characters.
- Summaries and follow-up answers are cleaned before returning to the UI.
- The transcript path depends on YouTube exposing usable caption metadata.
- MongoDB must be available for auth and history routes.

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure Environment Variables

Create `backend/.env` and `frontend/.env` using the examples above.

### 3. Run The Backend

```bash
cd backend
npm run start
```

### 4. Run The Frontend

```bash
cd frontend
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Verification

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Backend health check:

```bash
curl http://localhost:5000/api/health
```

## Troubleshooting

### Frontend does not open

- Make sure Vite is running.
- Open `http://localhost:5173`.

### Backend not reachable

- Make sure `npm run start` is running in `backend/`.
- Check `http://localhost:5000/api/health`.

### Gemini quota or unavailable errors

- The backend falls back across the configured Gemini models.
- If all models are cooling down, wait for the cooldown window or fix quota/billing.

### YouTube transcript unavailable

- Some videos do not expose captions or transcript metadata.
- Try another video or use a document upload instead.

### CORS problems in local development

- Use one of the allowed dev origins: `http://localhost:5173` or `http://127.0.0.1:5173`.
- Ensure `CLIENT_ORIGIN` matches the frontend origin when deployed.

## Feature Summary

- Document summarization
- YouTube summarization
- Follow-up Q&A
- Authentication
- Summary history
- PDF export
- Markdown export
- Presentation-style text export
- Voice playback
- Language selection
- Presets, tone, depth, and audience controls
- Gemini fallback and cooldown strategy

## Notes

- The project currently uses MongoDB-backed auth and history, not just a stateless summarizer.
- The backend is CommonJS, while the frontend uses ES modules.
- The app is built for local development but can be deployed with environment-specific configuration.

## License

No license has been specified yet.
