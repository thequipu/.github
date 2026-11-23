// The tester-facing sections of a PR description, as laid out by the org's pull_request_template.md.
const SECTIONS = {
  'what changed': 'whatChanged',
  where: 'where',
  'how to test': 'howToTest',
  'blocked by': 'blockedBy',
};

const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?(.*)$/;

function parseQaNotes(body) {
  const text = String(body || '').replace(/<!--[\s\S]*?-->/g, '');
  const collected = { whatChanged: [], where: [], howToTest: [], blockedBy: [] };
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(HEADING);
    if (heading) {
      // Any other heading ("Summary", "Test plan", ...) ends the section, so engineering notes stay out
      current = SECTIONS[heading[1].trim().toLowerCase()] || null;
      continue;
    }
    if (current) {
      collected[current].push(line);
    }
  }
  return {
    whatChanged: block(collected.whatChanged),
    where: block(collected.where),
    blockedBy: block(collected.blockedBy),
    cases: collected.howToTest
      .map((line) => line.match(LIST_ITEM))
      .filter(Boolean)
      .map((item) => item[1].trim())
      .filter((testCase) => testCase.length > 0),
  };
}

function block(lines) {
  return lines.join('\n').trim();
}

module.exports = { parseQaNotes };
