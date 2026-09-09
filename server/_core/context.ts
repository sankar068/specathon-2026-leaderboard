import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getUserByOpenId } from "../db";
import { getAdminSessionOpenId } from "../adminAuth";
import { sdk } from "./sdk";

export type TrpcContext = { req: CreateExpressContextOptions["req"]; res: CreateExpressContextOptions["res"]; user: User | null };

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  try { user = await sdk.authenticateRequest(opts.req); } catch { user = null; }
  if (!user) {
    const openId = getAdminSessionOpenId(opts.req);
    if (openId) user = (await getUserByOpenId(openId)) ?? null;
  }
  return { req: opts.req, res: opts.res, user };
}
