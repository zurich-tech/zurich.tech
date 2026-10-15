import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import { renderToString } from "solid-js/web";
import { isHostedLogo } from "../src/organisations/logos";

/** A valid content-addressed hosted organisation logo. */
const hosted = `https://media.zurich.tech/organisations/example/${"a".repeat(64)}.png`;

/** Compile the actual component with Solid's SSR transform, without mocking its rendering. */
async function imageRenderer() {
    const filename = new URL("../src/components/image.tsx", import.meta.url).pathname;
    const require = createRequire(filename);
    const source = await Bun.file(filename).text();
    const transformed = require("@babel/core").transformSync(source, {
        filename,
        babelrc: false,
        configFile: false,
        parserOpts: { plugins: ["typescript", "jsx"] },
        presets: [[require("babel-preset-solid"), { generate: "ssr", hydratable: false }]],
    });
    if (!transformed?.code) throw new Error("Image SSR compilation produced no code.");

    // let Bun resolve the real component dependencies and erase remaining type annotations
    Bun.plugin({
        name: "image-ssr-test",
        setup(build) {
            build.onLoad({ filter: /\/src\/components\/image\.tsx$/ }, () => ({
                contents: transformed.code,
                loader: "ts",
            }));
        },
    });
    const { Image } = await import("../src/components/image");

    return (props: Parameters<typeof Image>[0]) => renderToString(() => Image(props));
}

test("test_render_image_sources_with_independent_cors_and_theme_attributes", async () => {
    // isolate the SSR loader and component module cache from every other test
    if (process.env.IMAGE_SSR_TEST_CHILD !== "1") {
        const result = Bun.spawnSync(
            [
                process.execPath,
                "test",
                import.meta.path,
                "--test-name-pattern",
                "^test_render_image_sources_with_independent_cors_and_theme_attributes$",
            ],
            { env: { ...process.env, IMAGE_SSR_TEST_CHILD: "1" } },
        );
        expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(0);

        return;
    }

    // exercise the real SSR output only inside the dedicated child process
    const render = await imageRenderer();
    const remote = "https://sponsor.example/logo.svg";
    for (const src of [undefined, hosted, remote, "/logos/local.svg"]) {
        for (const darkSrc of [undefined, hosted, remote]) {
            for (const crossorigin of [undefined, "use-credentials"] as const) {
                const html = render({ src, darkSrc, crossorigin, alt: "Logo", loading: "lazy" });
                const images: Record<string, string>[] = [];
                await new HTMLRewriter()
                    .on("img", {
                        element(element) {
                            images.push(
                                Object.fromEntries(
                                    [...element.attributes].filter(([key]) => key !== "data-hk"),
                                ),
                            );
                        },
                    })
                    .transform(new Response(html))
                    .text();
                const sources = darkSrc ? [src, darkSrc] : [src];
                expect(images).toEqual(
                    sources.map((source, index) => ({
                        decoding: "async",
                        alt: "Logo",
                        loading: "lazy",
                        ...(source !== undefined ? { src: source } : {}),
                        ...(isHostedLogo(source)
                            ? { crossorigin: "anonymous" }
                            : crossorigin
                              ? { crossorigin }
                              : {}),
                        class: darkSrc ? (index === 0 ? "image--light" : "image--dark") : "",
                    })),
                );
            }
        }
    }
});

test("test_recognise_content_addressed_hosted_logos", () => {
    expect(isHostedLogo(hosted)).toBe(true);
    expect(isHostedLogo(hosted.replace("a".repeat(64), "b".repeat(64)))).toBe(true);
});

test("test_reject_noncanonical_hosted_logo_urls", () => {
    for (const source of [
        undefined,
        "",
        "/logos/sponsor.svg",
        "https://sponsor.example/logo.png",
        "data:image/png;base64,AAAA",
        "https://media.zurich.tech/events/example/thumbnail.webp",
        "https://media.zurich.tech/organisations/example/logo.png",
        hosted.replace("https:", "http:"),
        hosted.replace("media.zurich.tech", "media.zurich.tech.example"),
        hosted.replace("media.zurich.tech", "media.zurich.tech@example.com"),
        hosted.replace("/organisations/", "/other/"),
        hosted.replace("a".repeat(64), "a".repeat(63)),
        hosted + "?version=1",
        hosted + "#logo",
        hosted + "\n",
    ]) {
        expect(isHostedLogo(source)).toBe(false);
    }
});

test("test_classify_each_logo_source_independently", () => {
    const remote = "https://sponsor.example/dark.svg";

    expect([hosted, remote].map(isHostedLogo)).toEqual([true, false]);
    expect([remote, hosted].map(isHostedLogo)).toEqual([false, true]);
});
