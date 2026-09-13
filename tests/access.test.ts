import { describe, expect, test } from "bun:test";
import { allows, canCreate, type Access } from "../convex/auth/permissions";

const event = { eventId: "dinner", seriesId: "dinners" };
const editor: Access = {
    isAdmin: false,
    grants: [{ role: "editor", scope: { kind: "event", id: "dinner" } }],
};
const organiser: Access = {
    isAdmin: false,
    grants: [{ role: "organiser", scope: { kind: "series", id: "dinners" } }],
};

describe("scoped access", () => {
    test("no implicit authority from identity or public membership", () => {
        expect(allows({ isAdmin: false, grants: [] }, event)).toBe(false);
    });
    test("event editors cannot publish, create or access another event", () => {
        expect(allows(editor, event)).toBe(true);
        expect(allows(editor, event, "organiser")).toBe(false);
        expect(allows(editor, { eventId: "other", seriesId: "dinners" })).toBe(false);
        expect(canCreate(editor, "dinners")).toBe(false);
    });
    test("series organisers inherit events but cannot escape their series", () => {
        expect(allows(organiser, event, "organiser")).toBe(true);
        expect(canCreate(organiser, "dinners")).toBe(true);
        expect(canCreate(organiser)).toBe(false);
        expect(canCreate(organiser, "talks")).toBe(false);
        expect(allows(organiser, { eventId: "other", seriesId: "talks" })).toBe(false);
    });
    test("strongest matching grant wins without broadening unrelated grants", () => {
        const access: Access = { isAdmin: false, grants: [...editor.grants, ...organiser.grants] };
        expect(allows(access, event, "organiser")).toBe(true);
        expect(allows(access, { eventId: "other", seriesId: "talks" }, "organiser")).toBe(false);
    });
    test("administrators can manage standalone and scoped records", () => {
        const admin = { isAdmin: true, grants: [] };
        expect(allows(admin, event, "organiser")).toBe(true);
        expect(canCreate(admin)).toBe(true);
    });
});
