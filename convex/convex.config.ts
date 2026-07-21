import betterAuth from "@convex-dev/better-auth/convex.config";
import { defineApp } from "convex/server";

/** Convex application components. */
const app = defineApp();

// authentication
app.use(betterAuth);

export default app;
