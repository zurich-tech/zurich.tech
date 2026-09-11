import { mount, StartClient } from "@solidjs/start/client";

const root = document.getElementById("app");

if (root === null) {
    throw new Error("Missing app root.");
}

const dispose = mount(() => <StartClient />, root);

export default dispose;
