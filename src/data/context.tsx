import { ConvexClient } from "convex/browser";
import { createContext, useContext, onCleanup, type JSX } from "solid-js";

const Context = createContext<() => ConvexClient>();

/** Own the anonymous browser connection shared by public views and search. */
export function PublicProvider(props: { children: JSX.Element }) {
    let client: ConvexClient | undefined;
    const connect = () => (client ??= new ConvexClient(import.meta.env.VITE_CONVEX_URL));
    onCleanup(() => void client?.close());

    return <Context.Provider value={connect}>{props.children}</Context.Provider>;
}

/** Obtain the application connection without opening it during server rendering. */
export function usePublicClient() {
    const connect = useContext(Context);
    if (!connect) throw new Error("PublicProvider is required.");

    return connect;
}
