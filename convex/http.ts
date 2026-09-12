import { image } from "./events/checkin";
import { webhook } from "./billing/stripe";
import { httpRouter } from "convex/server";

import { authComponent } from "./auth/component";
import { createAuth } from "./auth/server";
import { requiredEnvironment } from "./auth/environment";

/** Convex HTTP routes. */
const http = httpRouter();

// authentication
authComponent.registerRoutesLazy(http, createAuth, {
    cors: true,
    trustedOrigins: [requiredEnvironment("SITE_URL")],
});

http.route({ path: "/stripe/webhook", method: "POST", handler: webhook });

http.route({ path: "/passes/qr", method: "GET", handler: image });

export default http;
