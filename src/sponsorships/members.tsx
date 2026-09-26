import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { errorMessage } from "../components/errors";
import { personalTiers } from "./plans";
import { getPersonalSponsors } from "./queries";
import { startTransition, createResource, createSignal, For, Show } from "solid-js";

import { Dynamic } from "solid-js/web";
import { Avatar } from "../components/avatar";
import "./sponsors.css";

/** Show opted-in personal sponsors, ordered by their support level. */
export function PersonalSponsors() {
    const sponsors = getPersonalSponsors.use(() => []);
    return (
        <For each={[...personalTiers].reverse()}>
            {(tier) => (
                <Show when={sponsors()?.some((sponsor) => sponsor.tier === tier.id)}>
                    <section class="sponsor-tier">
                        <h3>{tier.name}</h3>
                        <div class="patron-wall">
                            <For each={sponsors()?.filter((sponsor) => sponsor.tier === tier.id)}>
                                {(sponsor) => (
                                    <Dynamic
                                        component={sponsor.profileUrl ? "a" : "span"}
                                        href={sponsor.profileUrl}
                                        target={sponsor.profileUrl ? "_blank" : undefined}
                                        rel={sponsor.profileUrl ? "noreferrer" : undefined}
                                        class="patron-badge"
                                        tabindex="0"
                                        style={{ "--support-avatar-size": `${tier.avatarSize}px` }}
                                        aria-label={`${sponsor.name}, ${tier.name}`}
                                    >
                                        <Avatar
                                            name={sponsor.name}
                                            image={sponsor.avatarUrl}
                                            imageDark={sponsor.avatarDarkUrl}
                                        />
                                        <span class="patron-name">
                                            {sponsor.name}
                                            <Show when={sponsor.headline}>
                                                {" "}
                                                — {sponsor.headline}
                                            </Show>
                                        </span>
                                    </Dynamic>
                                )}
                            </For>
                        </div>
                    </section>
                </Show>
            )}
        </For>
    );
}

/** Let a signed-in personal sponsor control public recognition. */
export function SupportSettings() {
    // load paid coverage and the member’s recognition preference
    const [membership, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.sponsorships.members.current, {}),
    );
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Save the member's explicit visibility choice. */
    async function change(isPublic: boolean) {
        setIsPending(true);
        setError(undefined);
        try {
            await (
                await memberClient()
            ).mutation(api.sponsorships.members.setVisibility, { isPublic });
            await startTransition(refetch);
        } catch (caught) {
            setError(errorMessage(caught, "Could not save sponsor visibility."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Show when={membership.error}>
                <p class="form-error">
                    {errorMessage(membership.error, "Could not load your support plan.")}
                </p>
            </Show>
            <Show when={!membership.error && membership()}>
                {(current) => (
                    <section class="billing-membership">
                        <div class="billing-heading">
                            <strong>
                                {personalTiers.find((tier) => tier.id === current().tier)?.name}
                            </strong>
                            <button class="button" disabled>
                                Renew
                            </button>
                        </div>
                        <p>{current().endsAt > Date.now() ? "Active" : "Expired"}</p>
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
                    </section>
                )}
            </Show>
        </>
    );
}
