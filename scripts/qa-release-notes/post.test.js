const test = require('node:test');
const assert = require('node:assert/strict');
const { run, shouldPost, COLUMNS, richText } = require('./post');

const BODY = '## What changed\nForgot password page\n## How to test\n- [ ] enter a name → link emailed\n- [ ] unknown name → same message\n';

function mergedEvent(overrides = {}) {
  return {
    repository: { full_name: 'thequipu/UICore' },
    pull_request: {
      merged: true,
      number: 623,
      title: 'feat(login): forgot password page',
      html_url: 'https://github.com/thequipu/UICore/pull/623',
      body: BODY,
      user: { login: 'manish' },
      merged_by: { login: 'naren' },
      base: { ref: 'develop' },
      ...overrides,
    },
  };
}

function fakes() {
  const calls = [];
  let ts = 100;
  const slack = async (method, payload) => {
    calls.push({ method, payload });
    return method === 'chat.postMessage' ? { ts: String(ts++) } : {};
  };
  const comments = [];
  const comment = async (text) => comments.push(text);
  return { calls, slack, comments, comment };
}

test('posts only merges into develop or a release branch', () => {
  assert.equal(shouldPost(mergedEvent()), true);
  assert.equal(shouldPost(mergedEvent({ base: { ref: 'release-BMS-v1' } })), true);
  assert.equal(shouldPost(mergedEvent({ base: { ref: 'main' } })), false);
  assert.equal(shouldPost(mergedEvent({ base: { ref: 'feature/x' } })), false);
  assert.equal(shouldPost(mergedEvent({ merged: false })), false);
});

const TRACKER = { listId: 'F0LIST', url: 'https://slack.test/lists/F0LIST' };

function fieldValues(item) {
  return Object.fromEntries(item.initial_fields.map((field) => {
    const { column_id: column, ...value } = field;
    return [column, value];
  }));
}

test('posts one message carrying the whole checklist, with no thread replies', async () => {
  const { calls, slack, comment } = fakes();

  await run({ event: mergedEvent(), slack, comment, channel: 'C0QA', tracker: TRACKER });

  const posts = calls.filter((c) => c.method === 'chat.postMessage');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].payload.channel, 'C0QA');
  assert.match(posts[0].payload.text, /☐ 1\. enter a name → link emailed\n☐ 2\. unknown name → same message/);
  assert.match(posts[0].payload.text, /QA Test Tracker/);
  assert.equal(calls.filter((c) => c.method === 'reactions.add').length, 0);
});

test('adds one tracker row per case, not tested yet', async () => {
  const { calls, slack, comment } = fakes();

  await run({ event: mergedEvent(), slack, comment, channel: 'C0QA', tracker: TRACKER });

  const items = calls.filter((c) => c.method === 'slackLists.items.create');
  assert.equal(items.length, 2);
  assert.equal(items[0].payload.list_id, 'F0LIST');
  const fields = fieldValues(items[0].payload);
  assert.deepEqual(fields[COLUMNS.testCase], { rich_text: richText('enter a name') });
  assert.deepEqual(fields[COLUMNS.expected], { rich_text: richText('link emailed') });
  assert.deepEqual(fields[COLUMNS.feature], { rich_text: richText('feat(login): forgot password page') });
  assert.deepEqual(fields[COLUMNS.branch], { rich_text: richText('develop') });
  assert.deepEqual(fields[COLUMNS.result], { select: ['not_tested'] });
  assert.deepEqual(fields[COLUMNS.tested], { checkbox: false });
  assert.equal(fields[COLUMNS.pr].rich_text[0].elements[0].elements[0].type, 'link');
  assert.equal(fields[COLUMNS.pr].rich_text[0].elements[0].elements[0].url, 'https://github.com/thequipu/UICore/pull/623');
});

test('tells the PR where its test cases went', async () => {
  const { slack, comments, comment } = fakes();

  await run({ event: mergedEvent(), slack, comment, channel: 'C0QA', tracker: TRACKER });

  assert.deepEqual(comments, ['Posted 2 test cases to #qa-release-notes and the QA Test Tracker for testing.']);
});

test('keeps the channel post when the tracker cannot be written, and says so on the PR', async () => {
  const { calls, comments, comment } = fakes();
  const slack = async (method, payload) => {
    calls.push({ method, payload });
    if (method === 'slackLists.items.create') {
      throw new Error('Slack slackLists.items.create failed: missing_scope');
    }
    return { ts: '100' };
  };

  const outcome = await run({ event: mergedEvent(), slack, comment, channel: 'C0QA', tracker: TRACKER });

  assert.equal(outcome, 'posted');
  assert.equal(calls.filter((c) => c.method === 'chat.postMessage').length, 1);
  assert.match(comments[0], /Posted 2 test cases to #qa-release-notes/);
  assert.match(comments[0], /could not add them to the QA Test Tracker: .*missing_scope/);
});

test('a merged PR without test cases posts nothing and says so on the PR', async () => {
  const { calls, slack, comments, comment } = fakes();

  const outcome = await run({ event: mergedEvent({ body: '## Summary\nrefactor' }), slack, comment, channel: 'C0QA' });

  assert.equal(outcome, 'no-test-cases');
  assert.equal(calls.length, 0);
  assert.match(comments[0], /No "How to test" cases/);
});

test('skips quietly until the Slack token secret is set up', async () => {
  const { comments, comment } = fakes();

  const outcome = await run({ event: mergedEvent(), slack: null, comment, channel: 'C0QA' });

  assert.equal(outcome, 'no-slack-token');
  assert.equal(comments.length, 0);
});

test('does nothing for a PR closed without merging', async () => {
  const { calls, slack, comments, comment } = fakes();

  const outcome = await run({ event: mergedEvent({ merged: false }), slack, comment, channel: 'C0QA' });

  assert.equal(outcome, 'skipped');
  assert.equal(calls.length + comments.length, 0);
});
