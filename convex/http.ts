import { httpRouter } from "convex/server";

import { authComponent, createAuth, requiredEnvironment } from "./auth";

/** Convex HTTP routes. */
const http = httpRouter();

// authentication
authComponent.registerRoutesLazy(http, createAuth, {
    cors: true,
    trustedOrigins: [requiredEnvironment("SITE_URL")],
});

export default http;
