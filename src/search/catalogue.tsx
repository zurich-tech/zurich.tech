import { usePublicClient } from "../data/context";
import {
    createContext,
    createMemo,
    createSignal,
    createEffect,
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
    const connect = usePublicClient();
    const [isRequested, setRequested] = createSignal(false);
    const [result, setResult] = createSignal<SearchRecord[] | Error>();
    const records = createMemo(() => {
        const value = result();
        return Array.isArray(value) ? value : [];
    });
    let reconnect = () => {};
    const index = createMemo(() => indexRecords(records()));

    // defer the full search index until a search view needs it, then retain it for navigation
    onMount(() => {
        createEffect(() => {
            if (!isRequested()) return;
            const client = connect();
            let unsubscribe = () => {};
            reconnect = () => {
                unsubscribe();
                setResult(undefined);
                unsubscribe = client.onUpdate(
                    api.search.search.catalogue,
                    {},
                    (value) => setResult(value),
                    (error) => setResult(error),
                );
            };
            reconnect();
            onCleanup(() => unsubscribe());
        });
    });
    const catalogue: Catalogue = {
        isReady: () => Array.isArray(result()),
        error: () => {
            const value = result();
            return value instanceof Error ? value.message : "";
        },
        retry: () => reconnect(),
        search: (text, kind, limit) => {
            setRequested(true);
            return searchRecords(index(), text, kind, limit);
        },
        upcoming: () => {
            setRequested(true);
            return records()
                .filter(
                    (record) =>
                        record.kind === "Events" &&
                        record.status === "scheduled" &&
                        record.startsAt! >= Date.now(),
                )
                .sort((a, b) => a.startsAt! - b.startsAt!)
                .slice(0, 4)
                .map((record) => matchRecord(record, [])!);
        },
    };
    return <Context.Provider value={catalogue}>{props.children}</Context.Provider>;
}

/** Access the same catalogue from the command menu and collection filters. */
export function useCatalogue() {
    const value = useContext(Context);
    if (!value) throw new Error("CatalogueProvider is required.");
    return value;
}
