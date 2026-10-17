import { createMemo, createSignal, onCleanup } from "solid-js";
import { render } from "solid-js/web";
import { MapDirectory, type MapDirectoryHandle } from "../../src/map/directory";
import { filterLocations } from "../../src/map/filter";
import type { MapLocation } from "../../src/map/queries";
import { searchTerms } from "../../convex/search/ranking";
import { Highlight } from "../../src/components/highlight";

/** Exercise actual mounted Solid rows through shrinking, empty and reordered result sets. */
function Regression() {
    const [query, setQuery] = createSignal("");
    const [isReversed, setReversed] = createSignal(false);
    const [isReplaced, setReplaced] = createSignal(false);
    const [status, setStatus] = createSignal("Ready");
    const [failures, setFailures] = createSignal(0);
    const [selected, setSelected] = createSignal<string>();
    const [hovered, setHovered] = createSignal<string>();
    let handle: MapDirectoryHandle;
    let root!: HTMLDivElement;

    // preserve stable rows like map.tsx, including multiple tenants sharing one place ID
    const original = fixtures("");
    const replacement = fixtures("replacement-");
    const catalogue = createMemo(() => (isReplaced() ? replacement : original));
    const directory = createMemo(() =>
        catalogue()
            .flatMap((place) =>
                place.organisations.map((person) => ({ ...place, organisations: [person] })),
            )
            .sort((a, b) => a.organisations[0].name.localeCompare(b.organisations[0].name)),
    );
    const listed = createMemo(() => {
        const matches = new Map(
            filterLocations(catalogue(), "all", searchTerms(query())).map((place) => [
                place.id,
                new Set(place.organisations.map((person) => person.id)),
            ]),
        );
        const places = directory().filter((place) =>
            matches.get(place.id)?.has(place.organisations[0].id),
        );

        return isReversed() ? [...places].reverse() : places;
    });

    // report errors without preventing browser reporting or swallowing exceptions
    function fail() {
        setFailures((value) => value + 1);
        setStatus("FAIL: browser error; inspect console");
    }
    window.addEventListener("error", fail);
    window.addEventListener("unhandledrejection", fail);
    onCleanup(() => {
        window.removeEventListener("error", fail);
        window.removeEventListener("unhandledrejection", fail);
    });

    /** Assert every mounted row still corresponds to its current position and organisation. */
    function verify() {
        const expected = listed();
        const rows = root.querySelectorAll<HTMLElement>("[data-directory-key]");
        if (expected.length && !rows.length)
            throw new Error("No mounted rows for nonempty results");
        if (!expected.length && rows.length) throw new Error("Stale rows after empty results");
        for (const row of rows) {
            const place = expected[Number(row.dataset.index)];
            const button = row.querySelector<HTMLButtonElement>("button")!;
            const key = JSON.stringify([place.id, place.organisations.map((person) => person.id)]);
            if (
                row.dataset.directoryKey !== key ||
                button.dataset.organisationId !== place.organisations[0].id
            )
                throw new Error(`Stale row identity at index ${row.dataset.index}`);
        }
    }

    /** Run 50 rounds with frame-separated input and 50 with updates faster than measurement. */
    async function run() {
        setStatus("Running");
        const sequence = ["E", "ET", "ETH", "ET", "E", "", "no-such-result", ""];
        let checks = 0;
        for (let round = 0; round < 100; round++) {
            for (const value of sequence) {
                setQuery(value);
                setSelected(listed()[0]?.organisations[0].id);
                setHovered(listed().at(-1)?.organisations[0].id);
                if (round < 50) await paint();
                else await Promise.resolve();
                setSelected(undefined);
                setHovered(undefined);
                verify();
                checks++;
            }
            setReversed((value) => !value);
            setReplaced((value) => !value);
            await paint();
            verify();
            checks++;
            const last = listed().at(-1)!;
            if (!handle.focus(last.id, last.organisations[0].id))
                throw new Error("Last result focus rejected");
            await paint();
            if (
                (document.activeElement as HTMLElement | null)?.dataset.organisationId !==
                last.organisations[0].id
            )
                throw new Error("Last result focus reached the wrong organisation");
        }
        if (failures()) throw new Error(`${failures()} browser errors during regression`);
        setStatus(`PASS: ${checks} identity checks, 100 rounds, 1600 organisations`);
    }

    return (
        <div ref={root}>
            <label>
                Query{" "}
                <input value={query()} onInput={(event) => setQuery(event.currentTarget.value)} />
            </label>
            <button onClick={run} disabled={status() === "Running"}>
                Run regression
            </button>
            <output>{status()}</output>
            <p>
                Matches: {listed().length}; errors: {failures()}
            </p>
            <div
                class="map-panel-content"
                style={{ height: "350px", width: "360px", overflow: "auto" }}
            >
                <p>Directory results</p>
                <MapDirectory places={listed()} onReady={(value) => (handle = value)}>
                    {(place) => {
                        // subscribe the invocation itself to updates after shrinking the result set
                        selected();
                        hovered();
                        return (
                            <button
                                data-organisation-id={place.organisations[0].id}
                                classList={{
                                    selected: selected() === place.organisations[0].id,
                                    hovered: hovered() === place.organisations[0].id,
                                }}
                                style={{
                                    display: "block",
                                    width: "100%",
                                    padding: "12px",
                                    "min-height": "65px",
                                }}
                            >
                                <strong>
                                    <Highlight
                                        text={place.organisations[0].name}
                                        terms={searchTerms(query())}
                                    />
                                </strong>
                                <small>
                                    {query()
                                        ? `${place.organisations[0].name} matches ${query()}`
                                        : place.organisations[0].name}
                                </small>
                                <br />
                                {place.organisations[0].headline}
                                <br />
                                {place.address}
                            </button>
                        );
                    }}
                </MapDirectory>
            </div>
        </div>
    );
}

/** Wait for layout and ResizeObserver animation-frame measurements. */
function paint(): Promise<void> {
    return new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
}

/** Supply a deterministic catalogue with overlapping prefixes and shared offices. */
function fixtures(prefix: string): MapLocation[] {
    const names = [
        "ETH Robotics",
        "Eterna Systems",
        "Echo Labs",
        "Atlas AI",
        "Bionic Manufacturing",
    ];

    return Array.from({ length: 800 }, (_, index) => ({
        id: `${prefix}place-${index}`,
        address: `Campus ${index}, 8000 Zurich`,
        latitude: 47.38,
        longitude: 8.54,
        organisations: Array.from({ length: 2 }, (_, tenant) => ({
            id: `${prefix}org-${index}-${tenant}`,
            slug: `${prefix}org-${index}-${tenant}`,
            name: `${names[(index + tenant) % names.length]} ${index}-${tenant}`,
            kind: "company" as const,
            location: "Zurich",
            prominence: "small" as const,
            headline:
                index % 3
                    ? "Own sensor and control technology"
                    : "Designs and manufactures industrial measurement instruments with configurable software",
        })),
    }));
}

render(Regression, document.getElementById("app")!);
