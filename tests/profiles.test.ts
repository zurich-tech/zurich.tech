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

test("test_save_private_and_public_profiles_without_a_custom_address", async () => {
    const client = await setup();
    const answers = { languages: ["en", "de", "ru"] };
    const before = await client.query(api.members.profiles.current, {});

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

    // allocate an address when publishing, without requiring a custom choice
    await client.mutation(api.members.profiles.save, {
        name: "Test member",
        isPublic: true,
    });
    expect(await client.query(api.members.profiles.current, {})).toEqual({
        ...before,
        demographics: answers,
        handle: "test-member",
        visibility: "public",
    });
});

test("test_preserve_existing_addresses_when_left_blank_or_changing_visibility", async () => {
    const client = await setup();
    await client.mutation(api.members.profiles.save, {
        name: "Test member",
        isPublic: true,
        handle: "Custom-address",
    });
    const before = await client.query(api.members.profiles.current, {});

    // neither clearing the optional field nor editing the name breaks existing links
    for (const isPublic of [false, true]) {
        await client.mutation(api.members.profiles.save, {
            name: "Updated member",
            isPublic,
            handle: " ",
        });
        expect(await client.query(api.members.profiles.current, {})).toEqual({
            ...before,
            name: "Updated member",
            visibility: isPublic ? "public" : "private",
        });
    }
});

test("test_generate_unique_addresses_without_claiming_active_or_reserved_names", async () => {
    const client = await setup();
    await client.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Other member",
            searchText: "other member",
            visibility: "private",
        });
        for (const [name, status] of [
            ["test-member", "active"],
            ["test-member-2", "reserved"],
            ["test-member-3", "released"],
        ] as const) {
            await ctx.db.insert("handles", { name, status, memberId, createdAt: 1, updatedAt: 1 });
        }
    });
    await expect(
        client.mutation(api.members.profiles.save, {
            name: "Test member",
            isPublic: true,
            handle: "test-member",
        }),
    ).rejects.toMatchObject({ data: "This profile address is already taken." });
    await client.mutation(api.members.profiles.save, { name: "Test member", isPublic: true });
    expect((await client.query(api.members.profiles.current, {})).handle).toBe("test-member-3");
});

test("test_generate_valid_addresses_for_accented_short_and_non_latin_names", async () => {
    for (const [name, handle] of [
        ["Florian Cäsar", "florian-casar"],
        ["Li", "member"],
        ["张伟", "member"],
        ["A".repeat(120), "a".repeat(30)],
    ]) {
        const client = await setup();
        await client.mutation(api.members.profiles.save, { name, isPublic: true });
        expect((await client.query(api.members.profiles.current, {})).handle).toBe(handle);
    }
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
