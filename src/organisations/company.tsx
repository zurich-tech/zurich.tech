import { createSignal, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { memberClient } from "../auth/convex";
import { ProfileLinkFields, type SocialProfiles } from "../components/social";
import { Card } from "../components/card";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

/** Edit the public company identity shared by jobs and sponsorships. */
export function CompanyForm(props: {
    /** Existing editable company, absent when creating a company. */
    item?: {
        _id: Id<"organisations">;
        name: string;
        headline?: string;
        slug: string;
        website: string;
        logoUrl?: string;
        logoDarkUrl?: string;
        mapLogoUrl?: string;
        mapLogoDarkUrl?: string;
        profileUrl?: string;
        socials?: SocialProfiles;
        location: string;
        description: string;
    };
    /** Allow team members to assign company ownership. */
    isTeam?: boolean;
    /** Refresh company records after a successful save. */
    onSave: () => unknown;
}) {
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Save the company profile and any team-authorized ownership assignment. */
    async function submit(event: SubmitEvent) {
        // read the profile fields and optional ownership assignment
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const fields = new FormData(form);
        const text = (key: string) => String(fields.get(key) ?? "").trim();
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            await (
                await memberClient()
            ).mutation(api.organisations.mutations.upsertCompany, {
                id: props.item?._id,
                ownerEmail: props.isTeam ? text("ownerEmail") || undefined : undefined,
                name: text("name"),
                headline: text("headline") || undefined,
                slug: text("slug"),
                website: text("website"),
                logoUrl: text("logoUrl") || undefined,
                logoDarkUrl: text("logoDarkUrl") || undefined,
                mapLogoUrl: text("mapLogoUrl") || undefined,
                mapLogoDarkUrl: text("mapLogoDarkUrl") || undefined,
                profileUrl: text("profileUrl") || undefined,
                socials: {
                    linkedin: text("linkedin") || undefined,
                    github: text("github") || undefined,
                    x: text("x") || undefined,
                },
                location: text("location"),
                description: text("description"),
            });
            await props.onSave();
            if (!props.item) form.reset();
            setSuccess("Company saved.");
        } catch (caught) {
            setError(errorMessage(caught, "Could not save company."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Card title={props.item ? "Company profile" : "Add a company"}>
            <form class="editor" onSubmit={submit}>
                <label>
                    Headline
                    <input
                        name="headline"
                        maxlength="160"
                        placeholder="Company, non-profit, research lab…"
                        value={props.item?.headline ?? ""}
                    />
                </label>
                <div class="form-columns">
                    <label>
                        Name
                        <input
                            name="name"
                            required
                            maxlength="160"
                            value={props.item?.name ?? ""}
                        />
                    </label>
                    <label>
                        URL slug
                        <input
                            name="slug"
                            required
                            pattern="[a-z0-9]+(-[a-z0-9]+)*"
                            value={props.item?.slug ?? ""}
                        />
                    </label>
                </div>
                <div class="form-columns">
                    <label>
                        Website
                        <input
                            name="website"
                            type="url"
                            required
                            value={props.item?.website ?? ""}
                        />
                    </label>
                    <label>
                        Logo URL
                        <input name="logoUrl" value={props.item?.logoUrl ?? ""} />
                    </label>
                    <label>
                        Dark logo URL
                        <input name="logoDarkUrl" value={props.item?.logoDarkUrl ?? ""} />
                    </label>
                </div>
                <div class="form-columns">
                    <label>
                        Map symbol URL
                        <input name="mapLogoUrl" value={props.item?.mapLogoUrl ?? ""} />
                    </label>
                    <label>
                        Dark map symbol URL
                        <input name="mapLogoDarkUrl" value={props.item?.mapLogoDarkUrl ?? ""} />
                    </label>
                </div>
                <ProfileLinkFields
                    profileUrl={props.item?.profileUrl}
                    socials={props.item?.socials}
                />
                <label>
                    Location
                    <input name="location" required value={props.item?.location ?? "Zürich"} />
                </label>
                <label>
                    Description
                    <textarea
                        name="description"
                        maxlength="5000"
                        rows="3"
                        value={props.item?.description ?? ""}
                    />
                </label>
                <Show when={props.isTeam}>
                    <label>
                        Assign owner by email
                        <input
                            name="ownerEmail"
                            type="email"
                            placeholder="Leave blank to keep the current owner"
                        />
                    </label>
                </Show>
                <button class="button" disabled={isPending()}>
                    {isPending() ? "Saving…" : "Save company"}
                </button>
                <FormMessage error={error()} success={success()} />
            </form>
        </Card>
    );
}

/** Select a company the current account is allowed to manage. */
export function CompanySelect(props: {
    /** Companies the account can manage. */
    companies: { _id: string; name: string }[];
    /** Selected company identity. */
    value?: string;
    /** Prevent changing the company of a published vacancy. */
    isDisabled?: boolean;
}) {
    return (
        <label>
            Company
            <select
                name="organisationId"
                required
                disabled={props.isDisabled}
                value={props.value ?? ""}
            >
                <option value="" disabled>
                    Select a company
                </option>
                <For each={props.companies}>
                    {(item) => <option value={item._id}>{item.name}</option>}
                </For>
            </select>
        </label>
    );
}
