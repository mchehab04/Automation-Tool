# 05 — Email Intake with AI Triage: Phase 0 Scoping

## What was done

User asked what's needed to read WhatsApp/email enquiries, have AI understand the
query, ask for missing info, and classify the lead. Explored the current app state
(`Lead`/`Activity`/`Quote` Prisma models only, manual intake via `/leads/new`, no
`Conversation`/`Message` model, no email/WhatsApp/LLM packages or webhook endpoints
anywhere in `src/`) and the prior `active/chatroom/chatroom_report.md` design, which
had already scoped this feature but recommended a no-code validation phase first — a
recommendation never executed or reconciled with the actual build.

Produced a requirements plan for that Phase 0, scoped down with the user to **Gmail
only** (WhatsApp deferred) and **human-in-the-loop reply approval** (no autonomous
AI sends).

## Key decisions

- **No in-repo code changes.** Phase 0 is entirely external: n8n (self-hosted) + Gmail
  API + Anthropic API + Slack approval + Google Sheets landing zone — deliberately
  decoupled from this app so it's cheap to abandon if the channel doesn't validate.
- **Gmail only for now**, WhatsApp explicitly deferred to a follow-on phase (official
  Meta WhatsApp Business Cloud API, added as a second n8n trigger feeding the same
  channel-agnostic AI-triage step).
- **Human-in-the-loop drafts**, not autonomous replies — AI drafts (missing-info
  questions, confirmations) route to Slack for staff approval before anything sends to
  a real customer.
- Carried forward the chatroom report's Phase 0 security checklist: official APIs
  only, one pilot dealership per workspace, no link-shareable PII stores, signed
  data-handling agreement, tested kill switch, 30-day hard delete.
- If Phase 0 validates: bring intake into the app directly (`Conversation`/`Message`
  Prisma models, `/api/webhooks/{email,whatsapp}` routes, wire the already-scaffolded
  `LeadSource.EMAIL`/`WHATSAPP` enum values into `createLead`, add a `lead_events`
  audit table) — not attempted yet.

## Outcome

Requirements plan approved by the user. No code, schema, or dependency changes made —
this stage was scoping/planning only. Next action is external account/credential setup
(Google Cloud project + Gmail API, n8n instance, Anthropic API key, Slack workspace),
outside this repo.

## Files touched

- `docs/reports/05-email-intake-phase0-scoping.md` (this report)
