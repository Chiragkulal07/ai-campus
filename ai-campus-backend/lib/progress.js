// Player progression derived from real match history (single source of truth).
// Computing it on read means it can never drift out of sync with gameHistory,
// and existing accounts get credit for matches they already played.

const XP_PER_MATCH = 50;
const XP_PER_KILL = 10;
const XP_RANK_BONUS = { 1: 100, 2: 50, 3: 25 };
const XP_PER_LEVEL = 250;

function computeProgress(gameHistory = []) {
  let xp = 0;
  let totalKills = 0;
  let wins = 0;
  let podiums = 0;
  let bestKills = 0;

  for (const g of gameHistory) {
    const kills = Number(g.kills) || 0;
    const rank = Number(g.finalRank) || 0;
    totalKills += kills;
    if (kills > bestKills) bestKills = kills;
    if (rank === 1) wins += 1;
    if (rank >= 1 && rank <= 3) podiums += 1;
    xp += XP_PER_MATCH + kills * XP_PER_KILL + (XP_RANK_BONUS[rank] || 0);
  }

  const totalMatches = gameHistory.length;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;

  return {
    level,
    xp,
    xpIntoLevel,
    xpPerLevel: XP_PER_LEVEL,
    totalMatches,
    totalKills,
    wins,
    podiums,
    bestKills,
    winRate: totalMatches ? Math.round((wins / totalMatches) * 100) : 0,
    avgKills: totalMatches ? Number((totalKills / totalMatches).toFixed(1)) : 0,
  };
}

module.exports = { computeProgress, XP_PER_MATCH, XP_PER_KILL, XP_RANK_BONUS, XP_PER_LEVEL };
