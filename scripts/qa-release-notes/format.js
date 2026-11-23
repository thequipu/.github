function buildMessages(pr, notes, { trackerUrl } = {}) {
  const repoName = pr.repo.split('/').pop();
  const lines = [
    `:rocket: *<${pr.url}|${escape(`${repoName}#${pr.number} ${pr.title}`)}>* merged into \`${pr.base}\``,
    `by @${pr.author} · merged by @${pr.mergedBy}`,
  ];
  if (notes.whatChanged) {
    lines.push('', '*What changed*', toSlack(notes.whatChanged));
  }
  if (notes.where) {
    lines.push('', '*Where*', toSlack(notes.where));
  }
  if (notes.blockedBy) {
    lines.push('', ':warning: *Blocked by*', toSlack(notes.blockedBy));
  }
  lines.push('', '*How to test*');
  notes.cases.forEach((testCase, i) => lines.push(`☐ ${i + 1}. ${toSlack(testCase)}`));
  if (trackerUrl) {
    lines.push('', `Mark each case in the <${trackerUrl}|QA Test Tracker>: tick Tested, set Result to Passed / Failed / Blocked.`);
  }
  return { parent: lines.join('\n') };
}

/** One QA Test Tracker row per case; plain markdown, since the tracker renders it itself. */
function buildRows(pr, notes) {
  const repoName = pr.repo.split('/').pop();
  return notes.cases.map((testCase) => ({
    ...splitCase(testCase),
    feature: pr.title,
    pr: `[${repoName}#${pr.number}](${pr.url})`,
    branch: pr.base,
  }));
}

// Cases are written "what to do → expected result"; the first arrow (→ or ->) separates the two
function splitCase(testCase) {
  const match = testCase.match(/^(.*?)\s*(?:→|->)\s*(.*)$/);
  return match
    ? { testCase: match[1].trim(), expected: match[2].trim() }
    : { testCase: testCase.trim(), expected: '' };
}

// Slack's mrkdwn: & < > must be escaped, bold is *x*, links are <url|text>
function toSlack(markdown) {
  return escape(markdown)
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<$2|$1>');
}

function escape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { buildMessages, buildRows, splitCase, toSlack };
