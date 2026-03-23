const LOYALTY_RANKS = [
  { key: "kim_cuong", minPoints: 1000, label: "Kim cương" },
  { key: "vang", minPoints: 500, label: "Vàng" },
  { key: "bac", minPoints: 200, label: "Bạc" },
  { key: "dong", minPoints: 0, label: "Đồng" },
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
