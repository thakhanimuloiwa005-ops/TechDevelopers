import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { uniqueEmail, cleanupUser } from "./testUtils.js";

const app = createApp();

describe("wearable-triggered incidents", () => {
  const email = uniqueEmail("wearer");
  let token: string;

  beforeAll(async () => {
    const res = await request(app).post("/auth/register").send({ email, password: "Password123!", fullName: "Wearer" });
    token = res.body.accessToken;
  });

  afterAll(() => cleanupUser(email));

  it("exposes a SIMULATED wearable device for every new account", async () => {
    const res = await request(app).get("/wearables/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.device.simulated).toBe(true);
  });

  it("opens an incident when a fall is simulated", async () => {
    const res = await request(app).post("/demo/fall").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const incidents = await request(app).get("/incidents").set("Authorization", `Bearer ${token}`);
    expect(incidents.body.length).toBe(1);
    expect(incidents.body[0].activationMethod).toBe("FALL_DETECTION");
  });

  it("does not open a second incident for a high-heart-rate event while one is active", async () => {
    await request(app).post("/demo/heart-rate").set("Authorization", `Bearer ${token}`);
    const incidents = await request(app).get("/incidents").set("Authorization", `Bearer ${token}`);
    expect(incidents.body.length).toBe(1);
  });

  it("resets the demo scenario", async () => {
    const res = await request(app).post("/demo/reset").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
    const incidents = await request(app).get("/incidents").set("Authorization", `Bearer ${token}`);
    expect(incidents.body.length).toBe(0);
  });
});
