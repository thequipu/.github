// Testers react on each case reply; the bot adds these three so marking is one click.
const REACTIONS = ['white_check_mark', 'x', 'eyes'];
const LEGEND = ':white_check_mark: working · :x: not working · :eyes: testing';

function buildMessages(pr, notes) {
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
  const count = notes.cases.length;
  lines.push('', `*How to test*: ${count} case${count === 1 ? '' : 's'} in the thread :point_down:  React on each: ${LEGEND}`);
  return {
    parent: lines.join('\n'),
    cases: notes.cases.map((testCase, i) => `*${i + 1}/${count}*  ${toSlack(testCase)}`),
  };
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

module.exports = { buildMessages, toSlack, REACTIONS };
