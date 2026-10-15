import { expect, mock, test } from "bun:test";
import { createRequire } from "node:module";
import { renderToString } from "solid-js/web";

/** A workspace member without elevated privileges or scoped assignments. */
const member = { canManage: true, isAdmin: false, isTeam: false, grants: [] };

// isolate the real Solid compiler and module loader from unrelated tests
if (process.env.ADMIN_NAVIGATION_TEST_CHILD !== "1") {
    test("test_render_and_filter_admin_navigation", () => {
        const result = Bun.spawnSync([process.execPath, "test", import.meta.path], {
            env: { ...process.env, ADMIN_NAVIGATION_TEST_CHILD: "1" },
        });
        expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(0);
    });
} else {
    // stub only decorative icons whose package ships browser-compiled DOM templates
    mock.module("lucide-solid", () =>
        Object.fromEntries(
            [
                "CalendarDays",
                "Layers",
                "Newspaper",
                "Building2",
                "BriefcaseBusiness",
                "Handshake",
                "Users",
                "Mail",
                "ChartNoAxesCombined",
                "Tags",
                "ShieldCheck",
                "ChevronDown",
            ].map((name) => [name, () => ""]),
        ),
    );
    const filename = new URL("../src/app/admin-navigation.tsx", import.meta.url).pathname;
    const require = createRequire(filename);
    const transformed = require("@babel/core").transformSync(await Bun.file(filename).text(), {
        filename,
        babelrc: false,
        configFile: false,
        parserOpts: { plugins: ["typescript", "jsx"] },
        presets: [[require("babel-preset-solid"), { generate: "ssr", hydratable: false }]],
    });
    if (!transformed?.code) throw new Error("Admin navigation SSR compilation produced no code.");
    Bun.plugin({
        name: "admin-navigation-ssr-test",
        setup(build) {
            build.onLoad({ filter: /\/src\/app\/admin-navigation\.tsx$/ }, () => ({
                contents: transformed.code,
                loader: "ts",
            }));
        },
    });
    const { adminHref, adminSections, AdminNavigation } =
        await import("../src/app/admin-navigation");

    test("test_hide_navigation_without_workspace_access", () => {
        expect(adminSections(null)).toEqual([]);
        expect(adminSections(undefined)).toEqual([]);
        expect(adminSections({ ...member, canManage: false })).toEqual([]);
    });

    test("test_expose_only_events_for_event_scoped_members", () => {
        expect(adminSections({ ...member, grants: [{ scope: { kind: "event" } }] })).toEqual([
            { id: "events", label: "Events", href: "/admin" },
        ]);
    });

    test("test_expose_series_for_series_scoped_members_without_admin_destinations", () => {
        expect(adminSections({ ...member, grants: [{ scope: { kind: "series" } }] })).toEqual([
            { id: "events", label: "Events", href: "/admin" },
            { id: "series", label: "Series", href: "/admin?section=series" },
        ]);
    });

    test("test_expose_team_content_without_private_administration", () => {
        expect(adminSections({ ...member, isTeam: true })).toEqual([
            { id: "events", label: "Events", href: "/admin" },
            { id: "series", label: "Series", href: "/admin?section=series" },
            { id: "news", label: "News", href: "/admin?section=news" },
            { id: "organisations", label: "Organisations", href: "/admin?section=organisations" },
            { id: "topics", label: "Topics", href: "/admin?section=topics" },
        ]);
    });

    test("test_expose_every_admin_destination_once_in_group_order", () => {
        expect(adminSections({ ...member, isAdmin: true })).toEqual([
            { id: "events", label: "Events", href: "/admin" },
            { id: "series", label: "Series", href: "/admin?section=series" },
            { id: "news", label: "News", href: "/admin?section=news" },
            { id: "organisations", label: "Organisations", href: "/admin?section=organisations" },
            { id: "jobs", label: "Jobs", href: "/admin?section=jobs" },
            { id: "sponsors", label: "Sponsors", href: "/admin?section=sponsors" },
            { id: "topics", label: "Topics", href: "/admin?section=topics" },
            { id: "audience", label: "Audience", href: "/admin?section=audience" },
            { id: "email", label: "Email", href: "/admin?section=email" },
            { id: "traffic", label: "Traffic", href: "/admin?section=traffic" },
            { id: "people", label: "Access", href: "/admin?section=people" },
        ]);
    });

    test("test_replace_record_queries_and_fragments_when_switching_sections", () => {
        const current =
            "https://zurich.tech/admin?section=series&series=one&schedule=two&source=three#editor";
        expect(new URL(adminHref("events"), current).href).toBe("https://zurich.tech/admin");
        expect(new URL(adminHref("email"), current).href).toBe(
            "https://zurich.tech/admin?section=email",
        );
    });

    test("test_render_matching_desktop_and_mobile_destinations_and_active_state", async () => {
        for (const access of [
            null,
            member,
            { ...member, isTeam: true },
            { ...member, isAdmin: true },
        ]) {
            const options = adminSections(access);
            for (const value of ["unavailable", ...options.map((option) => option.id)]) {
                const html = renderToString(() =>
                    AdminNavigation({ options, value, onChange: () => {} }),
                );
                const links: { href: string | null; current: string | null }[] = [];
                const choices: { value: string | null; selected: boolean }[] = [];
                await new HTMLRewriter()
                    .on("nav a", {
                        element(element) {
                            links.push({
                                href: element.getAttribute("href"),
                                current: element.getAttribute("aria-current"),
                            });
                        },
                    })
                    .on("option", {
                        element(element) {
                            // Bun 1.3 returns null for present attributes with an empty value
                            expect(element.hasAttribute("value")).toBe(true);
                            choices.push({
                                value: element.getAttribute("value") ?? "",
                                selected: element.hasAttribute("selected"),
                            });
                        },
                    })
                    .transform(new Response(html))
                    .text();
                expect(links).toEqual(
                    options.map((option) => ({
                        href: option.href,
                        current: option.id === value ? "page" : null,
                    })),
                );
                expect(choices).toEqual(
                    options.length
                        ? [
                              {
                                  value: "",
                                  selected: !options.some((option) => option.id === value),
                              },
                              ...options.map((option) => ({
                                  value: option.href,
                                  selected: option.id === value,
                              })),
                          ]
                        : [],
                );
            }
        }
    });
}
