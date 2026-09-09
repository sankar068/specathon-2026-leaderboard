export type RankingInput = {
  id: number;
  teamId: string;
  teamName: string;
  venue: string;
  round1Score: number | null;
  round2Score: number | null;
};

export function rankLeaderboardRows(rows: RankingInput[], currentStage: string) {
  const isRoundOne = currentStage.startsWith("ROUND_1");
  return rows.map(row => {
    const total = (row.round1Score ?? 0) + (row.round2Score ?? 0);
    const rankingTotal = isRoundOne ? (row.round1Score ?? 0) : total;
    return { ...row, total, rankingTotal, round2Tie: row.round2Score ?? -1 };
  }).sort((a, b) => b.rankingTotal - a.rankingTotal || b.round2Tie - a.round2Tie || a.teamName.localeCompare(b.teamName, undefined, { sensitivity: "base" }))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
