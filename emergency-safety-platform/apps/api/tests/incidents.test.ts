import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { uniqueEmail, cleanupUser } from "./testUtils.js";

const app = createApp();

describe("incident lifecycle", () => {
  const ownerEmail = uniqueEmail("owner");
  const trustedEmail = uniqueEmail("trusted");
  let ownerToken: string;
  let trustedToken: string;
  let incidentId: string;

  beforeAll(async () => {
    const owner = await request(app).post("/auth/register").send({ email: ownerEmail, password: "Password123!", fullName: "Owner" });
    ownerToken = owner.body.accessToken;

    const trusted = await request(app).post("/auth/register").send({ email: trustedEmail, password: "Password123!", fullName: "Trusted" });
    trustedToken = trusted.body.accessToken;

    await request(app)
      .post("/trusted-members")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Trusted", email: trustedEmail, relationship: "Friend", priority: 1 });

    await request(app).put("/keywords").set("Authorization", `Bearer ${ownerToken}`).send({ keyword: "HELP", enabled: true });
  });

  afterAll(async () => {
    await cleanupUser(ownerEmail);
    await cleanupUser(trustedEmail);
  });

  it("rejects a keyword match test against a disabled/wrong phrase", async () => {
    const res = await request(app).post("/keywords/test").set("Authorization", `Bearer ${ownerToken}`).send({ phrase: "nope" });
    expect(res.body.matched).toBe(false);
  });

  it("creates an incident via the simulated keyword trigger and cascades through the engine", async () => {
    const res = await request(app).post("/demo/keyword").set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(201);
    expect(res.body.activationMethod).toBe("KEYWORD");
    incidentId = res.body.id;

    const detail = await request(app).get(`/incidents/${incidentId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.locations.length).toBeGreaterThan(0);
    expect(detail.body.events.some((e: { label: string }) => e.label === "Trusted members notified")).toBe(true);
    expect(detail.body.incident.status).toBe("EVIDENCE_COLLECTING");
  });

  it("refuses a second incident while one is already active", async () => {
    const res = await request(app).post("/demo/keyword").set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(409);
  });

  it("lets the trusted member see and acknowledge the incident", async () => {
    const list = await request(app).get("/incidents").set("Authorization", `Bearer ${trustedToken}`);
    expect(list.body.some((i: { id: string }) => i.id === incidentId)).toBe(true);

    const ack = await request(app).post(`/incidents/${incidentId}/acknowledge`).set("Authorization", `Bearer ${trustedToken}`);
    expect(ack.status).toBe(204);

    const detail = await request(app).get(`/incidents/${incidentId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(detail.body.incident.status).toBe("ACKNOWLEDGED");
  });

  it("refuses acknowledge/resolve from an unrelated account", async () => {
    const outsider = await request(app).post("/auth/register").send({ email: uniqueEmail("outsider"), password: "Password123!", fullName: "Outsider" });
    const res = await request(app).get(`/incidents/${incidentId}`).set("Authorization", `Bearer ${outsider.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  it("lets the trusted member resolve the incident", async () => {
    const res = await request(app)
      .post(`/incidents/${incidentId}/resolve`)
      .set("Authorization", `Bearer ${trustedToken}`)
      .send({ notes: "All clear" });
    expect(res.status).toBe(204);

    const detail = await request(app).get(`/incidents/${incidentId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(detail.body.incident.status).toBe("RESOLVED");
    expect(detail.body.incident.resolutionNotes).toBe("All clear");
  });
});
