import application from "../../.output/server/index.mjs";
import { cachedPage } from "../../src/server/pages";

/** Cache public documents before invoking the server renderer. */
export default {
    ...application,
    fetch(request, environment, context) {
        return cachedPage(request, () => application.fetch(request, environment, context), {
            version: environment.VERSION.id,
            storage: caches,
            waitUntil: (work) => context.waitUntil(work),
        });
    },
};
