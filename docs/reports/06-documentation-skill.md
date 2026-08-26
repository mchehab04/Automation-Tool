# 06 — Documentation Skill

## What I did

Built a `documentation` skill (`.claude/skills/documentation/SKILL.md`) so project
notes keep getting written the way I've already been writing them — first person,
what-I-did → why-it-matters → what's-next — instead of drifting into generic report
filler as more of this gets automated. Also wired up the two things the existing
`docs/reports/` habit didn't have yet: a project index and a decision log.

Along the way I also connected Google Calendar and Google Drive as connectors, with
the plan to eventually pull deadlines out of these reports and sync docs to Drive —
that's not built yet, just the accounts are connected.

## Main decisions / findings

- The skill continues the existing `docs/reports/` convention rather than replacing
  it — same numbered-file, same rough heading shape, just with two fields (why it
  matters, next step) made explicit instead of implicit.
- Backfilled `docs/00-project-index.md` and `docs/03-decisions/decision-log.md` from
  the 7 reports that already existed, rather than starting them empty — otherwise the
  index would be missing most of the project's actual history on day one.
- Hit a real tension almost immediately: I asked to "modify one of them [the existing
  reports] to test it out," which conflicts with the skill's own no-rewrite rule
  (and the precedent report 05 set by not editing report 01). Rather than pick
  silently, I asked which was meant, and we landed on this — a new append-only entry
  — instead of editing an old report's text.

## Why this matters

The whole point of the decision log and index is that they're supposed to be trusted
later without re-reading every report. That only holds if entries are added, not
edited-in-place — otherwise "the log says X" stops meaning anything once someone
could have quietly changed X. This report is itself the first real test of that: it's
new, not a rewrite.

## Risks / things to keep in mind

- The index and decision log are only as good as I keep them — nothing enforces that
  every future report actually gets indexed. Worth checking back on this in a few
  reports.
- Drive sync is configured (`docs/.documentation-config.json`) but `drive_root` is
  still `null` — nothing has been uploaded, and nothing should be until that's
  confirmed and the sync step is actually run.

## Files touched

- `.claude/skills/documentation/SKILL.md` (new)
- `docs/00-project-index.md` (new, backfilled)
- `docs/03-decisions/decision-log.md` (new, backfilled)
- `docs/.documentation-config.json` (new)
- `docs/reports/06-documentation-skill.md` (this report)

## Next step

Decide on the Drive root folder name and run a real sync once there's a batch of
reports worth pushing. Separately: use the Calendar connector to turn the "next step"
lines scattered across these reports into actual deadlines.
