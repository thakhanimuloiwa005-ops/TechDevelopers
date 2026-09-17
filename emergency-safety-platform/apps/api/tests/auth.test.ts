import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { uniqueEmail, cleanupUser } from "./testUtils.js";

const app = createApp();

describe("auth", () => {
  const email = uniqueEmail("auth");

  afterAll(() => cleanupUser(email));

  it("registers a new user and returns tokens", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email, password: "Password123!", fullName: "Test User" });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe(email);
  });

  it("rejects duplicate registration", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email, password: "Password123!", fullName: "Test User" });
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app).post("/auth/login").send({ email, password: "Password123!" });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it("rejects an incorrect password", async () => {
    const res = await request(app).post("/auth/login").send({ email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("rejects protected routes without a token", async () => {
    const res = await request(app).get("/users/me");
    expect(res.status).toBe(401);
  });
});
