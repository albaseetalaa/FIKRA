import { describe, expect, it } from "vitest";
import { assertCapabilitiesDeclared, assertCapabilityDeclared } from "../sdk/permissions";

describe("sdk permissions", () => {
  it("accepts declared capabilities", () => {
    expect(() => assertCapabilityDeclared(["file_read", "database_read"], "file_read")).not.toThrow();
    expect(() => assertCapabilitiesDeclared(["file_read", "database_read"], ["file_read"])).not.toThrow();
  });

  it("throws for undeclared capabilities", () => {
    expect(() => assertCapabilityDeclared(["file_read"], "database_write")).toThrow("Undeclared capabilities");
    expect(() => assertCapabilitiesDeclared(["file_read"], ["file_read", "database_write"]))
      .toThrow("Undeclared capabilities");
  });
});
