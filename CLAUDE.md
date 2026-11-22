# Oustad Walid · الأستاذ وليد

Build a speaking-first German platform from A1 to C2 for Moroccan learners. Ship a complete A1 MVP first, with Moroccan Darija explanations, everyday German, Goethe/telc speaking preparation and Ausbildung practice.

Use Next.js App Router, TypeScript, mobile-first Tailwind CSS, RTL Arabic/Darija and isolated LTR German. Use bundled curriculum JSON on every host. On Vercel and in database-free installs, keep learner progress, corrections and SRS in browser localStorage. Preserve the existing Prisma/SQLite path for configured local installs. Scope learner data to a User through userId relations so a later Supabase migration can retain ownership.

## Grammar colours

| Meaning        | Tailwind class  |
| -------------- | --------------- |
| der, masculine | text-blue-600   |
| die, feminine  | text-red-600    |
| das, neuter    | text-green-600  |
| plural         | text-orange-500 |
| Dativ          | text-purple-600 |
| Akkusativ      | text-amber-500  |

Apply these colours consistently to marked grammar in examples, vocabulary and practice. Mark case when the example teaches case.

## Voice and AI

Keep the app usable for $0. Never use OpenAI APIs or paid services. Use the chat route for text generation, with the phone key in x-gemini-api-key or the optional server GEMINI_API_KEY. Text chat tries models strongest first: gemini-3.8-flash, gemini-3.6-flash, gemini-3-flash, gemini-2.5-flash, gemini-3.5-flash-lite, gemini-3.1-flash-lite, then gemma-4-31b (no JSON mode, so parse its reply with a regex JSON fallback). The browser keeps per-model state in localStorage and sends it with each chat request: the first 429 rests a model for 65 seconds, a 429 on the retry right after that rest marks its daily quota spent until 00:00 UTC. The route returns activeModel and the updated state, and the chat shows the active model in a small badge. Live voice connects directly from the browser to Google's WebSocket using the phone owner's key. Live tries gemini-3.8-live, gemini-3-flash-live, then gemini-2.5-flash-native-audio-dialog. On a 429 or RESOURCE_EXHAUSTED, rest that model 65 seconds, switch to the next and hand off a compact summary of the last six transcript turns in the new system instruction. When gemini-3.8-live's rest ends, switch back at the next pause when neither side is speaking, opening the new session before closing the old one. Show the active Live model and any rest countdown in a subtle badge. Save that key only on their device. Keep keys out of logs, source control and analytics. Use only a free-tier key. Missing keys and upstream errors must select contextual mock replies. Validate the strict tutor JSON response and return at most two mistakes.

Abstract STTProvider and TTSProvider. Use browser SpeechRecognition with de-DE/ar-MA and permanent text input. Use browser speech synthesis by default, with slow, normal and fast speeds. Offer optional msedge-tts via app/api/tts/route.ts with de-DE-ConradNeural and ar-MA-JamalNeural, falling back to browser synthesis on failure. Pause push-to-talk recognition while synthesizing a text reply. In Live mode, keep the echo-cancelled microphone open for interruption, stream 16 kHz PCM, play server PCM and display both transcripts. Release audio resources when the call ends. Never persist raw audio.

## Tutor

Oustad Walid is a patient, encouraging Moroccan German teacher living in Germany. Give practical advice and explain grammar and mistakes in simple Moroccan Darija. Correct at most one or two important mistakes each turn. Aim for 60% simple German and 40% Darija at A1–A2, 85% German and 15% Darija at B1–B2, and 100% professional or academic German at C1–C2.

## A1 release

Maintain six modules, each with five lessons, 25 vocabulary entries and at least three interactive exercises. Preserve lesson progress, mistakes and SRS cards when reseeding. Verify Prisma generation, schema push, seed and the production build before delivery.
