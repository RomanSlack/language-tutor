# Language Tutor

Local voice tutor for Mandarin and Spanish on the OpenAI Realtime API. After each call it logs mistakes to `../error-log.md`, makes Anki cards, and updates a learner profile the next session uses.

1. `npm install`
2. `cp .env.example .env` and add `OPENAI_API_KEY` (set `REALTIME_MODEL=gpt-realtime-2.1-mini` to cut cost).
3. `npm run dev`, open http://localhost:5173, allow the mic.
4. Optional: run Anki with [AnkiConnect](https://ankiweb.net/shared/info/2055492159) so cards go straight into `Mandarin::Tutor` / `Spanish::Tutor`; otherwise they land in `../anki-import-<lang>.tsv`.
5. Data lives one folder up (`DATA_DIR`): `sessions/`, `tutor-data/profile-*.json`, error logs. Scenarios are in `scenarios.json`.
6. In dev, each session's instructions print in the server console and `tutor-data/last-instructions-<lang>.txt`.

Cost shown in the call is an estimate from third-party price figures in `server/config.ts`; check OpenAI's pricing page.
