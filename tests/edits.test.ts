import { expect, test } from "bun:test";
import { Edits } from "../src/components/edits";

// Successful saves may replace hidden values, IDs and defaults while refreshing the record.
test("save followed by a server refresh allows navigation", () => {
    const edits = new Edits();
    edits.reset("original");
    edits.interact(() => "original");
    expect(edits.isDirty("submitted")).toBe(true);
    edits.submit("submitted");
    edits.saved("submitted");
    expect(edits.isDirty("server-normalised")).toBe(false);
    edits.interact(() => "server-normalised");
    expect(edits.isDirty("server-normalised")).toBe(false);
    expect(edits.isDirty("another edit")).toBe(true);
});

// A cancelled confirmation or failed mutation must never acknowledge submitted changes.
test("cancelled or failed saves retain the warning and can be retried", () => {
    const edits = new Edits();
    edits.reset("original");
    edits.interact(() => "original");
    edits.submit("edited");
    expect(edits.isDirty("edited")).toBe(true);
    edits.submit("edited again");
    edits.saved("edited again");
    expect(edits.isDirty("refreshed")).toBe(false);
});

// A response acknowledges only the version sent, never further typing during the request.
test("edits made while saving remain protected", () => {
    const edits = new Edits();
    edits.reset("original");
    edits.interact(() => "original");
    edits.submit("submitted");
    edits.interact(() => "submitted");
    edits.saved("newer edit");
    expect(edits.isDirty("newer edit")).toBe(true);
    expect(edits.isDirty("submitted")).toBe(false);
    edits.submit("newer edit");
    edits.saved("newer edit");
    expect(edits.isDirty("refreshed")).toBe(false);
});

// Reverting to the submitted values should not leave a sticky warning.
test("reverted in-flight edits are clean after saving", () => {
    const edits = new Edits();
    edits.reset("original");
    edits.interact(() => "original");
    edits.submit("submitted");
    edits.interact(() => "submitted");
    expect(edits.isDirty("temporary edit")).toBe(true);
    edits.saved("submitted");
    expect(edits.isDirty("server-normalised")).toBe(false);
});

// Initial async values and explicitly selected records establish fresh baselines.
test("loading and switching records does not count as editing", () => {
    const edits = new Edits();
    edits.reset("loading");
    expect(edits.isDirty("loaded")).toBe(false);
    edits.interact(() => "loaded");
    expect(edits.isDirty("changed")).toBe(true);
    expect(edits.isDirty("loaded")).toBe(false);
    edits.reset("other record");
    expect(edits.isDirty("other record")).toBe(false);
    edits.interact(() => "other record");
    expect(edits.isDirty("other edit")).toBe(true);
});
