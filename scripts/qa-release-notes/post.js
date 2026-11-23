const fs = require('node:fs');
const { parseQaNotes } = require('./parse');
const { buildMessages, REACTIONS } = require('./format');

const POSTED_BRANCHES = /^(develop|release-.+)$/;
const NO_CASES_COMMENT = 'No "How to test" cases found in this PR, so nothing was posted to #qa-release-notes. '
  + 'Add them under a `## How to test` heading as `- [ ] what to do → expected result` '
  + '(see the PR template) and post them by hand if testers need them.';

function shouldPost(event) {
  const pr = event.pull_request;
  return Boolean(pr && pr.merged && POSTED_BRANCHES.test(pr.base.ref));
}

/**
 * Posts a merged PR's tester notes to Slack: a summary message, then each case as a thread reply carrying the
 * reactions testers click to mark it. `slack(method, payload)` and `comment(text)` are injected for testing.
 */
async function run({ event, slack, comment, channel }) {
  if (!shouldPost(event)) {
    return 'skipped';
  }
  const pr = event.pull_request;
  const notes = parseQaNotes(pr.body);
  if (notes.cases.length === 0) {
    await comment(NO_CASES_COMMENT);
    return 'no-test-cases';
  }
  const messages = buildMessages({
    repo: event.repository.full_name,
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    author: pr.user.login,
    mergedBy: pr.merged_by ? pr.merged_by.login : 'unknown',
    base: pr.base.ref,
  }, notes);

  const parent = await slack('chat.postMessage', { channel, text: messages.parent, unfurl_links: false });
  for (const text of messages.cases) {
    const reply = await slack('chat.postMessage', { channel, thread_ts: parent.ts, text, unfurl_links: false });
    for (const name of REACTIONS) {
      await slack('reactions.add', { channel, timestamp: reply.ts, name });
    }
  }
  await comment(`Posted ${messages.cases.length} test case${messages.cases.length === 1 ? '' : 's'} to #qa-release-notes for testing.`);
  return 'posted';
}

function slackClient(token) {
  return async (method, payload) => {
    const response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!result.ok && result.error !== 'already_reacted') {
      throw new Error(`Slack ${method} failed: ${result.error}`);
    }
    return result;
  };
}

function prCommenter(token, event) {
  return async (text) => {
    const url = `https://api.github.com/repos/${event.repository.full_name}/issues/${event.pull_request.number}/comments`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ body: text }),
    });
    if (!response.ok) {
      // The Slack post is what matters; a failed PR comment is only reported
      console.warn(`Could not comment on the PR: HTTP ${response.status}`);
    }
  };
}

async function main() {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const outcome = await run({
    event,
    slack: slackClient(process.env.SLACK_QA_BOT_TOKEN),
    comment: prCommenter(process.env.GITHUB_TOKEN, event),
    channel: process.env.SLACK_QA_CHANNEL,
  });
  console.log(`qa-release-notes: ${outcome}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { run, shouldPost };
