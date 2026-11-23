const fs = require('node:fs');
const { parseQaNotes } = require('./parse');
const { buildMessages, buildRows } = require('./format');

const POSTED_BRANCHES = /^(develop|release-.+)$/;
const NO_CASES_COMMENT = 'No "How to test" cases found in this PR, so nothing was posted to #qa-release-notes. '
  + 'Add them under a `## How to test` heading as `- [ ] what to do → expected result` '
  + '(see the PR template) and post them by hand if testers need them.';

// Column keys of the Slack list "QA Test Tracker" (F0CL5GU0PEW); read them with Slack's list schema if it is rebuilt
const COLUMNS = {
  testCase: 'Col0CL0DQAASH',
  expected: 'Col0CM03V6KR6',
  feature: 'Col0CL3PA84NA',
  pr: 'Col0CKQB5KQ15',
  branch: 'Col0CL7K1A54H',
  tested: 'Col0CL5GU0CEN',
  result: 'Col0CL9DK34DA',
};
const NOT_TESTED = 'not_tested';

function shouldPost(event) {
  const pr = event.pull_request;
  return Boolean(pr && pr.merged && POSTED_BRANCHES.test(pr.base.ref));
}

/**
 * Posts a merged PR's tester notes: one message in the channel with the What changed / Where / How to test
 * checklist, and one row per case in the QA Test Tracker list, where testers tick Tested and set Passed / Failed.
 * `slack(method, payload)` and `comment(text)` are injected for testing.
 */
async function run({ event, slack, comment, channel, tracker }) {
  if (!shouldPost(event)) {
    return 'skipped';
  }
  // Repos can adopt the workflow before an org admin adds the SLACK_QA_BOT_TOKEN secret; until then it is a no-op
  if (!slack) {
    return 'no-slack-token';
  }
  const pr = event.pull_request;
  const notes = parseQaNotes(pr.body);
  if (notes.cases.length === 0) {
    await comment(NO_CASES_COMMENT);
    return 'no-test-cases';
  }
  const details = {
    repo: event.repository.full_name,
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    author: pr.user.login,
    mergedBy: pr.merged_by ? pr.merged_by.login : 'unknown',
    base: pr.base.ref,
  };

  const { parent } = buildMessages(details, notes, { trackerUrl: tracker && tracker.url });
  await slack('chat.postMessage', { channel, text: parent, unfurl_links: false });

  const count = `${notes.cases.length} test case${notes.cases.length === 1 ? '' : 's'}`;
  if (!tracker) {
    await comment(`Posted ${count} to #qa-release-notes for testing.`);
    return 'posted';
  }
  try {
    for (const row of buildRows(details, notes)) {
      await slack('slackLists.items.create', { list_id: tracker.listId, initial_fields: trackerFields(row, details.url) });
    }
    await comment(`Posted ${count} to #qa-release-notes and the QA Test Tracker for testing.`);
  } catch (error) {
    // The channel post already carries the checklist, so a tracker failure is reported rather than failing the job
    console.warn(`::warning::Could not add rows to the QA Test Tracker: ${error.message}`);
    await comment(`Posted ${count} to #qa-release-notes, but could not add them to the QA Test Tracker: ${error.message}`);
  }
  return 'posted';
}

function trackerFields(row, prUrl) {
  return [
    { column_id: COLUMNS.testCase, rich_text: richText(row.testCase) },
    { column_id: COLUMNS.expected, rich_text: richText(row.expected) },
    { column_id: COLUMNS.feature, rich_text: richText(row.feature) },
    { column_id: COLUMNS.pr, rich_text: linkText(prUrl, row.pr.replace(/^\[(.*)\]\(.*\)$/, '$1')) },
    { column_id: COLUMNS.branch, rich_text: richText(row.branch) },
    { column_id: COLUMNS.tested, checkbox: false },
    { column_id: COLUMNS.result, select: [NOT_TESTED] },
  ];
}

function richText(text) {
  return [{ type: 'rich_text', elements: [{ type: 'rich_text_section', elements: [{ type: 'text', text: text || '-' }] }] }];
}

function linkText(url, text) {
  return [{ type: 'rich_text', elements: [{ type: 'rich_text_section', elements: [{ type: 'link', url, text }] }] }];
}

function slackClient(token) {
  return async (method, payload) => {
    const response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!result.ok) {
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
  const listId = process.env.SLACK_QA_LIST_ID;
  const outcome = await run({
    event,
    slack: process.env.SLACK_QA_BOT_TOKEN ? slackClient(process.env.SLACK_QA_BOT_TOKEN) : null,
    comment: prCommenter(process.env.GITHUB_TOKEN, event),
    channel: process.env.SLACK_QA_CHANNEL,
    tracker: listId ? { listId, url: process.env.SLACK_QA_LIST_URL } : null,
  });
  if (outcome === 'no-slack-token') {
    console.log('::warning::SLACK_QA_BOT_TOKEN is not set, so nothing was posted to #qa-release-notes');
  }
  console.log(`qa-release-notes: ${outcome}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { run, shouldPost, COLUMNS, richText };
