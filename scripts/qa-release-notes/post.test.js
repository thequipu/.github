const test = require('node:test');
const assert = require('node:assert/strict');
const { run, shouldPost } = require('./post');

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

test('posts the summary, then each case as a reply in its thread', async () => {
  const { calls, slack, comment } = fakes();

  await run({ event: mergedEvent(), slack, comment, channel: 'C0QA' });

  const posts = calls.filter((c) => c.method === 'chat.postMessage');
  assert.equal(posts.length, 3);
  assert.equal(posts[0].payload.channel, 'C0QA');
  assert.equal(posts[0].payload.thread_ts, undefined);
  assert.match(posts[0].payload.text, /What changed/);
  assert.deepEqual(posts.slice(1).map((p) => p.payload.thread_ts), ['100', '100']);
  assert.match(posts[1].payload.text, /^\*1\/2\*  enter a name → link emailed$/);
});

test('adds the three marking reactions to every case, not to the summary', async () => {
  const { calls, slack, comment } = fakes();

  await run({ event: mergedEvent(), slack, comment, channel: 'C0QA' });

  const reactions = calls.filter((c) => c.method === 'reactions.add').map((c) => `${c.payload.timestamp}:${c.payload.name}`);
  assert.deepEqual(reactions, [
    '101:white_check_mark', '101:x', '101:eyes',
    '102:white_check_mark', '102:x', '102:eyes',
  ]);
});

test('tells the PR where its test cases went', async () => {
  const { slack, comments, comment } = fakes();

  await run({ event: mergedEvent(), slack, comment, channel: 'C0QA' });

  assert.deepEqual(comments, ['Posted 2 test cases to #qa-release-notes for testing.']);
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
