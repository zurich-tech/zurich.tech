import { Select } from "../components/field";
import { MarkdownEditor } from "../components/markdown-editor";
import { organisationKinds, type OrganisationKind } from "../../convex/organisations/kinds";
import { createSignal, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { memberClient } from "../auth/convex";
import { ProfileLinkFields, type SocialProfiles } from "../components/social";
import { resetEditor, savedEditor, Editor, FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

/** Edit the public company identity shared by jobs and sponsorships. */
export function CompanyForm(props: {
    /** Existing editable company, absent when creating a company. */
    item?: {
        _id: Id<"organisations">;
        ownerId?: Id<"members">;
        name: string;
        kind: OrganisationKind;
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
    isAdmin?: boolean;
    owners?: { memberId: Id<"members">; name: string; email?: string }[];
    /** Refresh company records after a successful save. */
    onSave: () => unknown;
    isPending: boolean;
    setIsPending: (value: boolean) => void;
}) {
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    const isPending = () => props.isPending;
    const setIsPending = props.setIsPending;

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
                ownerEmail: props.isAdmin ? text("ownerEmail") || undefined : undefined,
                name: text("name"),
                kind: text("kind") as OrganisationKind,
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
            savedEditor(form);
            await props.onSave();
            if (!props.item) {
                form.reset();
                resetEditor(form);
            }
            setSuccess("Organisation saved.");
        } catch (caught) {
            setError(errorMessage(caught, "Could not save organisation."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Editor
                id="organisation-editor"
                class="editor"
                onSubmit={submit}
                actions={() => (
                    <div class="form-actions">
                        <button class="button button--primary" disabled={isPending()}>
                            {isPending() ? "Saving…" : "Save"}
                        </button>
                    </div>
                )}
            >
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
                        Slug
                        <input
                            name="slug"
                            required
                            pattern="[a-z0-9]+(-[a-z0-9]+)*"
                            value={props.item?.slug ?? ""}
                        />
                    </label>
                </div>
                <label>
                    Category
                    <Select name="kind" value={props.item?.kind ?? "company"}>
                        <For each={Object.entries(organisationKinds)}>
                            {([value, label]) => <option value={value}>{label}</option>}
                        </For>
                    </Select>
                </label>
                <div class="form-columns">
                    <label>
                        Headline
                        <input
                            name="headline"
                            maxlength="160"
                            placeholder="A short introduction"
                            value={props.item?.headline ?? ""}
                        />
                    </label>
                    <label>
                        Website
                        <input
                            name="website"
                            type="url"
                            required
                            value={props.item?.website ?? ""}
                        />
                    </label>
                </div>
                <div class="form-columns">
                    <label>
                        Logo · light
                        <input name="logoUrl" value={props.item?.logoUrl ?? ""} />
                    </label>
                    <label>
                        Logo · dark
                        <input name="logoDarkUrl" value={props.item?.logoDarkUrl ?? ""} />
                    </label>
                </div>
                <div class="form-columns">
                    <label>
                        Map symbol · light
                        <input name="mapLogoUrl" value={props.item?.mapLogoUrl ?? ""} />
                    </label>
                    <label>
                        Map symbol · dark
                        <input name="mapLogoDarkUrl" value={props.item?.mapLogoDarkUrl ?? ""} />
                    </label>
                </div>
                <ProfileLinkFields
                    profileUrl={props.item?.profileUrl}
                    socials={props.item?.socials}
                />
                <label>
                    Location
                    <input name="location" required value={props.item?.location ?? "Zurich"} />
                </label>
                <MarkdownEditor
                    label="About"
                    name="description"
                    maxLength={5000}
                    rows={6}
                    value={props.item?.description ?? ""}
                />
                <Show when={props.isAdmin}>
                    <label>
                        Owner <span>Can manage this organisation and its jobs</span>
                        <input
                            name="ownerEmail"
                            type="email"
                            list="organisation-owners"
                            value={
                                props.owners?.find(
                                    (owner) => owner.memberId === props.item?.ownerId,
                                )?.email ?? ""
                            }
                            placeholder="Search by name or verified email"
                        />
                        <datalist id="organisation-owners">
                            <For each={props.owners?.filter((owner) => owner.email)}>
                                {(owner) => <option value={owner.email}>{owner.name}</option>}
                            </For>
                        </datalist>
                    </label>
                </Show>

                <FormMessage error={error()} success={success()} />
            </Editor>
        </>
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
            <Select
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
            </Select>
        </label>
    );
}
