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

1. one message with the PR link, branch, author, What changed, Where, Blocked by and the numbered **How to test**
   checklist, and
2. one row per case in the Slack list **QA Test Tracker** (`F0CL5GU0PEW`): Test case, Expected result (the part after
   the first `→`), Feature (the PR title), PR, Branch, a **Tested** checkbox and **Result** (Not tested / Passed /
   Failed / Blocked), plus Tester and Notes for the testers to fill in.

If the rows cannot be added, the message still goes out and the PR comment says why. A merged PR with no `How to test`
cases is not posted; the bot comments on the PR instead. Questions about a change go in its thread.

### Pieces
- `scripts/qa-release-notes/`: `parse.js` (reads the sections), `format.js` (Slack messages), `post.js` (posts;
  run by the workflow). No dependencies; tests: `node --test scripts/qa-release-notes/`.
- `.github/workflows/qa-release-notes.yml`: the reusable workflow.
- `workflow-templates/qa-release-notes.yml`: the 15-line caller each repo adds as
  `.github/workflows/qa-release-notes.yml` (also offered under *Actions → New workflow* in every repo).

### One-time setup
1. **Slack app** (a workspace admin): create an app in the quipuco workspace with bot scopes `chat:write` and
   `lists:write`, install it, invite it to #qa-release-notes (`/invite @<app name>`) and give it edit access to the
   QA Test Tracker list (list → Share). The tracker's column keys are in `post.js` (`COLUMNS`).
2. **Org secret**: save its *Bot User OAuth Token* (`xoxb-…`) as organisation secret `SLACK_QA_BOT_TOKEN`, available
   to the repos that post.
3. **This repo must stay public**: the shared workflow fetches the script from it with each caller's own token, and an
   org's default PR template only applies from a public `.github` repo. It holds no secrets.
4. Add the caller workflow to each repo.
