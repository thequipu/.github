const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMessages, buildRows, splitCase, toSlack } = require('./format');

const PR = {
  repo: 'thequipu/UICore',
  number: 623,
  title: 'feat(login): forgot password page',
  url: 'https://github.com/thequipu/UICore/pull/623',
  author: 'manish',
  mergedBy: 'naren',
  base: 'develop',
};

const NOTES = {
  whatChanged: 'A user can get a **reset link** by email.',
  where: 'Sign-in page → Forgot password?',
  blockedBy: '',
  cases: ['Enter a username → "we\'ve emailed a link"', 'Unknown name → same message'],
};

test('the parent message names the PR, the branch it landed on and who to ask', () => {
  const { parent } = buildMessages(PR, NOTES);

  assert.match(parent, /<https:\/\/github\.com\/thequipu\/UICore\/pull\/623\|UICore#623 feat\(login\): forgot password page>/);
  assert.match(parent, /merged into `develop`/);
  assert.match(parent, /by @manish · merged by @naren/);
});

test('the parent message carries what changed and where, in Slack formatting', () => {
  const { parent } = buildMessages(PR, NOTES);

  assert.match(parent, /\*What changed\*\nA user can get a \*reset link\* by email\./);
  assert.match(parent, /\*Where\*\nSign-in page → Forgot password\?/);
});

test('the parent message lists every test case as a numbered checklist', () => {
  const { parent } = buildMessages(PR, NOTES);

  assert.match(parent, /\*How to test\*/);
  assert.match(parent, /☐ 1\. Enter a username → "we've emailed a link"\n☐ 2\. Unknown name → same message/);
});

test('the parent message sends testers to the tracker to mark results', () => {
  const { parent } = buildMessages(PR, NOTES, { trackerUrl: 'https://slack.test/lists/F1' });

  assert.match(parent, /<https:\/\/slack\.test\/lists\/F1\|QA Test Tracker>/);
  assert.match(parent, /Passed \/ Failed/);
});

test('a Blocked by section is shown only when there is one', () => {
  assert.doesNotMatch(buildMessages(PR, NOTES).parent, /Blocked by/);
  assert.match(buildMessages(PR, { ...NOTES, blockedBy: 'SMTP in Vault' }).parent, /:warning: \*Blocked by\*\nSMTP in Vault/);
});

test('each case becomes a tracker row, split into what to do and what should happen', () => {
  assert.deepEqual(buildRows(PR, NOTES), [
    {
      testCase: 'Enter a username',
      expected: '"we\'ve emailed a link"',
      feature: 'feat(login): forgot password page',
      pr: '[UICore#623](https://github.com/thequipu/UICore/pull/623)',
      branch: 'develop',
    },
    {
      testCase: 'Unknown name',
      expected: 'same message',
      feature: 'feat(login): forgot password page',
      pr: '[UICore#623](https://github.com/thequipu/UICore/pull/623)',
      branch: 'develop',
    },
  ]);
});

test('splits a case at its first arrow, ASCII or not, and keeps a case without one whole', () => {
  assert.deepEqual(splitCase('click Save -> saved → shown'), { testCase: 'click Save', expected: 'saved → shown' });
  assert.deepEqual(splitCase('just check the page'), { testCase: 'just check the page', expected: '' });
});

test('converts markdown bold and links, and escapes what Slack would read as markup', () => {
  assert.equal(toSlack('**bold** and [PR](https://x.test/1)'), '*bold* and <https://x.test/1|PR>');
  assert.equal(toSlack('a < b && c > d'), 'a &lt; b &amp;&amp; c &gt; d');
});
