import { ConvexClient } from "convex/browser";
import {
    createContext,
    createMemo,
    createSignal,
    onMount,
    onCleanup,
    useContext,
    type Accessor,
    type JSX,
} from "solid-js";
import { api } from "../../convex/_generated/api";
import {
    indexRecords,
    searchRecords,
    matchRecord,
    type SearchKind,
    type SearchRecord,
} from "./search";

type Catalogue = {
    isReady: Accessor<boolean>;
    error: Accessor<string>;
    retry: () => void;
    search: (text: string, kind?: SearchKind, limit?: number) => ReturnType<typeof searchRecords>;
    upcoming: () => NonNullable<ReturnType<typeof matchRecord>>[];
};
const Context = createContext<Catalogue>();

/** Start one public subscription per browser application and reuse its in-memory index. */
export function CatalogueProvider(props: { children: JSX.Element }) {
    const [records, setRecords] = createSignal<SearchRecord[]>([]);
    const [isReady, setReady] = createSignal(false);
    const [error, setError] = createSignal("");
    let reconnect = () => {};
    const index = createMemo(() => indexRecords(records()));

    // This client never receives an auth token, and closes with the application root.
    onMount(() => {
        const client = new ConvexClient(import.meta.env.VITE_CONVEX_URL);
        let unsubscribe = () => {};
        reconnect = () => {
            unsubscribe();
            setError("");
            unsubscribe = client.onUpdate(
                api.search.search.catalogue,
                {},
                (value) => {
                    setRecords(value);
                    setReady(true);
                    setError("");
                },
                (caught) => {
                    setRecords([]);
                    setReady(false);
                    setError(caught.message);
                },
            );
        };
        reconnect();
        onCleanup(() => {
            unsubscribe();
            void client.close();
        });
    });
    const catalogue: Catalogue = {
        isReady,
        error,
        retry: () => reconnect(),
        search: (text, kind, limit) => searchRecords(index(), text, kind, limit),
        upcoming: () =>
            records()
                .filter(
                    (record) =>
                        record.kind === "Events" &&
                        record.status === "scheduled" &&
                        record.startsAt! >= Date.now(),
                )
                .sort((a, b) => a.startsAt! - b.startsAt!)
                .slice(0, 4)
                .map((record) => matchRecord(record, [])!),
    };
    return <Context.Provider value={catalogue}>{props.children}</Context.Provider>;
}

/** Access the same catalogue from the command menu and collection filters. */
export function useCatalogue() {
    const value = useContext(Context);
    if (!value) throw new Error("CatalogueProvider is required.");
    return value;
}
