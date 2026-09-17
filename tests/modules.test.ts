import { expect, test } from "bun:test";
import { isModuleLoadError } from "../src/app/modules";

test("module recovery recognises browser import failures without hiding application errors", () => {
    for (const message of [
        "Failed to fetch dynamically imported module: https://zurich.tech/_build/assets/event.js",
        "Importing a module script failed.",
        "error loading dynamically imported module",
        "Unable to preload CSS for /_build/assets/site.css",
    ]) {
        expect(isModuleLoadError(new TypeError(message))).toBe(true);
    }
    expect(isModuleLoadError(new Error("Permission denied"))).toBe(false);
    expect(isModuleLoadError(new TypeError("Failed to fetch"))).toBe(false);
});
