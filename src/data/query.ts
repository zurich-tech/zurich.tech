import { createAsync, query } from "@solidjs/router";
import {
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    onMount,
    type Accessor,
} from "solid-js";
import { isServer } from "solid-js/web";
import {
    getFunctionName,
    type FunctionReference,
    type FunctionArgs,
    type FunctionReturnType,
} from "convex/server";
import { convexToJson, type Value } from "convex/values";
import { publicClient } from "../auth/convex";
import { usePublicClient } from "./context";

/** Define a public snapshot query and a subscription using the same arguments and projection. */
export function publicQuery<
    Reference extends FunctionReference<"query", "public">,
    Args extends unknown[],
    Result extends Value = FunctionReturnType<Reference>,
>(
    reference: Reference,
    name: string,
    argumentsFor: (...args: Args) => FunctionArgs<Reference>,
    select: (value: FunctionReturnType<Reference>) => Result = (value) => value,
) {
    const read = query(async (...args: Args): Promise<Result> => {
        const parameters = argumentsFor(...args);
        const fetch = () => publicClient().query(reference, parameters);
        if (!isServer) return select(await fetch());

        // cache the anonymous backend result, then apply the same projection used by live updates
        const { cachedPublic } = await import("./cache");
        const key = `${import.meta.env.VITE_CONVEX_URL}:${getFunctionName(reference)}:${JSON.stringify(convexToJson(parameters))}`;
        return select(await cachedPublic(key, fetch));
    }, name) as ((...args: Args) => Promise<Result>) & {
        key: string;
        keyFor: (...args: Args) => string;
    };

    /** Hydrate from the router snapshot, then subscribe for the lifetime of this view. */
    function use(args: Accessor<Args | undefined>) {
        const connect = usePublicClient();
        const current = createMemo(
            () => {
                const values = args();
                return values ? { values, key: read.keyFor(...values) } : undefined;
            },
            undefined,
            { equals: (left, right) => left?.key === right?.key },
        );
        const snapshot = createAsync(() => {
            const request = current();
            return request ? read(...request.values) : Promise.resolve(undefined);
        });
        const [live, setLive] = createSignal<
            { key: string; value: Result } | { key: string; error: Error }
        >();

        // replace subscriptions atomically, and ignore callbacks from a disposed subscription
        onMount(() =>
            createEffect(() => {
                const request = current();
                setLive(undefined);
                if (!request) return;
                let isActive = true;
                const unsubscribe = connect().onUpdate(
                    reference,
                    argumentsFor(...request.values),
                    (value) => {
                        if (!isActive) return;
                        const selected = select(value);
                        setLive({ key: request.key, value: selected });
                        query.set<unknown>(request.key, selected);
                    },
                    (error) => {
                        if (isActive) setLive({ key: request.key, error });
                    },
                );
                onCleanup(() => {
                    isActive = false;
                    unsubscribe();
                });
            }),
        );

        return () => {
            const request = current();
            if (!request) return undefined;
            const result = live();
            if (result?.key === request.key) {
                if ("error" in result) throw result.error;
                return result.value;
            }
            return snapshot();
        };
    }

    return Object.assign(read, { use });
}
