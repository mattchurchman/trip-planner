import assert from "node:assert/strict";
import { voteScore, voteSummary, notRankedByMe, sortByRank } from "../js/lib/votes.js";

export const tests = [
  ["voteScore sums must (+2), nice (+1) and skip (-1)", () => {
    assert.equal(voteScore({ a: "must", b: "nice", c: "skip" }), 2);
  }],
  ["voteScore is 0 with no votes", () => {
    assert.equal(voteScore({}), 0);
    assert.equal(voteScore(undefined), 0);
  }],
  ["voteSummary lists non-zero counts in must/nice/skip order", () => {
    assert.equal(voteSummary({ a: "must", b: "must", c: "nice", d: "skip" }), "2 must · 1 nice · 1 skip");
  }],
  ["voteSummary is blank with no votes", () => {
    assert.equal(voteSummary({}), "");
  }],
  ["notRankedByMe keeps items with no vote from the given uid", () => {
    const items = [
      { id: "1", votes: { me: "must" } },
      { id: "2", votes: { other: "nice" } },
      { id: "3", votes: {} },
    ];
    assert.deepEqual(notRankedByMe(items, "me").map((i) => i.id), ["2", "3"]);
  }],
  ["sortByRank breaks a score tie by Must count, then by newest createdAt", () => {
    const items = [
      // score 2, must 1, older -- ties same-score-newer on score+must, loses on createdAt
      { id: "same-score-older", votes: { u1: "must" }, createdAt: "2026-01-01T00:00:00.000Z" },
      // score -1 -- lowest, last
      { id: "lowest-score", votes: { u1: "skip" }, createdAt: "2026-01-01T00:00:00.000Z" },
      // score 3, must 1 -- ties top-score-more-must on score, loses on must count
      { id: "top-score-fewer-must", votes: { u1: "must", u2: "nice" }, createdAt: "2026-01-01T00:00:00.000Z" },
      // score 2, must 1, newer -- wins the tie above on createdAt
      { id: "same-score-newer", votes: { u1: "must" }, createdAt: "2026-01-05T00:00:00.000Z" },
      // score 3, must 2 -- highest score AND highest must count among the score-3 tier
      { id: "top-score-more-must", votes: { u1: "must", u2: "must", u3: "skip" }, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    const order = sortByRank(items).map((i) => i.id);
    assert.deepEqual(order, [
      "top-score-more-must",
      "top-score-fewer-must",
      "same-score-newer",
      "same-score-older",
      "lowest-score",
    ]);
  }],
];
