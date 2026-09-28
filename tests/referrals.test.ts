import { afterEach, expect, test, setSystemTime } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api } from "../convex/_generated/api";
import { arrival } from "../src/statistics/arrival";
import { attribute } from "../convex/mail/referrals";
import { campaignEmail } from "../convex/mail/templates";

/** Restore time and environment after each isolated backend exercise. */
const originalOrigin = process.env.SITE_URL;
afterEach(() => {
    setSystemTime();
    if (originalOrigin === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = originalOrigin;
});

/** Create an administrator without connecting to a live deployment. */
async function setup() {
    process.env.SITE_URL = "https://zurich.tech";
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Admin",
            searchText: "admin",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            authId: "admin",
            memberId,
            status: "active",
            isTeam: false,
            isAdmin: true,
            createdAt: 1,
            updatedAt: 1,
        });
    });

    return { backend, admin: backend.withIdentity({ subject: "admin" }) };
}

test("test_read_only_campaign_dimensions_on_public_landings", () => {
    // discard unrelated parameters, fragments and identifiers rather than transmitting them
    const url = new URL(
        "https://zurich.tech/events/example?utm_source=newsletter&utm_medium=email&utm_campaign=launch-2026&token=secret#private",
    );
    expect(arrival(url)).toEqual({
        path: "/events/example",
        source: "newsletter",
        medium: "email",
        campaign: "launch-2026",
    });
    for (const path of [
        "/registration",
        "/unsubscribe",
        "/settings",
        "/admin",
        "/members/person",
    ]) {
        url.pathname = path;
        expect(arrival(url)).toBeNull();
    }
    url.pathname = "/events";
    url.searchParams.append("utm_source", "other");
    expect(arrival(url)).toBeNull();
    expect(arrival(new URL("https://zurich.tech/"))).toBeNull();
});

test("test_register_direct_links_and_aggregate_without_visitor_records", async () => {
    // unknown campaign labels cannot create analytics rows
    setSystemTime(new Date("2026-09-28T21:59:00Z"));
    const { backend, admin } = await setup();
    const tags = {
        path: "/events",
        source: "newsletter",
        medium: "email",
        campaign: "launch-2026",
    };
    expect(await backend.mutation(api.statistics.referrals.record, tags)).toBe(false);
    const link = await admin.mutation(api.statistics.referrals.create, tags);
    expect(link).toBe(
        "https://zurich.tech/events?utm_source=newsletter&utm_medium=email&utm_campaign=launch-2026",
    );
    expect(await admin.mutation(api.statistics.referrals.create, tags)).toBe(link);

    // repeated arrivals increment one counter, while Zurich midnight starts another
    expect(await backend.mutation(api.statistics.referrals.record, tags)).toBe(true);
    expect(await backend.mutation(api.statistics.referrals.record, tags)).toBe(true);
    setSystemTime(new Date("2026-09-28T22:01:00Z"));
    expect(await backend.mutation(api.statistics.referrals.record, tags)).toBe(true);
    const rows = await admin.query(api.statistics.referrals.list, {});
    expect(rows.length).toBe(1);
    expect(rows[0].days).toEqual([
        { date: "2026-09-28", count: 2 },
        { date: "2026-09-29", count: 1 },
    ]);
    const stored = await backend.run((ctx) => ctx.db.query("arrivals").collect());
    expect(stored.map(({ _id, _creationTime, ...row }) => row)).toEqual([
        { date: "2026-09-28", referralId: rows[0]._id, count: 2 },
        { date: "2026-09-29", referralId: rows[0]._id, count: 1 },
    ]);
});

test("test_restrict_registration_and_reports_to_administrators", async () => {
    // anonymous collection grants no authority to define links or read campaign reports
    const { backend, admin } = await setup();
    const tags = { path: "/events", source: "linkedin", medium: "social", campaign: "launch-2026" };
    await expect(backend.mutation(api.statistics.referrals.create, tags)).rejects.toThrow();
    await expect(backend.query(api.statistics.referrals.list, {})).rejects.toThrow();
    for (const path of [
        "/registration",
        "/news/missing",
        "/events/missing",
        "/events?token=secret",
        "https://other.example/events",
    ]) {
        await expect(
            admin.mutation(api.statistics.referrals.create, { ...tags, path }),
        ).rejects.toThrow();
    }
    expect(
        await backend.mutation(api.statistics.referrals.record, {
            ...tags,
            source: "person@example.com",
        }),
    ).toBe(false);
});

test("test_tag_email_destinations_automatically_without_personalising_tracking", async () => {
    // render shared content with public, private, external and token-bearing links
    const { backend, admin } = await setup();
    const id = await admin.mutation(api.mail.campaigns.save, {
        subject: "Launch",
        message:
            "https://zurich.tech/events\nhttps://zurich.tech/events?token=secret\nhttps://zurich.tech/settings\nhttps://elsewhere.example/events",
    });
    const result = await backend.run(async (ctx) => {
        const campaign = (await ctx.db.get(id))!;
        const original = campaignEmail(campaign, "https://mail.invalid/unsubscribe");
        const tagged = await attribute(original, campaign, ctx);
        const repeated = await attribute(tagged, campaign, ctx);
        const transactional = await attribute(
            original,
            { ...campaign, category: "confirmed" },
            ctx,
        );

        return {
            original,
            tagged,
            repeated,
            transactional,
            links: await ctx.db.query("referrals").collect(),
        };
    });
    const query = `?utm_source=newsletter&utm_medium=email&utm_campaign=launch-${id}`;
    const escaped = query.replaceAll("&", "&amp;");
    expect(result.tagged).toEqual({
        ...result.original,
        text: result.original.text
            .replace("https://zurich.tech/events\n", `https://zurich.tech/events${query}\n`)
            .replace(
                "zurich.tech: https://zurich.tech\n",
                `zurich.tech: https://zurich.tech/${query}\n`,
            ),
        html: result.original.html
            .replaceAll(
                'href="https://zurich.tech/events"',
                `href="https://zurich.tech/events${escaped}"`,
            )
            .replaceAll('href="https://zurich.tech"', `href="https://zurich.tech/${escaped}"`),
    });
    expect(result.repeated).toEqual(result.tagged);
    expect(result.transactional).toEqual(result.original);
    expect(
        result.links
            .map(({ path, source, medium, campaign }) => ({ path, source, medium, campaign }))
            .sort((a, b) => a.path.localeCompare(b.path)),
    ).toEqual([
        { path: "/", source: "newsletter", medium: "email", campaign: `launch-${id}` },
        { path: "/events", source: "newsletter", medium: "email", campaign: `launch-${id}` },
    ]);
});
