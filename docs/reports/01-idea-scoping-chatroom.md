# 01 — Idea Scoping via Agent Chatroom

## What was done

Ran the `agent-chatrooms` skill against the founder's initial brainstorm for an SME sales-pipeline automation product. Five agents (Product Strategist, GTM & Business Strategist, Technical Architect, ML/Data Pragmatist, Security Engineer) debated over 3 rounds, converging on a concrete build plan.

## Key decisions

- **Launch vertical: auto dealership** (not home services/contractors, which was the GTM Strategist's initial pick on market-structure grounds). Decided on founder-network access, not market elegance — the GTM Strategist reversed their own position once the group traced the argument through to "who actually signs pilot #1." Scoped narrowly to quote-to-cash only; financing/trade-in/F&I explicitly deferred.
- **Tenant isolation: schema-per-tenant during pilot (~1–15, or ~40 for dealership given GLBA exposure), with CI-tested RLS built as day-one scaffolding**, migrating to shared-schema+RLS at a written numeric trigger. The Security Engineer reversed their own Round 1 recommendation (shared-schema+RLS) after reasoning through failure-mode silence vs. loudness, not just failure probability.
- **No trained ML model at launch.** A transparent, tenant-editable heuristic score + LLM intent tagging ships instead, gated behind ≥500 resolved leads, ≥90% reason-code coverage, and contractual opt-in. Established as a better sales-demo artifact than premature ML, not just a cost-saving compromise.
- **Monolith-first, standardize-the-core-configure-three-surfaces-only** architecture, with a mandatory no-code (n8n/Make) validation phase before any bespoke build.
- The supplied React/shadcn dashboard component becomes the literal reference shell, refactored to pull tenant-scoped live data.

## Outcome

Full convergence across all 5 agents by Round 3, including two genuine position reversals (GTM Strategist on vertical, Security Engineer on isolation strategy) driven by direct challenge from another agent — not rubber-stamped agreement. Unresolved risks were named explicitly rather than smoothed over (see report for full list): vertical choice conflates distribution access with product-market fit; dealership's true job-to-be-done may be wider than the scoped MVP; application-layer tenant-routing bugs aren't solved by either isolation strategy; reason-code data quality is the real bottleneck for any future ML.

## Files touched

- `active/chatroom/chat.json` — full 3-round structured transcript
- `active/chatroom/chatroom_report.md` — human-readable synthesis and recommended action
