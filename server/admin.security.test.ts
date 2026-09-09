import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(role: "admin" | "user"): TrpcContext {
  const now = new Date();
  return {
    user: { id: 7, openId: `security-${role}`, email: `${role}@example.com`, name: role, loginMethod: "test", role, createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("admin security boundaries", () => {
  it("rejects authenticated non-admin users before admin procedures execute", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.admin.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects invalid venue codes at the server boundary", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.admin.importTeams({ rows: [{ teamId: "SPC001", teamName: "Alpha", venue: "Main Hall" }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects duplicate team ids case-insensitively before touching storage", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.admin.importTeams({ rows: [{ teamId: "spc001", teamName: "Alpha", venue: "G1" }, { teamId: "SPC001", teamName: "Nova", venue: "G2" }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
