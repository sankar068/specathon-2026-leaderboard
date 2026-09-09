import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getAuditLog, getDb, getEventSettings, getLeaderboardRows, getTeams, getUserByOpenId, getVenueGroups, importTeams, updateScore, updateTeam } from "./db";
import { eventSettings, venueGroupMembers, venueGroups } from "../drizzle/schema";
import { rankLeaderboardRows } from "./ranking";

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access required" });
  return next();
});

const teamRowSchema = z.object({
  teamId: z.string().trim().min(1).max(32),
  teamName: z.string().trim().min(1).max(160),
  venue: z.string().trim().min(1).max(32),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  leaderboard: router({
    data: publicProcedure.query(async () => {
      const [settings, rows, groups] = await Promise.all([getEventSettings(), getLeaderboardRows(), getVenueGroups()]);
      const ranked = rankLeaderboardRows(rows, settings.currentStage);
      return { settings, groups, teams: ranked };
    }),
  }),

  admin: router({
    summary: adminProcedure.query(async () => {
      const [settings, rows, audit] = await Promise.all([getEventSettings(), getTeams(), getAuditLog(8)]);
      return {
        settings,
        totalTeams: rows.length,
        round1Evaluated: rows.filter(row => row.round1Score !== null && row.round1Score !== undefined).length,
        round2Evaluated: rows.filter(row => row.round2Score !== null && row.round2Score !== undefined).length,
        recentAudit: audit,
      };
    }),
    teams: adminProcedure.input(z.object({ search: z.string().optional(), venue: z.string().optional() }).optional()).query(({ input }) => getTeams(input)),
    venueGroups: adminProcedure.query(() => getVenueGroups()),
    auditLog: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional()).query(({ input }) => getAuditLog(input?.limit ?? 50)),
    updateTeam: adminProcedure.input(z.object({ id: z.number().int().positive(), teamName: z.string().trim().min(1).max(160), venue: z.string().trim().min(1).max(32) })).mutation(async ({ input }) => {
      await updateTeam(input.id, { teamName: input.teamName, venue: input.venue });
      return { success: true } as const;
    }),
    updateScore: adminProcedure.input(z.object({ teamId: z.number().int().positive(), round: z.enum(["ROUND_1", "ROUND_2"]), score: z.number().int().min(0) })).mutation(async ({ ctx, input }) => {
      const settings = await getEventSettings();
      const maximum = input.round === "ROUND_1" ? settings.round1MaxScore : settings.round2MaxScore;
      if (input.score > maximum) throw new TRPCError({ code: "BAD_REQUEST", message: `${input.round === "ROUND_1" ? "Round 1" : "Round 2"} score must be between 0 and ${maximum}` });
      const result = await updateScore(input.teamId, input.round, input.score, ctx.user.id);
      return { success: true, ...result, maximum } as const;
    }),
    importTeams: adminProcedure.input(z.object({ rows: z.array(teamRowSchema).min(1).max(1000) })).mutation(async ({ input }) => {
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const row of input.rows) {
        const key = row.teamId.toUpperCase();
        if (seen.has(key)) duplicates.push(row.teamId);
        seen.add(key);
      }
      if (duplicates.length) throw new TRPCError({ code: "BAD_REQUEST", message: `Duplicate Team ID(s): ${duplicates.join(", ")}` });
      const count = await importTeams(input.rows.map(row => ({ ...row, teamId: row.teamId.toUpperCase() })));
      return { success: true, count } as const;
    }),
    updateSettings: adminProcedure.input(z.object({ currentStage: z.enum(["ROUND_1_UPCOMING", "ROUND_1_LIVE", "ROUND_1_COMPLETED", "ROUND_2_UPCOMING", "ROUND_2_LIVE", "ROUND_2_COMPLETED", "FINAL_UPCOMING", "FINAL_LIVE", "FINAL_COMPLETED", "RESULTS_LIVE"]), round1MaxScore: z.number().int().min(1).max(1000), round2MaxScore: z.number().int().min(1).max(1000) })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.insert(eventSettings).values({ id: 1, ...input }).onDuplicateKeyUpdate({ set: input });
      return { success: true } as const;
    }),
    seedVenueGroups: adminProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const groups = await getVenueGroups();
      if (groups.length) return { success: true, created: 0 } as const;
      const defaults = [{ groupName: "G1 + G2", venues: ["G1", "G2"] }, { groupName: "G20 + G21", venues: ["G20", "G21"] }];
      let created = 0;
      for (const group of defaults) {
        const result = await db.insert(venueGroups).values({ groupName: group.groupName });
        const groupId = Number(result[0].insertId);
        await db.insert(venueGroupMembers).values(group.venues.map(venueName => ({ groupId, venueName })));
        created++;
      }
      return { success: true, created } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
