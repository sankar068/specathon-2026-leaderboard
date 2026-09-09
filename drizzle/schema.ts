import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, uniqueIndex, index, check } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  teamId: varchar("teamId", { length: 32 }).notNull(),
  teamName: varchar("teamName", { length: 160 }).notNull(),
  venue: varchar("venue", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  teamIdUnique: uniqueIndex("teams_team_id_unique").on(table.teamId),
  venueIndex: index("teams_venue_idx").on(table.venue),
}));

export const scores = mysqlTable("scores", {
  id: int("id").autoincrement().primaryKey(),
  teamId: int("teamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
  round1Score: int("round1Score"),
  round2Score: int("round2Score"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  teamUnique: uniqueIndex("scores_team_id_unique").on(table.teamId),
  round1NonNegative: check("scores_round1_non_negative", sql`${table.round1Score} is null or ${table.round1Score} >= 0`),
  round2NonNegative: check("scores_round2_non_negative", sql`${table.round2Score} is null or ${table.round2Score} >= 0`),
}));

export const eventSettings = mysqlTable("eventSettings", {
  id: int("id").primaryKey(),
  currentStage: mysqlEnum("currentStage", [
    "ROUND_1_UPCOMING", "ROUND_1_LIVE", "ROUND_1_COMPLETED",
    "ROUND_2_UPCOMING", "ROUND_2_LIVE", "ROUND_2_COMPLETED",
    "FINAL_UPCOMING", "FINAL_LIVE", "FINAL_COMPLETED", "RESULTS_LIVE",
  ]).default("ROUND_1_UPCOMING").notNull(),
  round1MaxScore: int("round1MaxScore").default(40).notNull(),
  round2MaxScore: int("round2MaxScore").default(40).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const venueGroups = mysqlTable("venueGroups", {
  id: int("id").autoincrement().primaryKey(),
  groupName: varchar("groupName", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  groupNameUnique: uniqueIndex("venue_groups_name_unique").on(table.groupName),
}));

export const venueGroupMembers = mysqlTable("venueGroupMembers", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull().references(() => venueGroups.id, { onDelete: "cascade" }),
  venueName: varchar("venueName", { length: 32 }).notNull(),
}, (table) => ({
  memberUnique: uniqueIndex("venue_group_members_unique").on(table.groupId, table.venueName),
}));

export const scoreAuditLog = mysqlTable("scoreAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  teamId: int("teamId").notNull().references(() => teams.id, { onDelete: "cascade" }),
  round: mysqlEnum("round", ["ROUND_1", "ROUND_2"]).notNull(),
  oldScore: int("oldScore"),
  newScore: int("newScore"),
  changedBy: int("changedBy").notNull().references(() => users.id),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
}, (table) => ({
  auditTeamIndex: index("score_audit_team_idx").on(table.teamId, table.changedAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type Score = typeof scores.$inferSelect;
export type EventSettings = typeof eventSettings.$inferSelect;
export type VenueGroup = typeof venueGroups.$inferSelect;
export type VenueGroupMember = typeof venueGroupMembers.$inferSelect;
export type ScoreAuditLog = typeof scoreAuditLog.$inferSelect;
