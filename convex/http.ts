import { receive, unsubscribe } from "./mail/webhooks";
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

http.route({ path: "/mail/webhook", method: "POST", handler: receive });
http.route({ path: "/mail/unsubscribe", method: "POST", handler: unsubscribe });
http.route({ path: "/mail/unsubscribe", method: "GET", handler: unsubscribe });

export default http;
