// Pure ranking helpers for candidates, places and stays. See SPEC.md §7.3.

const POINTS = { love: 2, like: 1, pass: -1 };

/** Convert old vote values (must/nice/skip) to new ones (love/like/pass) for backwards compatibility. */
export function normalizeVote(value) {
  const map = { must: "love", nice: "like", skip: "pass" };
  return map[value] || value;
}

export function voteScore(votes = {}) {
  return Object.values(votes || {}).reduce((sum, choice) => {
    const normalized = normalizeVote(choice);
    return sum + (POINTS[normalized] || 0);
  }, 0);
}

export function voteCounts(votes = {}) {
  const counts = { love: 0, like: 0, pass: 0 };
  for (const choice of Object.values(votes || {})) {
    const normalized = normalizeVote(choice);
    if (normalized in counts) counts[normalized] += 1;
  }
  return counts;
}

/** e.g. "2 love · 1 like · 1 pass"; blank when nobody has voted. */
export function voteSummary(votes = {}) {
  const counts = voteCounts(votes);
  const parts = [];
  if (counts.love) parts.push(`${counts.love} love`);
  if (counts.like) parts.push(`${counts.like} like`);
  if (counts.pass) parts.push(`${counts.pass} pass`);
  return parts.join(" · ");
}

export function notRankedByMe(items, uid) {
  return items.filter((item) => !(item.votes && uid in item.votes));
}

export function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Most Loves, then most Likes, then newest createdAt. */
export function sortByRank(items) {
  return [...items].sort((a, b) => {
    const countsA = voteCounts(a.votes);
    const countsB = voteCounts(b.votes);
    const loveDiff = countsB.love - countsA.love;
    if (loveDiff !== 0) return loveDiff;
    const likeDiff = countsB.like - countsA.like;
    if (likeDiff !== 0) return likeDiff;
    return toMillis(b.createdAt) - toMillis(a.createdAt);
  });
}
