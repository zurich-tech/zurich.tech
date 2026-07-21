import { describe, expect, test } from "bun:test";

import { normalizeEmail } from "../convex/email";

describe("normalizeEmail", () => {
    test("test_normalize_valid_address", () => {
        expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
    });

    test("test_reject_invalid_address", () => {
        expect(() => normalizeEmail("not-an-address")).toThrow("Enter a valid email address.");
    });
});
