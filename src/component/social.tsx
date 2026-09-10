import { For, Show } from "solid-js";
import linkedin from "../assets/social/linkedin.svg?raw";
import github from "../assets/social/github.svg?raw";
import x from "../assets/social/x.svg?raw";
import website from "../assets/social/website.svg?raw";

/** Recognised profile destinations and their accessible labels. */
const platforms = [
    { id: "linkedin", label: "LinkedIn", icon: linkedin },
    { id: "github", label: "GitHub", icon: github },
    { id: "x", label: "X / Twitter", icon: x },
    { id: "website", label: "Website", icon: website },
] as const;

/** Verified public profiles, omitting platforms without a known account. */
export type SocialProfiles = Partial<Record<(typeof platforms)[number]["id"], string>>;

/** Link to a person's verified profiles with compact, labelled icons. */
export function SocialLinks(props: {
    /** Profile owner's name. */ name: string;
    /** Available social accounts and personal website. */ profiles: SocialProfiles;
}) {
    return (
        <div class="social-links">
            <For each={platforms}>
                {(platform) => (
                    <Show when={props.profiles[platform.id]}>
                        {(url) => (
                            <a
                                href={url()}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`${props.name} on ${platform.label}`}
                                title={platform.label}
                            >
                                <span aria-hidden="true" innerHTML={platform.icon} />
                            </a>
                        )}
                    </Show>
                )}
            </For>
        </div>
    );
}
