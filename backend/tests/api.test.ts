import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("API", () => {
  const app = createApp();

  it("returns health status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("returns analysis for stock", async () => {
    const res = await request(app).get("/api/analyze").query({
      symbol: "AAPL",
      assetClass: "stock",
      timeframe: "1h",
    });

    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe("AAPL");
    expect(["BUY", "WAIT", "AVOID"]).toContain(res.body.decision.action);
    expect(Array.isArray(res.body.decision.reasonsTop3)).toBe(true);
  });
});
