import { useSearchParams } from "@solidjs/router";
import { searchTerms } from "./search";

/** Share collection queries with global search links, reloads and browser history. */
export function useSearch() {
    const [params, setParams] = useSearchParams();
    const query = () => (typeof params.q === "string" ? params.q : "");
    return {
        query,
        terms: () => searchTerms(query()),
        setQuery: (q: string) => setParams({ q: q || undefined }, { replace: true, scroll: false }),
    };
}
