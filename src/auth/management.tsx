import { TableToolbar } from "../components/toolbar";
import { createResource, createSignal, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "./convex";
import { Card } from "../components/card";
import { FormMessage, FormSection } from "../components/form";
import { useConfirmation } from "../components/dialog";
import { useWorkspaceCommand } from "../app/workspace";
import { Loading } from "../components/loading";
import type { Id } from "../../convex/_generated/dataModel";

type Scope = { kind: "event"; id: Id<"events"> } | { kind: "series"; id: Id<"series"> };
type Role = "editor" | "organiser";
const roles = {
    editor: "Prepare drafts.",
    organiser: "Edit, publish and manage attendees. Sending requires separate email permission.",
};

/** Assign a person either full administration or named events and series. */
export function AccessManager() {
    const confirm = useConfirmation();
    const [records, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.auth.management.list, {}),
    );
    const command = useWorkspaceCommand(refetch);
    const [selected, setSelected] = createSignal<Id<"accounts">>();
    const [search, setSearch] = createSignal("");
    const [target, setTarget] = createSignal("");
    const [role, setRole] = createSignal<Role>("editor");
    const person = () => records()?.people.find((p) => p.id === selected());
    const choices = () => [
        ...(records()?.series ?? []).map((item) => ({
            ...item,
            scope: { kind: "series", id: item.id } as Scope,
        })),
        ...(records()?.events ?? []).map((item) => ({
            ...item,
            scope: { kind: "event", id: item.id } as Scope,
        })),
    ];
    const title = (scope: Scope) =>
        choices().find((item) => item.id === scope.id)?.name ?? "Deleted record";
    const people = () =>
        records()?.people.filter((p) =>
            [p.name, ...p.emails].some((value) =>
                value.toLowerCase().includes(search().trim().toLowerCase()),
            ),
        );

    /** Confirm the exact authority before applying an assignment. */
    async function assign(scope: Scope, next: Role | null) {
        const account = person();
        if (!account) return;
        await command.perform(async () => {
            if (
                !(await confirm({
                    title: next ? "Save access" : "Remove access",
                    action: next ? "Save" : "Remove",
                    description: next
                        ? `${account.name} · ${title(scope)} · ${next === "editor" ? "Editor" : "Organiser"}`
                        : `Remove ${account.name}’s access to ${title(scope)}?`,
                    details: next ? roles[next] : "Access through other assignments still applies.",
                    isDestructive: next === null,
                }))
            )
                return false;
            await (
                await memberClient()
            ).mutation(api.auth.management.setGrant, { accountId: account.id, scope, role: next });
            setTarget("");
        }, "Access saved.");
    }

    /** Keep public team membership independent of administration. */
    async function administration(isAdmin: boolean) {
        const account = person();
        if (!account) return;
        await command.perform(async () => {
            if (
                !(await confirm({
                    title: isAdmin ? "Make administrator" : "Remove administrator access",
                    action: "Save",
                    description: isAdmin
                        ? `${account.name} will have full access to events, emails and settings.`
                        : `${account.name} will retain their team membership, email permission and event assignments.`,
                    isDestructive: !isAdmin,
                }))
            )
                return false;
            await (
                await memberClient()
            ).mutation(api.auth.management.setAdmin, { id: account.id, isAdmin });
        }, "Access saved.");
    }

    /** Confirm independent team and email permissions before saving them. */
    async function permission(key: "isTeam" | "isMailSender", isEnabled: boolean) {
        const account = person();
        if (!account) return;
        await command.perform(async () => {
            if (
                !(await confirm({
                    title: key === "isTeam" ? "Change team membership" : "Change email permission",
                    action: "Save",
                    description: `${account.name}: ${isEnabled ? "enable" : "disable"} ${key === "isTeam" ? "team membership and content management" : "event email sending"}.`,
                    details:
                        key === "isTeam"
                            ? "Team members appear on the team page and manage content. Attendee access and email sending remain separate."
                            : "Applies only to assigned events and series. Subscriber campaigns and sending limits remain administrator-only.",
                    isDestructive: !isEnabled,
                }))
            )
                return false;
            await (
                await memberClient()
            ).mutation(api.auth.management.setPermission, {
                id: account.id,
                permission: key,
                isEnabled,
            });
        }, "Access saved.");
    }

    return (
        <Card
            title={person()?.name ?? "Access"}
            class={!person() ? "admin-table-card" : undefined}
            toolbar={
                <Show when={person()}>
                    <button
                        class="action-link"
                        onClick={() => {
                            setSelected(undefined);
                            setTarget("");
                        }}
                    >
                        Back
                    </button>
                </Show>
            }
        >
            <FormMessage
                error={command.error() || (records.error ? "Could not load access." : undefined)}
                success={command.success()}
            />
            <Show when={records()} fallback={<Loading />}>
                <Show
                    when={person()}
                    fallback={
                        <>
                            <TableToolbar
                                value={search()}
                                onSearch={setSearch}
                                placeholder="Search name or email…"
                            />
                            <div class="table-scroll">
                                <table class="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Person</th>
                                            <th>Email</th>
                                            <th>Access</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For
                                            each={people()}
                                            fallback={
                                                <tr>
                                                    <td colspan="4">No people found.</td>
                                                </tr>
                                            }
                                        >
                                            {(p) => (
                                                <tr>
                                                    <td>{p.name}</td>
                                                    <td>
                                                        <For
                                                            each={p.emails}
                                                            fallback="No email recorded"
                                                        >
                                                            {(email) => <div>{email}</div>}
                                                        </For>
                                                    </td>
                                                    <td>
                                                        {p.isAdmin
                                                            ? "Administrator"
                                                            : p.grants.length
                                                              ? p.grants
                                                                    .map(
                                                                        (grant) =>
                                                                            `${grant.role === "editor" ? "Editor" : "Organiser"} · ${title(grant.scope)}`,
                                                                    )
                                                                    .join(", ")
                                                              : p.isTeam
                                                                ? "Team"
                                                                : "None"}
                                                        {p.isTeam && (p.isAdmin || p.grants.length)
                                                            ? " · Team"
                                                            : ""}
                                                        {!p.isAdmin && p.isMailSender
                                                            ? " · Email sender"
                                                            : ""}
                                                    </td>
                                                    <td>
                                                        <div class="admin-actions">
                                                            <button
                                                                class="action-link"
                                                                onClick={() => {
                                                                    setSelected(p.id);
                                                                    setTarget("");
                                                                }}
                                                            >
                                                                Edit
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </>
                    }
                >
                    {(current) => (
                        <div class="editor">
                            <For each={current().emails}>{(email) => <p>{email}</p>}</For>
                            <FormSection title="Access">
                                <label>
                                    Level
                                    <select
                                        value={current().isAdmin ? "admin" : "assigned"}
                                        disabled={current().isSelf || command.isPending()}
                                        onChange={(event) => {
                                            const next = event.currentTarget.value === "admin";
                                            event.currentTarget.value = current().isAdmin
                                                ? "admin"
                                                : "assigned";
                                            void administration(next);
                                        }}
                                    >
                                        <option value="assigned">Standard access</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </label>
                                <p>
                                    {current().isAdmin
                                        ? "Full access to events, emails and settings."
                                        : "Series access includes its events."}
                                </p>
                                <Show when={current().isSelf}>
                                    <p>You cannot change your own administrator access.</p>
                                </Show>
                            </FormSection>
                            <FormSection title="Permissions">
                                <For
                                    each={[
                                        { key: "isTeam" as const, label: "Team member" },
                                        {
                                            key: "isMailSender" as const,
                                            label: "Send event emails",
                                        },
                                    ].filter((item) => item.key === "isTeam" || !current().isAdmin)}
                                >
                                    {(item) => (
                                        <label class="checkbox">
                                            <input
                                                type="checkbox"
                                                checked={current()[item.key]}
                                                disabled={command.isPending()}
                                                onChange={(event) => {
                                                    const isEnabled = event.currentTarget.checked;
                                                    event.currentTarget.checked =
                                                        current()[item.key];
                                                    void permission(item.key, isEnabled);
                                                }}
                                            />
                                            {item.label}
                                        </label>
                                    )}
                                </For>
                            </FormSection>
                            <Show when={!current().isAdmin}>
                                <FormSection title="Assignments">
                                    <Show
                                        when={current().grants.length}
                                        fallback={<p>No events or series assigned.</p>}
                                    >
                                        <div class="table-scroll">
                                            <table class="admin-table">
                                                <thead>
                                                    <tr>
                                                        <th>Event or series</th>
                                                        <th>Role</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <For each={current().grants}>
                                                        {(grant) => (
                                                            <tr>
                                                                <td>{title(grant.scope)}</td>
                                                                <td>
                                                                    {grant.role === "editor"
                                                                        ? "Editor"
                                                                        : "Organiser"}
                                                                </td>
                                                                <td>
                                                                    <div class="admin-actions">
                                                                        <button
                                                                            class="action-link"
                                                                            onClick={() => {
                                                                                setTarget(
                                                                                    grant.scope.id,
                                                                                );
                                                                                setRole(grant.role);
                                                                            }}
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                        <button
                                                                            class="button"
                                                                            disabled={command.isPending()}
                                                                            onClick={() =>
                                                                                void assign(
                                                                                    grant.scope,
                                                                                    null,
                                                                                )
                                                                            }
                                                                        >
                                                                            Remove
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </For>
                                                </tbody>
                                            </table>
                                        </div>
                                    </Show>
                                    <form
                                        inert={command.isPending()}
                                        aria-busy={command.isPending()}
                                        class="editor"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            const item = choices().find(
                                                (item) => item.id === target(),
                                            );
                                            if (item) void assign(item.scope, role());
                                        }}
                                    >
                                        <div class="form-columns">
                                            <label>
                                                Event or series
                                                <select
                                                    required
                                                    value={target()}
                                                    onChange={(event) =>
                                                        setTarget(event.currentTarget.value)
                                                    }
                                                >
                                                    <option value="">Choose…</option>
                                                    <For each={["series", "event"] as const}>
                                                        {(kind) => (
                                                            <optgroup
                                                                label={
                                                                    kind === "series"
                                                                        ? "Series"
                                                                        : "Events"
                                                                }
                                                            >
                                                                <For
                                                                    each={choices().filter(
                                                                        (item) =>
                                                                            item.scope.kind ===
                                                                            kind,
                                                                    )}
                                                                >
                                                                    {(item) => (
                                                                        <option value={item.id}>
                                                                            {item.name}
                                                                        </option>
                                                                    )}
                                                                </For>
                                                            </optgroup>
                                                        )}
                                                    </For>
                                                </select>
                                            </label>
                                            <label>
                                                Role
                                                <select
                                                    value={role()}
                                                    onChange={(event) =>
                                                        setRole(event.currentTarget.value as Role)
                                                    }
                                                >
                                                    <option value="editor">Editor</option>
                                                    <option value="organiser">Organiser</option>
                                                </select>
                                            </label>
                                        </div>
                                        <p>{roles[role()]}</p>
                                        <div class="form-actions">
                                            <button
                                                class="button button--primary"
                                                disabled={!target() || command.isPending()}
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </form>
                                </FormSection>
                            </Show>
                        </div>
                    )}
                </Show>
            </Show>
        </Card>
    );
}
