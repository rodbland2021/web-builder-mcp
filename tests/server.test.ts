import { describe, it, expect } from "vitest";
import { createServer } from "../src/server.js";

describe("createServer", () => {
  it("returns a defined server object", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });
});
