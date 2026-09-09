import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { eventSettings, InsertUser, scoreAuditLog, scores, teams, users, venueGroupMembers, venueGroups } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
export async function getDb() { if (!_db && process.env.DATABASE_URL) { try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); } } return _db; }

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb(); if (!db) return;
  const values: InsertUser = { openId: user.openId }; const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  values.lastSignedIn = user.lastSignedIn ?? new Date(); updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) { values.role = user.role ?? "admin"; updateSet.role = values.role; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0]; }

export async function getEventSettings() {
  const db = await getDb();
  if (!db) return { id: 1, currentStage: "ROUND_1_UPCOMING" as const, round1MaxScore: 40, round2MaxScore: 40, updatedAt: new Date() };
  const existing = (await db.select().from(eventSettings).where(eq(eventSettings.id, 1)).limit(1))[0];
  if (existing) return existing;
  await db.insert(eventSettings).values({ id: 1, currentStage: "ROUND_1_UPCOMING", round1MaxScore: 40, round2MaxScore: 40 });
  return (await db.select().from(eventSettings).where(eq(eventSettings.id, 1)).limit(1))[0];
}

export async function getLeaderboardRows() { const db = await getDb(); if (!db) return []; return db.select({ id: teams.id, teamId: teams.teamId, teamName: teams.teamName, venue: teams.venue, round1Score: scores.round1Score, round2Score: scores.round2Score }).from(teams).leftJoin(scores, eq(scores.teamId, teams.id)); }
export async function getTeams(filters?: { search?: string; venue?: string }) {
  const db = await getDb(); if (!db) return []; const clauses = [];
  if (filters?.search) clauses.push(sql`(${teams.teamId} like ${`%${filters.search}%`} or ${teams.teamName} like ${`%${filters.search}%`})`);
  if (filters?.venue && filters.venue !== "ALL") clauses.push(eq(teams.venue, filters.venue));
  return db.select({ id: teams.id, teamId: teams.teamId, teamName: teams.teamName, venue: teams.venue, round1Score: scores.round1Score, round2Score: scores.round2Score }).from(teams).leftJoin(scores, eq(scores.teamId, teams.id)).where(clauses.length ? and(...clauses) : undefined).orderBy(asc(teams.teamName));
}
export async function getVenueGroups() {
  const db = await getDb(); if (!db) return [];
  const groups = await db.select().from(venueGroups).orderBy(asc(venueGroups.groupName));
  const members = groups.length ? await db.select().from(venueGroupMembers).where(inArray(venueGroupMembers.groupId, groups.map(g => g.id))) : [];
  return groups.map(group => ({ ...group, venues: members.filter(member => member.groupId === group.id).map(member => member.venueName) }));
}
export async function updateTeam(teamId: number, data: { teamName?: string; venue?: string }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(teams).set({ ...data, updatedAt: new Date() }).where(eq(teams.id, teamId)); }

export async function updateScore(teamId: number, round: "ROUND_1" | "ROUND_2", newScore: number, changedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => { const previous = (await tx.select().from(scores).where(eq(scores.teamId, teamId)).limit(1))[0]; const oldScore = round === "ROUND_1" ? previous?.round1Score ?? null : previous?.round2Score ?? null; const field = round === "ROUND_1" ? "round1Score" : "round2Score";
    if (previous) await tx.update(scores).set({ [field]: newScore, updatedAt: new Date() }).where(eq(scores.teamId, teamId)); else await tx.insert(scores).values({ teamId, [field]: newScore });
    await tx.insert(scoreAuditLog).values({ teamId, round, oldScore, newScore, changedBy }); return { oldScore, newScore }; });
}
export async function clearScore(teamId: number, round: "ROUND_1" | "ROUND_2", changedBy: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => { const previous = (await tx.select().from(scores).where(eq(scores.teamId, teamId)).limit(1))[0]; const oldScore = round === "ROUND_1" ? previous?.round1Score ?? null : previous?.round2Score ?? null; if (!previous || oldScore === null) return { oldScore, newScore: null };
    const field = round === "ROUND_1" ? "round1Score" : "round2Score"; await tx.update(scores).set({ [field]: null, updatedAt: new Date() }).where(eq(scores.teamId, teamId)); await tx.insert(scoreAuditLog).values({ teamId, round, oldScore, newScore: null, changedBy }); return { oldScore, newScore: null }; });
}
export async function importTeams(rows: Array<{ teamId: string; teamName: string; venue: string }>) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); return db.transaction(async tx => { for (const row of rows) await tx.insert(teams).values(row).onDuplicateKeyUpdate({ set: { teamName: row.teamName, venue: row.venue, updatedAt: new Date() } }); return rows.length; }); }
export async function getAuditLog(limit = 50) { const db = await getDb(); if (!db) return []; return db.select({ id: scoreAuditLog.id, teamId: teams.teamId, teamName: teams.teamName, round: scoreAuditLog.round, oldScore: scoreAuditLog.oldScore, newScore: scoreAuditLog.newScore, changedAt: scoreAuditLog.changedAt, changedBy: users.name }).from(scoreAuditLog).innerJoin(teams, eq(teams.id, scoreAuditLog.teamId)).innerJoin(users, eq(users.id, scoreAuditLog.changedBy)).orderBy(desc(scoreAuditLog.changedAt)).limit(limit); }

export async function saveVenueGroup(groupId: number | undefined, groupName: string, venues: string[]) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => { let id = groupId; if (id) await tx.update(venueGroups).set({ groupName, updatedAt: new Date() }).where(eq(venueGroups.id, id)); else { const result = await tx.insert(venueGroups).values({ groupName }); id = Number(result[0].insertId); } await tx.delete(venueGroupMembers).where(eq(venueGroupMembers.groupId, id)); if (venues.length) await tx.insert(venueGroupMembers).values(venues.map(venueName => ({ groupId: id as number, venueName }))); return id; });
}
export async function deleteVenueGroup(groupId: number) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(venueGroups).where(eq(venueGroups.id, groupId)); }
