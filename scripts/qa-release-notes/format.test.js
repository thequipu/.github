const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMessages, toSlack, REACTIONS } = require('./format');

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

test('the parent message says how many cases follow and how to mark them', () => {
  const { parent } = buildMessages(PR, NOTES);

  assert.match(parent, /\*How to test\*: 2 cases in the thread/);
  assert.match(parent, /:white_check_mark: working/);
  assert.match(parent, /:x: not working/);
  assert.match(parent, /:eyes: testing/);
});

test('a Blocked by section is shown only when there is one', () => {
  assert.doesNotMatch(buildMessages(PR, NOTES).parent, /Blocked by/);
  assert.match(buildMessages(PR, { ...NOTES, blockedBy: 'SMTP in Vault' }).parent, /:warning: \*Blocked by\*\nSMTP in Vault/);
});

test('each case is its own numbered reply', () => {
  assert.deepEqual(buildMessages(PR, NOTES).cases, [
    '*1/2*  Enter a username → "we\'ve emailed a link"',
    '*2/2*  Unknown name → same message',
  ]);
});

test('testers mark cases with the working / not working / testing reactions', () => {
  assert.deepEqual(REACTIONS, ['white_check_mark', 'x', 'eyes']);
});

test('converts markdown bold and links, and escapes what Slack would read as markup', () => {
  assert.equal(toSlack('**bold** and [PR](https://x.test/1)'), '*bold* and <https://x.test/1|PR>');
  assert.equal(toSlack('a < b && c > d'), 'a &lt; b &amp;&amp; c &gt; d');
});
