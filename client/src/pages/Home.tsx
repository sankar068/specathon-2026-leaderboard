import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Activity, ArrowUpRight, BarChart3, ChevronDown, CircleDot, Radio, ShieldCheck, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

const stageCopy: Record<string, { label: string; tone: string; helper: string }> = {
  ROUND_1_UPCOMING: { label: "Round 1 upcoming", tone: "muted", helper: "Evaluation has not started" },
  ROUND_1_LIVE: { label: "Round 1 live", tone: "live", helper: "Scores are being recorded now" },
  ROUND_1_COMPLETED: { label: "Round 1 completed", tone: "complete", helper: "Round 2 is next" },
  ROUND_2_UPCOMING: { label: "Round 2 upcoming", tone: "muted", helper: "Round 1 results are locked" },
  ROUND_2_LIVE: { label: "Round 2 live", tone: "live", helper: "The leaderboard is moving in real time" },
  ROUND_2_COMPLETED: { label: "Round 2 completed", tone: "complete", helper: "Final evaluation is next" },
  FINAL_UPCOMING: { label: "Final upcoming", tone: "muted", helper: "Shortlist preparation in progress" },
  FINAL_LIVE: { label: "Final live", tone: "live", helper: "Final evaluation is underway" },
  FINAL_COMPLETED: { label: "Final completed", tone: "complete", helper: "Results are being prepared" },
  RESULTS_LIVE: { label: "Results live", tone: "complete", helper: "Official results are now visible" },
};

export default function Home() {
  const [venue, setVenue] = useState("ALL");
  const { data, isLoading, isError, dataUpdatedAt } = trpc.leaderboard.data.useQuery(undefined, { refetchInterval: 5000, staleTime: 2500 });
  const stage = stageCopy[data?.settings.currentStage ?? "ROUND_1_UPCOMING"];
  const activeGroup = data?.groups.find(group => String(group.id) === venue);
  const displayedTeams = useMemo(() => {
    if (!data?.teams) return [];
    if (!activeGroup) return data.teams;
    return data.teams.filter(team => activeGroup.venues.includes(team.venue));
  }, [activeGroup, data?.teams]);
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

  return (
    <main className="min-h-screen bg-[#080b12] text-slate-100 selection:bg-cyan-300 selection:text-slate-950">
      <div className="event-grid min-h-screen">
        <header className="mx-auto flex max-w-[1480px] items-center justify-between px-5 py-6 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="brand-mark"><span>G</span></div>
            <div>
              <p className="eyebrow text-cyan-300">GRADIENT CLUB · SPC HYDERABAD</p>
              <p className="font-display text-sm font-semibold tracking-[0.16em] text-white">SPECATHON 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="hidden sm:inline">Public view</span>
            <Link href="/admin" className="control-link">Admin console <ArrowUpRight size={14} /></Link>
          </div>
        </header>

        <section className="mx-auto max-w-[1480px] px-5 pb-8 lg:px-10 lg:pb-12">
          <div className="hero-rule mb-10" />
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <div className="mb-5 flex items-center gap-2 text-cyan-300"><Radio size={15} className="live-pulse" /><span className="eyebrow">LIVE EVALUATION & LEADERBOARD</span></div>
              <h1 className="font-display max-w-3xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-white sm:text-7xl">Who is winning<br /><span className="text-gradient">right now?</span></h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">The official live ranking for the 36-hour national hackathon. Scores are updated automatically as evaluation progresses across every venue.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:justify-self-end">
              <Stat label="Teams" value={String(data?.teams.length ?? "—")} icon={<Trophy size={16} />} />
              <Stat label="Stage" value={stage?.label.split(" ").slice(0, 2).join(" ") ?? "Loading"} icon={<Activity size={16} />} />
              <Stat label="Last sync" value={lastUpdated} icon={<CircleDot size={16} />} />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1480px] px-5 pb-14 lg:px-10">
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-3"><span className={`status-dot ${stage?.tone ?? "muted"}`} /><span className="eyebrow text-slate-300">{stage?.label ?? "Loading event stage"}</span></div>
              <p className="text-sm text-slate-500">{stage?.helper ?? "Connecting to the evaluation database"}</p>
            </div>
            <label className="filter-control">
              <span className="eyebrow text-slate-500">Venue view</span>
              <select value={venue} onChange={event => setVenue(event.target.value)} aria-label="Filter by venue group">
                <option value="ALL">All venues</option>
                {data?.groups.map(group => <option key={group.id} value={group.id}>{group.groupName}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
          </div>

          <div className="leaderboard-shell">
            <div className="table-scroll">
              <table className="leaderboard-table">
                <thead><tr><th className="rank-col">Rank</th><th>Team</th><th>Venue</th><th className="score-col">Round 1</th><th className="score-col">Round 2</th><th className="score-col total-col">Total</th></tr></thead>
                <tbody>
                  {isLoading && <tr><td colSpan={6} className="empty-row">Loading live standings…</td></tr>}
                  {isError && <tr><td colSpan={6} className="empty-row text-rose-300">Unable to connect to the leaderboard database. Retry shortly.</td></tr>}
                  {!isLoading && !isError && displayedTeams.length === 0 && <tr><td colSpan={6} className="empty-row"><div className="mx-auto max-w-md"><BarChart3 className="mx-auto mb-3 text-cyan-300" size={26} /><p className="font-display text-lg text-white">No teams imported yet</p><p className="mt-1 text-sm text-slate-500">The public ranking will appear here once the administrator completes the official Excel import.</p></div></td></tr>}
                  {displayedTeams.map(team => <tr key={team.id} className="leaderboard-row"><td className="rank-cell">{team.rank < 4 ? <span className={`rank-medal rank-${team.rank}`}>{team.rank}</span> : <span>{team.rank}</span>}</td><td><div className="team-name">{team.teamName}</div><div className="team-id">{team.teamId}</div></td><td><span className="venue-tag">{team.venue}</span></td><td className="score-cell">{team.round1Score ?? "—"}</td><td className="score-cell">{team.round2Score ?? "—"}</td><td className="score-cell total-score">{team.total || team.round1Score === 0 || team.round2Score === 0 ? team.total : "—"}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span>Global rank numbers are preserved when a venue group is selected.</span><span className="flex items-center gap-2"><span className="status-dot live" />Syncing automatically</span></div>
          </div>
        </section>

        <footer className="mx-auto flex max-w-[1480px] flex-col gap-3 border-t border-white/10 px-5 py-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between lg:px-10"><span>SPECATHON 2026 · Official evaluation display</span><span>Built for accuracy, transparency, and live event operations.</span></footer>
      </div>
    </main>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="stat-block"><div className="mb-4 flex items-center gap-2 text-cyan-300">{icon}<span className="eyebrow">{label}</span></div><p className="font-display truncate text-lg font-semibold text-white">{value}</p></div>;
}
