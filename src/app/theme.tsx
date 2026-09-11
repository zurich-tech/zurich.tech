import { createSignal, onCleanup, onMount } from "solid-js";

const themeStorageKey = "zurich-tech-theme";
const themePreferences = ["system", "light", "dark"] as const;

/** One active site theme. */
type Theme = "dark" | "light";

/** One persistent theme preference. */
type ThemePreference = (typeof themePreferences)[number];

/** Set the selected theme before page assets paint. */
export const themeInitializer = `
    (() => {
        const stored = localStorage.getItem("${themeStorageKey}");
        const preference = stored === "dark" || stored === "light" ? stored : "system";
        const systemTheme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

        document.documentElement.dataset.theme = preference === "system" ? systemTheme : preference;
        document.documentElement.dataset.themePreference = preference;
    })();
`;

/** Persistent site theme toggle. */
export function ThemeToggle() {
    const [preference, setPreference] = createSignal<ThemePreference>("system");
    const nextPreference = () => {
        const index = themePreferences.indexOf(preference());

        return themePreferences[(index + 1) % themePreferences.length];
    };

    // select and persist one preference
    const selectPreference = (selected: ThemePreference) => {
        document.documentElement.dataset.theme = resolveTheme(selected);
        document.documentElement.dataset.themePreference = selected;

        if (selected === "system") {
            localStorage.removeItem(themeStorageKey);
        } else {
            localStorage.setItem(themeStorageKey, selected);
        }

        setPreference(selected);
    };
    const selectNextPreference = () => selectPreference(nextPreference());

    // synchronize browser state and shortcuts after hydration
    onMount(() => {
        const selected = document.documentElement.dataset.themePreference;
        if (!isThemePreference(selected)) {
            throw new Error(`Invalid theme preference: ${selected}`);
        }
        setPreference(selected);

        // follow operating system changes while system is active
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
        const synchronizeSystemTheme = () => {
            if (preference() === "system") {
                document.documentElement.dataset.theme = systemTheme.matches ? "dark" : "light";
            }
        };

        // cycle the theme with the same shortcut as Destack
        const selectFromKeyboard = (event: KeyboardEvent) => {
            if (event.altKey && event.key.toLowerCase() === "t") {
                event.preventDefault();
                selectNextPreference();
            }
        };

        systemTheme.addEventListener("change", synchronizeSystemTheme);
        window.addEventListener("keydown", selectFromKeyboard);
        onCleanup(() => {
            systemTheme.removeEventListener("change", synchronizeSystemTheme);
            window.removeEventListener("keydown", selectFromKeyboard);
        });
    });

    return (
        <button
            aria-label={`Theme: ${preference()}; select ${nextPreference()}`}
            class="site-theme-toggle"
            onClick={selectNextPreference}
            title={`Alt+T: select ${nextPreference()} theme`}
            type="button"
        >
            <span aria-hidden="true">◐</span>{" "}
            <span class="site-theme-toggle__preference">{preference()}</span>
        </button>
    );
}

/** Resolve one preference to its active theme. */
function resolveTheme(preference: ThemePreference): Theme {
    if (preference === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    return preference;
}

/** Return whether one document value is a theme preference. */
function isThemePreference(value?: string): value is ThemePreference {
    return themePreferences.some((preference) => preference === value);
}
