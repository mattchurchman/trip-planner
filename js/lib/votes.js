// Pure ranking helpers for candidates, places and stays. See SPEC.md §7.3.

const POINTS = { must: 2, nice: 1, skip: -1 };

export function voteScore(votes = {}) {
  return Object.values(votes || {}).reduce((sum, choice) => sum + (POINTS[choice] || 0), 0);
}

export function voteCounts(votes = {}) {
  const counts = { must: 0, nice: 0, skip: 0 };
  for (const choice of Object.values(votes || {})) {
    if (choice in counts) counts[choice] += 1;
  }
  return counts;
}

/** e.g. "2 must · 1 nice · 1 skip"; blank when nobody has voted. */
export function voteSummary(votes = {}) {
  const counts = voteCounts(votes);
  const parts = [];
  if (counts.must) parts.push(`${counts.must} must`);
  if (counts.nice) parts.push(`${counts.nice} nice`);
  if (counts.skip) parts.push(`${counts.skip} skip`);
  return parts.join(" · ");
}

export function notRankedByMe(items, uid) {
  return items.filter((item) => !(item.votes && uid in item.votes));
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Score desc, then more Must votes, then newest createdAt (§7.3 default sort). */
export function sortByRank(items) {
  return [...items].sort((a, b) => {
    const scoreDiff = voteScore(b.votes) - voteScore(a.votes);
    if (scoreDiff !== 0) return scoreDiff;
    const mustDiff = voteCounts(b.votes).must - voteCounts(a.votes).must;
    if (mustDiff !== 0) return mustDiff;
    return toMillis(b.createdAt) - toMillis(a.createdAt);
  });
}
