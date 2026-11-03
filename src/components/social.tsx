import "./social.css";
import { For, Show } from "solid-js";
import { Mail } from "lucide-solid";
import linkedin from "./assets/social/linkedin.svg?raw";
import github from "./assets/social/github.svg?raw";
import x from "./assets/social/x.svg?raw";
import discord from "./assets/social/discord.svg?raw";
import website from "./assets/social/website.svg?raw";
import scholar from "./assets/social/scholar.svg?raw";
import bluesky from "./assets/social/bluesky.svg?raw";
import orcid from "./assets/social/orcid.svg?raw";

/** Recognised profile destinations and their accessible labels. */
const platforms = [
    { id: "linkedin", label: "LinkedIn", icon: linkedin },
    { id: "github", label: "GitHub", icon: github },
    { id: "x", label: "Twitter", icon: x },
    { id: "discord", label: "Discord", icon: discord },
    { id: "website", label: "Website", icon: website },
] as const;

/** Additional public link destinations, using Simple Icons (CC0). */
const linkPlatforms = [
    { hostname: "scholar.google.com", label: "Google Scholar", icon: scholar },
    { hostname: "bsky.app", label: "Bluesky", icon: bluesky },
    { hostname: "orcid.org", label: "ORCID", icon: orcid },
    { hostname: "discord.com", label: "Discord", icon: discord },
    { hostname: "discord.gg", label: "Discord", icon: discord },
] as const;

/** Verified public profiles, omitting platforms without a known account. */
export type SocialProfiles = Partial<Record<(typeof platforms)[number]["id"], string>>;

/** Link to verified profiles with compact, labelled icons. */
export function SocialLinks(props: {
    /** Public contact address, when provided. */ email?: string;
    /** Show platform names alongside the icons. */ labelled?: boolean;
    /** Profile owner's name. */ name: string;
    /** Named social accounts or an ordered list of public links. */ profiles:
        SocialProfiles | string[];
}) {
    // share the same icons across team, sponsor and speaker profiles
    const destinations = () => {
        if (!Array.isArray(props.profiles)) {
            const profiles = props.profiles;

            return platforms.flatMap((platform) =>
                profiles[platform.id] ? [{ ...platform, url: profiles[platform.id]! }] : [],
            );
        }

        // retain every supplied destination, including additional personal websites
        return props.profiles.map((url) => {
            const hostname = new URL(url).hostname.replace(/^www\./, "");
            const destination = linkPlatforms.find((platform) => platform.hostname === hostname);

            // recognise services beyond the editable account fields
            if (destination) return { ...destination, url };

            const id =
                hostname === "github.com"
                    ? "github"
                    : hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")
                      ? "linkedin"
                      : hostname === "x.com" || hostname === "twitter.com"
                        ? "x"
                        : "website";
            const platform = platforms.find((platform) => platform.id === id)!;

            return { ...platform, url, label: id === "website" ? hostname : platform.label };
        });
    };

    return (
        <div class="social-links" classList={{ "social-links--labelled": props.labelled }}>
            <For each={destinations()}>
                {(destination) => (
                    <a
                        href={destination.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${props.name} on ${destination.label}`}
                        title={destination.label}
                    >
                        <span aria-hidden="true" innerHTML={destination.icon} />
                        <Show when={props.labelled}>
                            <span class="social-label">{destination.label}</span>
                        </Show>
                    </a>
                )}
            </For>
            <Show when={props.email}>
                {(email) => (
                    <a href={`mailto:${email()}`} aria-label={`Email ${props.name}`} title="Email">
                        <Mail aria-hidden="true" />
                        <Show when={props.labelled}>
                            <span class="social-label">Email</span>
                        </Show>
                    </a>
                )}
            </Show>
        </div>
    );
}

/** Edit the chosen destination and social accounts using shared field names. */
export function ProfileLinkFields(props: { profileUrl?: string; socials?: SocialProfiles }) {
    return (
        <div class="form-columns">
            <label>
                Profile link
                <input
                    name="profileUrl"
                    type="url"
                    placeholder="https://…"
                    value={props.profileUrl ?? ""}
                />
            </label>
            <For
                each={platforms.filter(
                    (platform) => platform.id !== "website" && platform.id !== "discord",
                )}
            >
                {(platform) => (
                    <label>
                        {platform.label}
                        <input
                            name={platform.id}
                            type="url"
                            value={props.socials?.[platform.id] ?? ""}
                        />
                    </label>
                )}
            </For>
        </div>
    );
}
