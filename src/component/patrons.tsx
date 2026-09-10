import { api } from "../../convex/_generated/api";
import { memberClient } from "../core/convex";
import { errorMessage } from "../core/error";
import { CheckoutButton } from "./payments";
import { Card } from "./card";
import { getPatrons } from "../core/queries";
import { createAsync } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";

import { Dynamic } from "solid-js/web";
import { SocialLinks } from "./social";
import { Avatar } from "./avatar";

/** Show opted in patrons as compact profile badges. */
export function Patrons() {
    const patrons = createAsync(() => getPatrons());

    return (
        <Show when={patrons()?.length}>
            <div class="patron-wall" aria-label="Our patrons">
                <For each={patrons()}>
                    {(patron) => (
                        <div class="patron-recognition">
                            <Dynamic
                                component={patron.profileUrl ? "a" : "span"}
                                href={patron.profileUrl}
                                target={patron.profileUrl ? "_blank" : undefined}
                                rel={patron.profileUrl ? "noreferrer" : undefined}
                                class="patron-badge"
                                tabindex="0"
                                aria-label={`${patron.name}, Patron`}
                                title={patron.name}
                            >
                                <Avatar
                                    name={patron.name}
                                    image={patron.avatarUrl}
                                    imageDark={patron.avatarDarkUrl}
                                />
                                <span class="patron-name">{patron.name}</span>
                            </Dynamic>
                            <SocialLinks name={patron.name} profiles={patron.socials ?? {}} />
                        </div>
                    )}
                </For>
            </div>
        </Show>
    );
}

/** Let a signed in patron control public recognition. */
export function PatronSettings() {
    // load paid coverage and the member’s recognition preference
    const [patron, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.patrons.current, {}),
    );
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Save the member's explicit visibility choice. */
    async function change(isPublic: boolean) {
        setIsPending(true);
        setError(undefined);
        try {
            await (await memberClient()).mutation(api.patrons.setVisibility, { isPublic });
            await refetch();
        } catch (caught) {
            setError(errorMessage(caught, "Could not save patron visibility."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Show when={patron.error}>
                <p class="form-error">
                    {errorMessage(patron.error, "Could not load your patron membership.")}
                </p>
            </Show>
            <Show when={patron()}>
                {(current) => (
                    <Card
                        title="Patron"
                        toolbar={<CheckoutButton purchase={{ kind: "patron" }} label="Renew" />}
                    >
                        <p>
                            {current().endsAt > Date.now()
                                ? "Thank you for supporting zurich.tech."
                                : "Your patron membership has ended."}
                        </p>
                        <label>
                            <input
                                type="checkbox"
                                checked={current().isPublic}
                                disabled={isPending()}
                                onChange={(event) => change(event.currentTarget.checked)}
                            />{" "}
                            Show my name and avatar on the sponsor wall
                        </label>
                        <Show when={error()}>
                            <p class="form-error">{error()}</p>
                        </Show>
                    </Card>
                )}
            </Show>
        </>
    );
}
