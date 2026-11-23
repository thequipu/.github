# thequipu/.github

Organisation-wide GitHub defaults.

## PR template
`.github/pull_request_template.md` is the default PR description for every thequipu repo that has no template of
its own. Besides the reviewer sections (Summary, Test plan) it has the **tester** sections:

| Section | Posted to Slack | What goes in it |
|---|---|---|
| `## What changed` | yes | Plain-words description for testers |
| `## Where` | yes | Screens, endpoints, environments |
| `## How to test` | yes, one reply per case | `- [ ] what to do → expected result`, one per line |
| `## Blocked by` | yes, if present | What must happen before it can be tested |

## QA release notes (Slack)
When a PR is **merged into `develop` or a `release-*` branch**, its tester sections are posted to Slack
**#qa-release-notes**:

1. a summary message (PR link, branch, author, What changed, Where, Blocked by), then
2. one thread reply per `How to test` case, each carrying the reactions testers click:
   :white_check_mark: working · :x: not working · :eyes: testing.

A merged PR with no `How to test` cases is not posted; the bot comments on the PR instead. Questions about a change go
in its thread.

### Pieces
- `scripts/qa-release-notes/`: `parse.js` (reads the sections), `format.js` (Slack messages), `post.js` (posts;
  run by the workflow). No dependencies; tests: `node --test scripts/qa-release-notes/`.
- `.github/workflows/qa-release-notes.yml`: the reusable workflow.
- `workflow-templates/qa-release-notes.yml`: the 15-line caller each repo adds as
  `.github/workflows/qa-release-notes.yml` (also offered under *Actions → New workflow* in every repo).

### One-time setup
1. **Slack app** (a workspace admin): create an app in the quipuco workspace with bot scopes `chat:write` and
   `reactions:write`, install it, and invite it to #qa-release-notes (`/invite @<app name>`).
2. **Org secret**: save its *Bot User OAuth Token* (`xoxb-…`) as organisation secret `SLACK_QA_BOT_TOKEN`, available
   to the repos that post.
3. **This repo must stay public**: the shared workflow fetches the script from it with each caller's own token, and an
   org's default PR template only applies from a public `.github` repo. It holds no secrets.
4. Add the caller workflow to each repo.
