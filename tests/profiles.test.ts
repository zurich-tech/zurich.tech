import { convexTest, schema, modules, member } from "./backend";
import { expect, test } from "bun:test";
import { api } from "../convex/_generated/api";
import type { FunctionArgs } from "convex/server";

/** Create a signed-in member with no public address. */
async function setup() {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Test member",
            searchText: "test member",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            authId: "member",
            memberId,
            status: "active",
            isTeam: false,
            isAdmin: false,
            createdAt: 1,
            updatedAt: 1,
        });
    });

    return backend.withIdentity({ subject: "member" });
}

test("test_require_an_address_only_for_public_profiles", async () => {
    const client = await setup();
    const answers = { languages: ["en", "de", "ru"] };
    const before = await client.query(api.members.profiles.current, {});

    // reject publication without losing or partially saving profile answers
    await expect(
        client.mutation(api.members.profiles.save, {
            name: "Test member",
            isPublic: true,
            demographics: answers,
        }),
    ).rejects.toMatchObject({ data: "Choose a profile address or turn off Public profile." });
    expect(await client.query(api.members.profiles.current, {})).toEqual(before);

    // accept private survey answers without requiring a public address
    await client.mutation(api.members.profiles.save, {
        name: "Test member",
        isPublic: false,
        demographics: answers,
    });
    expect(await client.query(api.members.profiles.current, {})).toEqual({
        ...before,
        demographics: answers,
    });

    // publish only after the member chooses an address
    await client.mutation(api.members.profiles.save, {
        name: "Test member",
        isPublic: true,
        handle: "Test-member",
    });
    expect(await client.query(api.members.profiles.current, {})).toEqual({
        ...before,
        demographics: answers,
        handle: "test-member",
        visibility: "public",
    });
});

test("test_expose_actionable_profile_validation_messages", async () => {
    const client = await setup();
    for (const [fields, message] of [
        [{ handle: "12" }, "Use 3–40 letters, numbers or hyphens, starting with a letter."],
        [{ name: "" }, "Enter a name, up to 120 characters."],
        [{ profileUrl: "not a url" }, "Enter a valid HTTP or HTTPS URL."],
        [
            { demographics: { languages: ["en", "en"] } },
            "Choose each language once from the available options.",
        ],
        [{ affiliations: [{ role: "", organisation: "" }] }, "Enter a role or organisation."],
    ] satisfies [Partial<FunctionArgs<typeof api.members.profiles.save>>, string][]) {
        await expect(
            client.mutation(api.members.profiles.save, {
                name: "Test member",
                isPublic: false,
                ...fields,
            }),
        ).rejects.toMatchObject({ data: message });
    }
});
