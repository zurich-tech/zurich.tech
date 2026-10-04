import { expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import { errorMessage } from "../src/components/errors";
import { validateDemographics } from "../convex/members/demographics";
import { normalizeUrl } from "../convex/members/urls";

test("test_display_only_public_server_messages", () => {
    expect(errorMessage(new ConvexError("Choose a profile address."), "Could not save.")).toBe(
        "Choose a profile address.",
    );
    expect(
        errorMessage(
            new Error("[Request ID: abc] Server Error: private diagnostic"),
            "Could not save.",
        ),
    ).toBe("Could not save.");
    expect(
        errorMessage(new ConvexError({ internal: "private diagnostic" }), "Could not save."),
    ).toBe("Could not save.");
});

test("test_preserve_validation_messages_across_forms", () => {
    const cases: [() => unknown, string][] = [
        [
            () => validateDemographics({ languages: ["invalid"] }),
            "Choose each language once from the available options.",
        ],
        [() => normalizeUrl("invalid"), "Enter a valid HTTP or HTTPS URL."],
    ];
    for (const [validate, message] of cases) {
        expect(validate).toThrow(ConvexError);
        try {
            validate();
        } catch (error) {
            expect(errorMessage(error, "Unexpected error.")).toBe(message);
        }
    }
});
