import { defineNitroPlugin } from "nitropack/runtime";

/** Documents must revalidate; failed requests must never become immutable assets. */
export default defineNitroPlugin((app) => {
    app.hooks.hook("beforeResponse", (event) => {
        const response = event.node.res;
        if (response.statusCode >= 400) {
            response.setHeader("Cache-Control", "no-store");
        } else if (String(response.getHeader("Content-Type")).includes("text/html")) {
            response.setHeader("Cache-Control", "no-cache");
        }
    });
});
