import { createMemo, createResource, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { publicClient } from "../auth/convex";
import { Image } from "../components/image";
import { errorMessage } from "../components/errors";
import { getSponsors } from "../sponsorships/queries";
import { tiers } from "../../convex/sponsorships/plans";
import { EventTags } from "./tags";
import discord from "../components/assets/social/discord.svg?raw";
import linkedin from "../components/assets/social/linkedin.svg?raw";
import twitter from "../components/assets/social/x.svg?raw";

/** Public community shortcuts shown on the event overview screen. */
const communityLinks = [
    { path: "discord", icon: discord },
    { path: "linkedin", icon: linkedin },
    { path: "twitter", icon: twitter },
];

/** Present the published programme and current community sponsors. */
export function Overview(props: { slug: string }) {
    const [event] = createResource(
        () => props.slug,
        (slug) => publicClient().query(api.events.queries.event, { slug }),
    );
    const sponsors = getSponsors.use(() => []);
    const programme = createMemo(() => {
        const item = event();
        if (!item) return [];
        const speakers = new Map(item.speakers.map((speaker) => [speaker.id, speaker]));
        const assigned = new Set(item.agenda.flatMap((session) => session.speakerIds));
        const sessions = item.agenda.map((session) => ({
            ...session,
            speakers: session.speakerIds.map((id) => {
                const speaker = speakers.get(id);
                if (!speaker) throw new Error("programme speaker is missing");
                return speaker;
            }),
        }));

        return [
            ...sessions,
            ...item.speakers
                .filter((speaker) => !assigned.has(speaker.id))
                .map((speaker) => ({
                    title: "",
                    time: "",
                    speakerIds: [speaker.id],
                    speakers: [speaker],
                })),
        ];
    });

    return (
        <Show
            when={!event.error}
            fallback={<p role="alert">{errorMessage(event.error, "Could not load the event.")}</p>}
        >
            <Show
                when={event()}
                fallback={
                    <p class="projection-notice">
                        {event.loading ? "Loading event…" : "Event not found."}
                    </p>
                }
            >
                {(item) => (
                    <section class="projection-overview">
                        <header class="projection-overview-heading">
                            <div>
                                <h1>{item().title}</h1>
                                <EventTags detailed topics={item().topics} />
                            </div>
                            <div class="projection-logistics">
                                <p>
                                    {new Intl.DateTimeFormat("en-CH", {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                        timeZone: "Europe/Zurich",
                                    }).format(item().startsAt)}
                                </p>
                                <Show when={item().location}>
                                    <p>{item().location}</p>
                                </Show>
                            </div>
                        </header>
                        <div class="projection-programme">
                            <div class="projection-speakers">
                                <For each={programme()}>
                                    {(session) => (
                                        <article class="projection-talk">
                                            <Show when={session.time}>
                                                <time class="projection-talk-time">
                                                    {session.time}
                                                </time>
                                            </Show>
                                            <div>
                                                <Show when={session.title}>
                                                    <h2 class="projection-talk-title">
                                                        {session.title}
                                                    </h2>
                                                </Show>
                                            </div>
                                            <div class="projection-talk-people">
                                                <For each={session.speakers}>
                                                    {(speaker) => (
                                                        <div class="projection-speaker">
                                                            <Show when={speaker.imageUrl}>
                                                                <Image
                                                                    class="projection-portrait"
                                                                    src={speaker.imageUrl}
                                                                    darkSrc={speaker.imageDarkUrl}
                                                                    alt={speaker.name}
                                                                    width={112}
                                                                    height={112}
                                                                />
                                                            </Show>
                                                            <div>
                                                                <p class="projection-speaker-name">
                                                                    {speaker.name}
                                                                </p>
                                                                <Show
                                                                    when={
                                                                        speaker.affiliations?.length
                                                                    }
                                                                >
                                                                    <p>
                                                                        {speaker
                                                                            .affiliations!.map(
                                                                                (affiliation) =>
                                                                                    [
                                                                                        affiliation.role,
                                                                                        affiliation.organisation,
                                                                                    ]
                                                                                        .filter(
                                                                                            Boolean,
                                                                                        )
                                                                                        .join(
                                                                                            " · ",
                                                                                        ),
                                                                            )
                                                                            .join(", ")}
                                                                    </p>
                                                                </Show>
                                                            </div>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </article>
                                    )}
                                </For>
                            </div>
                        </div>
                        <aside class="projection-sidebar">
                            <Show when={sponsors()?.length}>
                                <section class="projection-sponsors">
                                    <h2>Sponsors</h2>
                                    <div class="projection-tiers">
                                        <For
                                            each={tiers.filter((tier) =>
                                                sponsors()?.some(
                                                    (sponsor) => sponsor.tier === tier.id,
                                                ),
                                            )}
                                        >
                                            {(tier) => (
                                                <div
                                                    style={{
                                                        "--logo-width": `${Math.max(180, tier.logoWidth * 1.4)}px`,
                                                    }}
                                                >
                                                    <div class="projection-logos">
                                                        <For
                                                            each={sponsors()?.filter(
                                                                (sponsor) =>
                                                                    sponsor.tier === tier.id,
                                                            )}
                                                        >
                                                            {(sponsor) => (
                                                                <a href={sponsor.website}>
                                                                    <Show
                                                                        when={sponsor.logoUrl}
                                                                        fallback={sponsor.name}
                                                                    >
                                                                        <Image
                                                                            src={sponsor.logoUrl}
                                                                            darkSrc={
                                                                                sponsor.logoDarkUrl
                                                                            }
                                                                            alt={sponsor.name}
                                                                        />
                                                                    </Show>
                                                                </a>
                                                            )}
                                                        </For>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </section>
                            </Show>
                            <nav class="projection-community" aria-label="Community">
                                <h2>Community</h2>
                                <For each={communityLinks}>
                                    {(link) => (
                                        <a href={`/${link.path}`}>
                                            <span aria-hidden="true" innerHTML={link.icon} />
                                            zurich.tech/{link.path}
                                        </a>
                                    )}
                                </For>
                            </nav>
                        </aside>
                    </section>
                )}
            </Show>
        </Show>
    );
}
