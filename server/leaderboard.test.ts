import { describe, expect, it } from "vitest";
import { rankLeaderboardRows } from "./ranking";

const rows = [
  { id: 1, teamId: "SPC001", teamName: "Team Nova", venue: "G1", round1Score: 36, round2Score: 34 },
  { id: 2, teamId: "SPC002", teamName: "Team Alpha", venue: "G2", round1Score: 35, round2Score: 35 },
  { id: 3, teamId: "SPC003", teamName: "Team Orbit", venue: "G20", round1Score: 35, round2Score: null },
  { id: 4, teamId: "SPC004", teamName: "Team Beta", venue: "G21", round1Score: 35, round2Score: 35 },
];

describe("rankLeaderboardRows", () => {
  it("uses only Round 1 scores while Round 1 is active", () => {
    const ranked = rankLeaderboardRows(rows, "ROUND_1_LIVE");
    expect(ranked.map(row => row.teamId)).toEqual(["SPC001", "SPC002", "SPC004", "SPC003"]);
    expect(ranked[0]?.total).toBe(70);
    expect(ranked[0]?.rankingTotal).toBe(36);
  });

  it("uses combined totals during Round 2 and preserves deterministic tie order", () => {
    const ranked = rankLeaderboardRows(rows, "ROUND_2_LIVE");
    expect(ranked.map(row => row.teamId)).toEqual(["SPC002", "SPC004", "SPC001", "SPC003"]);
    expect(ranked[0]?.total).toBe(70);
    expect(ranked[1]?.total).toBe(70);
    expect(ranked[1]?.rank).toBe(2);
  });

  it("shows missing scores as zero for calculation but keeps the original null value", () => {
    const ranked = rankLeaderboardRows(rows, "ROUND_2_LIVE");
    const orbit = ranked.find(row => row.teamId === "SPC003");
    expect(orbit?.round2Score).toBeNull();
    expect(orbit?.total).toBe(35);
  });
});
