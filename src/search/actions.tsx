import {
    createContext,
    useContext,
    createSignal,
    createRenderEffect,
    onCleanup,
    type JSX,
    type Accessor,
} from "solid-js";

/** A command either navigates or invokes the feature's existing action flow. */
export type Command = {
    id: string;
    label: string;
    description?: string;
    keywords?: string;
    group: string;
} & ({ href: string; run?: never } | { run: () => void | Promise<void>; href?: never });
type Registry = {
    items: Accessor<Command[]>;
    register: (source: Accessor<Command[]>) => () => void;
};
const Context = createContext<Registry>();

/** Keep command registrations scoped to this application instance and route lifetime. */
export function createCommands(): Registry {
    const [sources, setSources] = createSignal<Accessor<Command[]>[]>([]);
    const registry: Registry = {
        items: () => sources().flatMap((source) => source()),
        register: (source) => {
            // Evaluate page state in its own render lifecycle, never from the global menu.
            const [items, setItems] = createSignal<Command[]>([]);
            createRenderEffect(() => setItems(source()));
            setSources((sources) => [...sources, items]);

            return () => setSources((sources) => sources.filter((item) => item !== items));
        },
    };
    return registry;
}

/** Provide the application command registry. */
export function CommandProvider(props: { children: JSX.Element }) {
    return <Context.Provider value={createCommands()}>{props.children}</Context.Provider>;
}

/** Access the shared command menu. */
export function useCommands() {
    const registry = useContext(Context);
    if (!registry) throw new Error("CommandProvider is required.");
    return registry;
}

/** Publish reactive commands from a feature and remove them when it unmounts. */
export function PageCommands(props: { items: Command[] }) {
    const registry = useCommands();
    const remove = registry.register(() => props.items);
    onCleanup(remove);
    return null;
}

/** Register feature-owned action handlers for exactly the component's lifetime. */
export function registerCommands(source: Accessor<Command[]>) {
    const remove = useCommands().register(source);
    onCleanup(remove);
}
