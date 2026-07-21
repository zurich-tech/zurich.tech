import { describe, expect, test } from "bun:test";

import { archiveEvents, validateArchive } from "../convex/archive";

describe("event archive", () => {
    test("test_validate_complete_archive", () => {
        // validate every canonical identity and source invariant
        expect(validateArchive).not.toThrow();
        expect(archiveEvents).toHaveLength(40);

        // retain the exact historical source split
        const wordpress = archiveEvents.filter((event) => event.source === "zurich-nlp.ch");
        const wix = archiveEvents.filter((event) => event.source === "zurichai.ch");
        expect({ wordpress: wordpress.length, wix: wix.length }).toEqual({
            wordpress: 13,
            wix: 27,
        });
    });
});
