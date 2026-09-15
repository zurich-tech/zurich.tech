import { locationsLabel } from "./format";
import { type JSX, Show } from "solid-js";
import type { Job } from "./queries";
import { Card } from "../components/card";
import { ItemHeader } from "../app/page";
import { Markdown } from "../components/markdown";
import { Image } from "../components/image";
import { workplaces, seniorities } from "./filters";
import { applicationHref } from "./format";
import { JobTags } from "./tags";

/** Use the public vacancy layout for both reading and editorial preview. */
export function JobDetails(props: { job: Job; isPreview?: boolean; actions?: JSX.Element }) {
    const item = () => props.job;

    return (
        <>
            <ItemHeader
                title={item().title}
                actions={props.actions}
                summary={
                    <>
                        <a href={`/organisations/${item().company.slug}`}>{item().company.name}</a>
                        {` · ${locationsLabel(item().locations) || workplaces[item().workplace]}`}
                    </>
                }
            >
                <JobTags job={item()} />
            </ItemHeader>
            <div class="listing-layout">
                <Card title="About">
                    <p>{item().summary}</p>
                    <Markdown source={item().description} />
                </Card>
                <aside class="listing-sidebar">
                    <Show
                        when={
                            item().duration ||
                            item().seniority ||
                            item().remoteEligibility ||
                            item().languages.length ||
                            item().visaSponsorship !== undefined ||
                            item().applicationDeadline
                        }
                    >
                        <Card title="Details">
                            <Show when={item().duration}>
                                {(duration) => {
                                    const value = duration();
                                    return (
                                        <p>
                                            {value.kind === "permanent"
                                                ? "Permanent"
                                                : `Fixed term${value.months ? ` · ${value.months} months` : ""}`}
                                        </p>
                                    );
                                }}
                            </Show>
                            <Show when={item().seniority}>
                                <p>{seniorities[item().seniority!]}</p>
                            </Show>
                            <Show when={item().remoteEligibility}>
                                <p>Remote: {item().remoteEligibility}</p>
                            </Show>
                            <Show when={item().languages.length}>
                                <p>Languages: {item().languages.join(", ")}</p>
                            </Show>
                            <Show when={item().visaSponsorship !== undefined}>
                                <p>
                                    Visa sponsorship{" "}
                                    {item().visaSponsorship ? "available" : "unavailable"}
                                </p>
                            </Show>
                            <Show when={item().applicationDeadline}>
                                <p>
                                    Apply by{" "}
                                    {new Date(item().applicationDeadline!).toLocaleDateString(
                                        "en-GB",
                                        {
                                            timeZone: "Europe/Zurich",
                                        },
                                    )}
                                </p>
                            </Show>
                        </Card>
                    </Show>
                    <Card title="Apply">
                        <Show
                            when={item().isOpen || props.isPreview}
                            fallback={<p>This listing is no longer accepting applications.</p>}
                        >
                            <a
                                class="button button--primary"
                                href={applicationHref(item().application)}
                                target={item().application.kind === "url" ? "_blank" : undefined}
                                rel="noreferrer"
                            >
                                {item().application.kind === "email"
                                    ? "Apply by email"
                                    : "Apply on company site ↗"}
                            </a>
                        </Show>
                    </Card>
                    <Card title="Company">
                        <a class="company-identity" href={`/organisations/${item().company.slug}`}>
                            <strong>{item().company.name}</strong>
                            <Show when={item().company.logoUrl}>
                                <Image
                                    class="company-image"
                                    src={item().company.logoUrl}
                                    darkSrc={item().company.logoDarkUrl}
                                    alt={item().company.name}
                                />
                            </Show>
                        </a>
                        <Show when={item().company.description}>
                            <Markdown source={item().company.description} />
                        </Show>
                        <a
                            class="text-link"
                            href={item().company.website}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Company website ↗
                        </a>
                    </Card>
                </aside>
            </div>
        </>
    );
}
