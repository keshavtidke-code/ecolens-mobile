# EcoLens Mobile

React Native (Expo SDK 56) client for the EcoLens FastAPI backend. Every screen talks to the real API; there are no mocks.

**Stack:** Expo Router · TypeScript (strict) · NativeWind v4 (Tailwind 3) · Axios · expo-camera · expo-location · expo-sqlite
(plus expo-secure-store for tokens and expo-file-system for draft photos).

## Run it

```bash
# 1. backend (from the backend repo)
uvicorn app.main:app --host 0.0.0.0 --port 8000     # needs GEMINI_API_KEY for analysis/lesson/chat

# 2. app
cd ecolens-mobile
npm install
npx expo install --fix        # aligns every Expo package to the installed SDK
npx expo-doctor
cp .env.example .env          # set EXPO_PUBLIC_API_URL (see below)
npx expo start -c
```

| Where the app runs | `EXPO_PUBLIC_API_URL` |
|---|---|
| Android emulator | `http://10.0.2.2:8000` |
| iOS simulator | `http://localhost:8000` |
| Physical phone | `http://<computer LAN IP>:8000` |
| Production | `https://…` (plain HTTP is only for local development) |

The address can also be changed at runtime from the splash error panel or **Settings → Server**.
Use a development build (`npx expo run:android|ios`) or Expo Go for SDK 56.

## The flow

```
Splash ─ auth bootstrap (anonymous device account)
Home ─ New observation
Camera ─ takePictureAsync
Review ─ GPS (expo-location) + GET /weather/preview + optional note
         ├─ "Analyze ecosystem" ─┐   photo is first saved as a SQLite draft (offline safe)
         └─ "Save draft" (home)  │
Analyzing ─ POST /observations → POST …/analyze → POST …/learning-experience
Result ─ GET /observations/{id}
Lesson ─ POST …/learning-experience (idempotent, cached)
Challenge ─ checklist, reflection, recommended action (stored locally)
Ask AI ─ GET/POST …/chat, GET …/chat/suggestions
Save to journal ─ POST /journal  →  Journal detail (edit title/notes, favourite, delete)
Journal tab ─ GET /journal (cursor pagination, favourites filter)
Settings ─ profile, server address, drafts, sign out, delete account
```

## Structure

```
app/                       Expo Router routes (one file per screen)
  _layout.tsx              providers, auth gate, stack
  index.tsx                1 Splash
  (tabs)/home|journal|settings.tsx   2, 10, 12
  camera.tsx  review.tsx  analyzing.tsx          3, 4, 5
  observation/[id]/result|lesson|challenge|chat.tsx   6, 7, 8, 9
  entry/[id].tsx           11 Journal detail
src/
  api/        types.ts (contracts) · client.ts (axios, refresh) · errors.ts · auth/observations/journal/chat
  db/         SQLite: drafts, challenge_progress, kv
  services/   observationPipeline (resumable) · location · draftFiles
  store/      AuthProvider
  hooks/      useAsync · useLearning · useSaveToJournal
  components/ ui/ (Button, Card, States, …) · domain/ (WeatherCard, ChatBubble, …)
```

## Design decisions

- **Typed contracts.** `src/api/types.ts` mirrors the FastAPI schemas. Screens never see Axios errors: every failure becomes an `ApiError` with a user-safe `message`, a stable `code`, `retryable`, and `retryAfterSeconds` (for 429).
- **Auth.** First launch creates an anonymous account (`POST /auth/anonymous`); tokens live in SecureStore. A 401 triggers one single-flight refresh and a retry. If the refresh token is rejected the app returns to the splash.
- **Offline drafts.** The photo is copied to permanent storage and recorded in SQLite *before* any network call. The pipeline stores its progress on the draft (`queued → uploaded → analyzed`), so a retry never re-uploads, and a lost response is detected via `GET /observations/{id}/status`. A concurrent `409 analysis_in_progress` is polled instead of re-run.
- **Chat.** Optimistic user bubble, retry on failure, cooldown on `429`, suggestions refreshed after each answer, 1000-character limit as in the backend.
- **Photos** need the bearer token, so images use `source={{ uri, headers }}` (`ObservationPhoto`).

## Known limitations

- **Challenge/action completion is local only.** The backend has no endpoint to complete them, so progress lives in SQLite on the device.
- **No email sign-in UI.** `authApi.login/register` exist, but only the anonymous account is wired to screens. Signing out of an anonymous account makes its data unreachable (the app warns).
- **Photos come from the camera only** (no gallery picker).
- **Android + HTTP:** release builds block cleartext traffic; use HTTPS in production.
- Chat keyboard offset on iOS is a fixed constant (90 pt).
