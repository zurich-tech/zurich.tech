import { Navigate } from "@solidjs/router";

/** Preserve existing privacy links after consolidating the legal pages. */
export default function Route() {
    return <Navigate href="/legal#privacy" />;
}
