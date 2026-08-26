---
name: documentation
description: Document project progress continuously in the project's own report style — progress logs, decision log, project index, and Google Drive sync prep. Use whenever the user asks to write up progress, log a decision, update the project index, or sync docs to Drive.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Project Documentation

## Goal

Keep a running, honest project log — not a corporate audit. Every doc explains what
happened, why the decision was made, what changed, and what's next, in first person,
the way the founder would write it themselves.

This project already has a documentation habit (`docs/reports/`, numbered files,
"what was done / key decisions / outcome / files touched"). This skill continues that
habit — it doesn't replace it — and adds two things that were missing: a project index
and a decision log, both of which get updated incrementally, not rewritten.

## Voice

- First person when it's about the user's own project decisions.
- Explain the thought process, not just the outcome — why an option was rejected
  matters as much as what was picked.
- Simple headings, sequential progression: what I did → what I learned → what I
  decided → what's next.
- Keep technical detail, but say why it matters, not just what it is.
- Say "not sure yet" / "this could bite us later" directly. Don't smooth over risk to
  make the entry read cleaner.
- Bullets when they make a decision easier to scan; prose when the reasoning needs the
  connective tissue.
- No consultant voice. No "leveraged," "synergy," "robust," "seamless." No padding a
  one-paragraph update into a five-heading report.

## Workflow

### 1. Understand current state before writing anything

Before drafting a doc, check:
- recent git changes (`git status`, `git diff`, `git log -n 10 --oneline`) if the repo
  has uncommitted or recent work relevant to the note
- the files actually touched, not just what was discussed
- open questions or deferred items mentioned earlier in the conversation
- anything in `docs/00-project-index.md` or `docs/03-decisions/decision-log.md` this
  new entry should link back to or supersede

Never describe a file as changed, or a decision as made, without having actually
checked it. Distinguish completed work from planned work explicitly.

### 2. Classify the document

- **progress log** — routine "here's what happened" note → `docs/reports/`
- **decision log entry** — a real fork-in-the-road choice → `docs/03-decisions/decision-log.md`
  (append, don't create a new file)
- **research note** — exploration that didn't (yet) produce a decision → `docs/reports/`
- **milestone / weekly report** — recurring, dated → `docs/reports/`
- **project index update** — happens automatically after any of the above → `docs/00-project-index.md`
- **Drive sync** — only when the user asks, or a batch of new reports has piled up
  unsynced

Most requests are a progress log that also touches the decision log if a real decision
was in it. Don't force a document into a type it doesn't fit.

### 3. Write it

Default shape (adapt headings to what the entry actually needs — don't pad):

```
# NN — Title

## What I did
## Main decisions / findings
## Why this matters
## Risks / things to keep in mind      (omit if genuinely none)
## Files touched
## Next step
```

This is the same skeleton the existing reports already use (`What was done` / `Key
decisions` / `Outcome` / `Files touched`), extended with the two fields that were
implicit before: why it matters, and what's next. Use whichever heading names read
naturally for the entry — consistency of structure matters more than exact wording.

### 4. Update the project index

After creating or materially updating a doc, add/update its row in
`docs/00-project-index.md`: title, one-line description, date, folder location,
current project phase. Never remove history — supersede it with a note.

### 5. Update the decision log

If the doc contains a real decision (a fork that was actually debated, not just "did
the obvious thing"), append an entry to `docs/03-decisions/decision-log.md`:
decision, date, context, reason, alternatives considered, risk/follow-up. Append-only —
a later decision that reverses an earlier one gets its own new entry that references
the old one, it doesn't edit history.

### 6. Google Drive sync (only if asked, or config says to)

Check `docs/.documentation-config.json` for `drive_root` and `sync_mode`. If Drive
tools are available in this session (Drive MCP connector tools, or a locally synced
Drive folder):
- confirm the Drive root once (skip if already saved in the config)
- check whether the project folder already exists in Drive before creating one —
  never create a second folder with a slightly different name
- mirror `docs/`'s logical structure, but with clean human-facing folder names (e.g.
  local `docs/reports/` → Drive `Progress Reports`)
- create/update the Markdown files that changed since `last_synced`; update that
  field in the config afterward

If no Drive access is available in this session: say so plainly, finish the local
files, and say they're ready to sync once Drive is connected. **Never say a file was
uploaded unless a Drive tool was actually called this turn.**

## File naming

- Sequential logs: `NN-short-slug.md` in `docs/reports/`, matching the numbering
  already in use. Note: the existing history already has two `02`s and two `05`s
  (untracked drift, not something to silently renumber) — just don't repeat it going
  forward; check the highest existing number before picking the next one.
- Recurring reports: `YYYY-MM-DD-weekly-report.md` / `YYYY-MM-DD-milestone-report.md`
  in `docs/reports/`.
- Lowercase, hyphenated, no spaces.

## Boundaries

- Document real progress. Never invent a decision, a finished feature, or a date that
  wasn't actually established in the conversation or the repo.
- Don't rewrite or "correct" old reports to match a later decision — the whole point
  of `docs/reports/05-vertical-pivot-car-garage.md` existing instead of editing
  `01-idea-scoping-chatroom.md` in place is that the original record stays intact.
  Follow that same pattern.
- Don't touch code beyond a small supporting change docs genuinely require (e.g. a
  comment pointing at a report) — this skill writes docs, not features.
- Don't upload to Drive without an available connection and, the first time, explicit
  confirmation of the Drive root.
- Don't create a long formal report for a two-line update. Match the doc's weight to
  the size of the thing that actually happened.
