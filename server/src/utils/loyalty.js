const LOYALTY_RANKS = [
  { key: "kim_cuong", minPoints: 15000, label: "Kim cuong" },
  { key: "vang", minPoints: 5000, label: "Vang" },
  { key: "bac", minPoints: 1000, label: "Bac" },
  { key: "dong", minPoints: 0, label: "Dong" },
];

function normalizePoints(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function getLoyaltyRank(points) {
  const normalizedPoints = normalizePoints(points);
  return LOYALTY_RANKS.find((item) => normalizedPoints >= item.minPoints) || LOYALTY_RANKS[LOYALTY_RANKS.length - 1];
}

function buildLoyaltySnapshot(points) {
  const normalizedPoints = normalizePoints(points);
  const rank = getLoyaltyRank(normalizedPoints);
  return {
    loyalty_points: normalizedPoints,
    loyalty_rank: rank.key,
    loyalty_rank_label: rank.label,
  };
}

module.exports = {
  LOYALTY_RANKS,
  normalizePoints,
  getLoyaltyRank,
  buildLoyaltySnapshot,
};
