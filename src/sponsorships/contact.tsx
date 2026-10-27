import { createEffect, createSignal, Show } from "solid-js";
import { Copy, Mail } from "lucide-solid";
import { Dialog } from "../components/dialog";
import { site } from "../app/site";
import { sponsorshipInquiry } from "./inquiries";

/** Present a sponsorship contact with an email-app-independent copy action. */
export function SponsorshipContact(props: {
    isOpen: boolean;
    tier?: string;
    name?: string;
    onClose: () => void;
}) {
    const [message, setMessage] = createSignal("");

    // clear feedback for each new inquiry
    createEffect(() => {
        if (props.isOpen) setMessage("");
    });

    /** Copy the address or explain how to select it manually. */
    async function copy() {
        try {
            await navigator.clipboard.writeText(site.email);
            setMessage("Email address copied.");
        } catch {
            setMessage("Could not copy. Select the email address above to copy it manually.");
        }
    }

    return (
        <Dialog
            isOpen={props.isOpen}
            title={props.tier ? `${props.tier} sponsorship` : "Sponsor zurich.tech"}
            onClose={props.onClose}
            actions={
                <>
                    <button type="button" class="button" onClick={props.onClose}>
                        Close
                    </button>
                    <a
                        class="button button--primary"
                        href={sponsorshipInquiry(props.tier, props.name)}
                    >
                        <Mail size={16} /> Open email app
                    </a>
                </>
            }
        >
            <p>
                Email us{props.tier ? ` about the ${props.tier} plan` : " about sponsorship"} and
                we'll arrange the details and invoice.
            </p>
            <div class="sponsorship-contact">
                <a href={`mailto:${site.email}`}>{site.email}</a>
                <button
                    type="button"
                    class="icon-button"
                    aria-label="Copy email address"
                    title="Copy email address"
                    onClick={copy}
                >
                    <Copy size={18} />
                </button>
            </div>
            <Show when={message()}>
                <p role="status" class="text-soft">
                    {message()}
                </p>
            </Show>
        </Dialog>
    );
}
