import { createMemo, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
    CalendarDays,
    Layers,
    Newspaper,
    Building2,
    BriefcaseBusiness,
    Handshake,
    Users,
    Mail,
    ChartNoAxesCombined,
    Tags,
    ShieldCheck,
    ChevronDown,
} from "lucide-solid";

/** Group operational destinations without changing their access rules. */
const groups = [
    { label: "Programme", sections: ["events", "series", "news"] },
    { label: "Directory", sections: ["organisations", "jobs", "sponsors", "topics"] },
    { label: "People & outreach", sections: ["audience", "email", "traffic", "people"] },
];

/** Give each destination a recognisable navigation icon. */
const icons = {
    events: CalendarDays,
    series: Layers,
    news: Newspaper,
    organisations: Building2,
    jobs: BriefcaseBusiness,
    sponsors: Handshake,
    audience: Users,
    email: Mail,
    traffic: ChartNoAxesCombined,
    topics: Tags,
    people: ShieldCheck,
};

/** One supported workspace destination. */
export type AdminSection = keyof typeof icons;

/** Labels shared by desktop and mobile navigation. */
const labels: Record<AdminSection, string> = {
    events: "Events",
    series: "Series",
    news: "News",
    organisations: "Organisations",
    jobs: "Jobs",
    sponsors: "Sponsors",
    audience: "Audience",
    email: "Email",
    traffic: "Traffic",
    topics: "Topics",
    people: "Access",
};

/** Select only destinations available to the current authenticated workspace. */
export function adminSections(
    access:
        | {
              /** Whether any workspace access is assigned. */
              canManage: boolean;
              /** Full administrative access. */
              isAdmin: boolean;
              /** Shared content editing access. */
              isTeam?: boolean;
              /** Explicit event and series assignments. */
              grants: readonly { scope: { kind: string } }[];
          }
        | null
        | undefined,
) {
    if (!access?.canManage) return [];

    // keep the same ordering in both navigation controls
    const isTeam = access.isAdmin || access.isTeam;
    const sections: AdminSection[] = ["events"];
    if (isTeam || access.grants.some((grant) => grant.scope.kind === "series"))
        sections.push("series");
    if (isTeam) sections.push("news", "organisations");
    if (access.isAdmin) sections.push("jobs", "sponsors");
    if (isTeam) sections.push("topics");
    if (access.isAdmin) sections.push("audience", "email", "traffic", "people");

    return sections.map((id) => ({ id, label: labels[id], href: adminHref(id) }));
}

/** Start a workspace without retaining another panel's record or filter parameters. */
export function adminHref(section: AdminSection) {
    return section === "events" ? "/admin" : `/admin?section=${section}`;
}

/** Keep desktop navigation persistent and expose the same destinations on small screens. */
export function AdminNavigation(props: {
    options: ReturnType<typeof adminSections>;
    value: string;
    onChange: (href: string) => void;
}) {
    // resolve each visible group once for both layouts
    const visibleGroups = createMemo(() =>
        groups
            .map((group) => ({
                label: group.label,
                options: props.options.filter((option) => group.sections.includes(option.id)),
            }))
            .filter((group) => group.options.length),
    );
    const selected = () => props.options.find((option) => option.id === props.value);

    return (
        <aside class="admin-sidebar">
            <h1>Admin</h1>
            <Show when={props.options.length}>
                <label class="admin-mobile-navigation">
                    <span class="sr-only">Admin section</span>
                    <select
                        value={selected()?.href ?? ""}
                        onChange={(event) => props.onChange(event.currentTarget.value)}
                    >
                        <option value="" disabled selected={!selected()}>
                            Choose a section
                        </option>
                        <For each={visibleGroups()}>
                            {(group) => (
                                <optgroup label={group.label}>
                                    <For each={group.options}>
                                        {(option) => (
                                            <option
                                                value={option.href}
                                                selected={props.value === option.id}
                                            >
                                                {option.label}
                                            </option>
                                        )}
                                    </For>
                                </optgroup>
                            )}
                        </For>
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                </label>
                <nav class="admin-destinations" aria-label="Admin sections">
                    <For each={visibleGroups()}>
                        {(group) => (
                            <div class="admin-nav-group">
                                <p>{group.label}</p>
                                <For each={group.options}>
                                    {(option) => (
                                        <a
                                            href={option.href}
                                            aria-current={
                                                props.value === option.id ? "page" : undefined
                                            }
                                        >
                                            <Dynamic
                                                component={icons[option.id]}
                                                size={18}
                                                aria-hidden="true"
                                            />
                                            {option.label}
                                        </a>
                                    )}
                                </For>
                            </div>
                        )}
                    </For>
                </nav>
            </Show>
        </aside>
    );
}
