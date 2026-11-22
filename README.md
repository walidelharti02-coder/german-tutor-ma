# Oustad Walid · الأستاذ وليد

Learn German on your phone with Moroccan Darija explanations. The A1 course includes 6 modules, 30 lessons, 150 vocabulary entries and 30 interactive exercises.

## Deploy from your phone

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fwalidelharti02-coder%2Fgerman-tutor-ma)

1. Tap **Deploy with Vercel**, sign in and deploy with the default Next.js settings. For a private source repository, open **Vercel → Add New → Project**, connect your GitHub account and import `german-tutor-ma`. Both paths require the source code to be present in the repository.
2. Open the resulting **HTTPS** deployment on your phone. Lessons, vocabulary, review and mock text conversations work immediately. Vercel needs zero database settings or server secrets.
3. Set `GEMINI_API_KEY` in the Vercel project’s production environment and redeploy to enable chat and Live for everyone. Each Live connection gets a short-lived, single-use token scoped to its model. To use a personal key instead, tap **مفتاح الذكاء الاصطناعي** on the dashboard or in the tutor room. Paste your personal Gemini API key and save. Use a project with billing disabled for free-tier use. [Get an API key](https://aistudio.google.com/api-keys)
4. Open **غرفة المحادثة → مكالمة صوتية مباشرة → بدا المكالمة**, allow microphone access and start speaking. Use **اضغط وتكلّم أو كتب** for push-to-talk, role-play, exam practice and text chat.

## Voice and model availability

Live calls send mono 16-bit little-endian PCM at 16 kHz from the browser to Google's WebSocket. The tutor understands German and Darija, transcribes both speakers, and plays returned audio at its declared sample rate (normally 24 kHz). You can interrupt while the tutor speaks. Ending the call, switching modes, leaving the page or backgrounding the tab releases the microphone. The transcript is held in page memory.

Live calls try models strongest first: `gemini-3.8-live`, then `gemini-3-flash-live`, then `gemini-2.5-flash-native-audio-dialog`. When Google answers `429` / `RESOURCE_EXHAUSTED` for the per-minute token limit, the app rests that model for 65 seconds, reconnects to the next one and passes a short summary of the last six transcript turns so the tutor continues where you were. When `gemini-3.8-live` has rested, the call moves back to it at the next pause when neither you nor the tutor is speaking. A small badge on the call screen shows the active model and the countdown while the main model rests. [Google model catalog](https://ai.google.dev/gemini-api/docs/models)

Text chat tries `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3-flash`, `gemini-2.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite` and `gemma-4-31b` in order. The phone remembers each model's state in localStorage: the first `429` rests a model for 65 seconds, and the stronger model is tried again after that. A second `429` right after the rest marks that model's daily quota as used until 00:00 UTC. The chat header shows which model answered. Missing keys, exhausted attempts or rejected credentials switch text chat to its local mock tutor. Free access, model availability, session limits and daily quotas depend on your Google project. Check its current allowance in AI Studio. [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

## Data on the phone

The deployment bundles the A1 curriculum. Lesson completions, corrections and spaced-repetition cards are saved in this browser's localStorage for this deployment address. Clearing site data resets progress and removes the saved key. Opening a different browser or deployment address starts a separate learner record.

The password field saves the key on the phone. Text chat sends the key over HTTPS in the `x-gemini-api-key` header to the app's chat function, which uses it for the Google request. Live voice uses it directly with Google. Use **مسح المفتاح** in key settings to remove it. The app never saves raw audio.

The review queue includes due and overdue cards. Hard returns a card in one day, Medium advances one step, and Easy advances two along the 1, 3, 7, 14 and 30 day schedule.

## Local development

Use Node.js 22.12+ or 24 LTS. For the same browser storage mode as Vercel, start from a fresh checkout:

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. For the original single-user SQLite mode, run `npm run setup` before starting the server. This creates a local `.env`, applies the schema and seeds the default user and course. Existing SQLite progress and review schedules remain available. The optional server-side `GEMINI_API_KEY` supports text chat. Live voice always uses a key entered on the device.

```bash
npm run lint
npm run build
npm start
```

The production build generates Prisma Client for optional local installations. Cloud operation does not require a SQLite file, schema push or seed step.
