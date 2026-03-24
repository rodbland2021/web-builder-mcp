import { describe, it, expect } from "vitest";
import { createServer } from "../src/server.js";

describe("createServer", () => {
  it("returns a defined server object", async () => {
    const server = await createServer();
    expect(server).toBeDefined();
  });
});
