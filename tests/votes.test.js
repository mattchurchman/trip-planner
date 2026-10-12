import assert from "node:assert/strict";
import { voteScore, voteSummary, notRankedByMe, sortByRank } from "../js/lib/votes.js";

export const tests = [
  ["voteScore sums love (+2), like (+1) and pass (-1)", () => {
    assert.equal(voteScore({ a: "love", b: "like", c: "pass" }), 2);
  }],
  ["voteScore is 0 with no votes", () => {
    assert.equal(voteScore({}), 0);
    assert.equal(voteScore(undefined), 0);
  }],
  ["voteScore reads old must/nice/skip as love/like/pass", () => {
    assert.equal(voteScore({ a: "must", b: "nice", c: "skip" }), 2);
  }],
  ["voteSummary lists non-zero counts in love/like/pass order", () => {
    assert.equal(voteSummary({ a: "love", b: "love", c: "like", d: "pass" }), "2 love · 1 like · 1 pass");
  }],
  ["voteSummary reads old terminology", () => {
    assert.equal(voteSummary({ a: "must", b: "must", c: "nice", d: "skip" }), "2 love · 1 like · 1 pass");
  }],
  ["voteSummary is blank with no votes", () => {
    assert.equal(voteSummary({}), "");
  }],
  ["notRankedByMe keeps items with no vote from the given uid", () => {
    const items = [
      { id: "1", votes: { me: "love" } },
      { id: "2", votes: { other: "like" } },
      { id: "3", votes: {} },
    ];
    assert.deepEqual(notRankedByMe(items, "me").map((i) => i.id), ["2", "3"]);
  }],
  ["sortByRank sorts by most Loves, then most Likes, then newest createdAt", () => {
    const items = [
      // 1 love, 0 likes, older
      { id: "one-love-older", votes: { u1: "love" }, createdAt: "2026-01-01T00:00:00.000Z" },
      // 0 loves, 1 like
      { id: "one-like", votes: { u1: "like" }, createdAt: "2026-01-01T00:00:00.000Z" },
      // 0 loves, 0 likes, has passes
      { id: "pass-only", votes: { u1: "pass" }, createdAt: "2026-01-01T00:00:00.000Z" },
      // 1 love, 0 likes, newer
      { id: "one-love-newer", votes: { u1: "love" }, createdAt: "2026-01-05T00:00:00.000Z" },
      // 2 loves
      { id: "two-loves", votes: { u1: "love", u2: "love" }, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    const order = sortByRank(items).map((i) => i.id);
    assert.deepEqual(order, [
      "two-loves",
      "one-love-newer",
      "one-love-older",
      "one-like",
      "pass-only",
    ]);
  }],
];
