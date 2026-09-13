import logo from "../components/assets/logo.svg?raw";

/** Display the community logo. */
export function Brand() {
    return <span class="site-symbol" aria-hidden="true" innerHTML={logo} />;
}
