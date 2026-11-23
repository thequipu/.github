const test = require('node:test');
const assert = require('node:assert/strict');
const { parseQaNotes } = require('./parse');

const BODY = `## Summary
Engineering notes nobody tests from.

## What changed
A signed-out user can change their own password.

## Where
Sign-in page → **Change password** link.

## How to test
<!-- One case per line: "- [ ] what to do → expected result" -->
- [ ] Happy path: enter username, current and new password → "Password updated"
- [x] Wrong current password → "Invalid username or current password."
1. Unknown username → same message as above
- Cancel → back to sign-in

## Blocked by
security-service#91 merged and deployed

## Test plan
- [x] unit tests
`;

test('reads the tester sections by their headings', () => {
  const notes = parseQaNotes(BODY);

  assert.equal(notes.whatChanged, 'A signed-out user can change their own password.');
  assert.equal(notes.where, 'Sign-in page → **Change password** link.');
  assert.equal(notes.blockedBy, 'security-service#91 merged and deployed');
});

test('turns every How to test line into one case, whatever the list style', () => {
  assert.deepEqual(parseQaNotes(BODY).cases, [
    'Happy path: enter username, current and new password → "Password updated"',
    'Wrong current password → "Invalid username or current password."',
    'Unknown username → same message as above',
    'Cancel → back to sign-in',
  ]);
});

test('ignores the engineering Test plan, so unit-test ticks never reach the testers', () => {
  assert.ok(!parseQaNotes(BODY).cases.includes('unit tests'));
});

test('drops the template guidance comments', () => {
  const notes = parseQaNotes('## What changed\n<!-- explain it -->\nReal text\n## How to test\n- [ ] a → b');

  assert.equal(notes.whatChanged, 'Real text');
});

test('matches headings at any level and in any case', () => {
  const notes = parseQaNotes('### what CHANGED\nx\n# how to test\n- [ ] a → b');

  assert.equal(notes.whatChanged, 'x');
  assert.deepEqual(notes.cases, ['a → b']);
});

test('has no cases when the PR has no How to test section, or only the empty template', () => {
  assert.deepEqual(parseQaNotes('## Summary\nfix').cases, []);
  assert.deepEqual(parseQaNotes('## How to test\n<!-- - [ ] case → expected -->\n- [ ] \n').cases, []);
});

test('copes with an empty or missing body', () => {
  assert.deepEqual(parseQaNotes(null).cases, []);
  assert.equal(parseQaNotes('').whatChanged, '');
});
