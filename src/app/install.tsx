import {
    createContext,
    createSignal,
    onCleanup,
    onMount,
    Show,
    useContext,
    type JSX,
} from "solid-js";
import { Download } from "lucide-solid";
import { Dialog } from "../components/dialog";
import { Button } from "../components/button";

/** Browser-owned, single-use installation prompt. */
interface InstallPrompt extends Event {
    /** Open the native installation dialog. */
    prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Installation controls shared by the menu and account page. */
const InstallContext = createContext<{
    /** Whether this window already runs as an installed app. */
    isInstalled: () => boolean;
    /** Open the native prompt or browser instructions. */
    open: () => void;
}>();

/** Capture installation availability once for the lifetime of the site shell. */
export function InstallProvider(props: { children: JSX.Element }) {
    const [isInstalled, setInstalled] = createSignal(true);
    const [isOpen, setOpen] = createSignal(false);
    const [instructions, setInstructions] = createSignal("");
    const [error, setError] = createSignal<string>();
    let prompt: InstallPrompt | undefined;

    // observe the browser's installation state without persisting guesses
    onMount(() => {
        const standalone = window.matchMedia("(display-mode: standalone)");
        const navigator = window.navigator as Navigator & { standalone?: boolean };
        const update = () => setInstalled(standalone.matches || navigator.standalone === true);
        const capture = (event: Event) => {
            event.preventDefault();
            prompt = event as InstallPrompt;
        };
        const installed = () => {
            prompt = undefined;
            setInstalled(true);
            setOpen(false);
        };

        // provide platform-specific manual installation when no native prompt is available
        const isAppleMobile =
            /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        const isSafari =
            /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent);
        setInstructions(
            isAppleMobile
                ? "In Safari, tap Share, then Add to Home Screen. Enable Open as Web App if shown, then tap Add."
                : isSafari
                  ? "In Safari, choose File → Add to Dock."
                  : "In Chrome or Edge, open the browser menu and choose Install zurich.tech or Install this page as an app.",
        );
        update();
        window.addEventListener("beforeinstallprompt", capture);
        window.addEventListener("appinstalled", installed);
        standalone.addEventListener("change", update);
        onCleanup(() => {
            window.removeEventListener("beforeinstallprompt", capture);
            window.removeEventListener("appinstalled", installed);
            standalone.removeEventListener("change", update);
        });
    });

    /** Consume the browser prompt directly within the user's click gesture. */
    function open() {
        setError(undefined);
        if (prompt) {
            const current = prompt;
            prompt = undefined;
            void current.prompt().catch((caught: unknown) => {
                console.error("could not open installation prompt", caught);
                setError("Could not open the install prompt. Try your browser menu instead.");
                setOpen(true);
            });
        } else {
            setOpen(true);
        }
    }

    return (
        <InstallContext.Provider value={{ isInstalled, open }}>
            {props.children}
            <Dialog
                isOpen={isOpen()}
                title="Install zurich.tech"
                onClose={() => setOpen(false)}
                actions={
                    <Button kind="ghost" type="button" onClick={() => setOpen(false)}>
                        Done
                    </Button>
                }
            >
                <Show when={error()}>
                    <p role="alert">{error()}</p>
                </Show>
                <p>{instructions()}</p>
            </Dialog>
        </InstallContext.Provider>
    );
}

/** Show an installation action outside the installed app. */
export function InstallButton() {
    const install = useContext(InstallContext);
    if (!install) throw new Error("install provider is required");

    return (
        <Show when={!install.isInstalled()}>
            <Button kind="ghost" type="button" onClick={install.open}>
                <Download size={16} aria-hidden="true" />
                Install zurich.tech
            </Button>
        </Show>
    );
}
