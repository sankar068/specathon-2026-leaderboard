import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { verifyAdminPassword } from "./adminAuth";

describe("admin credential configuration", () => {
  it("accepts the supplied server-configured credential and rejects a wrong password", () => {
    const password = process.env.SPECATHON_TEST_PASSWORD;
    expect(password).toBeTruthy();
    expect(ENV.adminEmail).toBe("specathon2026@gradientclub.in");
    expect(verifyAdminPassword(ENV.adminEmail, password as string)).toBe(true);
    expect(verifyAdminPassword(ENV.adminEmail, `${password}-wrong`)).toBe(false);
  });
});
