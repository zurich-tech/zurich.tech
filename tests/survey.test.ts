import { expect, test } from "bun:test";
import { SurveyWrites, type SurveyWrite } from "../src/members/saving";

test("test_serialize_and_coalesce_answers_during_slow_saves", async () => {
    const batches: SurveyWrite[][] = [];
    const first = Promise.withResolvers<void>();
    const writes = new SurveyWrites(async (answers) => {
        batches.push(answers);
        if (batches.length === 1) await first.promise;
    });
    writes.add({ question: "languages", values: ["en"] });
    const saving = writes.flush();
    writes.add({ question: "languages", values: ["de"] });
    writes.add({ question: "languages", values: ["fr"] });
    writes.add({ question: "languages" });
    writes.add({ question: "age" });
    expect(writes.flush()).toBe(saving);
    expect(writes.isPending).toBe(true);
    first.resolve();
    await saving;
    expect(batches).toEqual([
        [{ question: "languages", values: ["en"] }],
        [{ question: "languages", values: ["fr"] }, { question: "age" }],
    ]);
    expect(writes.isPending).toBe(false);
});

test("test_retain_failed_answers_and_explicit_clears_for_retry", async () => {
    const batches: SurveyWrite[][] = [];
    const writes = new SurveyWrites(async (answers) => {
        batches.push(answers);
        if (batches.length === 1) throw new Error("Offline");
    });
    writes.add({ question: "languages", values: ["en"] });
    await expect(writes.flush()).rejects.toThrow("Offline");
    expect(writes.isPending).toBe(true);
    writes.add({ question: "languages", values: [] });
    await writes.flush();
    expect(batches).toEqual([
        [{ question: "languages", values: ["en"] }],
        [{ question: "languages", values: [] }],
    ]);
    expect(writes.isPending).toBe(false);
});
