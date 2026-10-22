import { createResource, createSignal, For, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useAccess } from "../auth/edit";
import { Card } from "../components/card";
import { DataGrid } from "../components/grid";
import { FilterSelect } from "../components/filter-select";
import { FilterPills } from "../components/filter-pills";
import { Loading } from "../components/loading";
import { Audience } from "./demographics";

/** Browse individual contacts separately from aggregate survey results. */
export function AudienceAdmin() {
    const [params] = useSearchParams();

    return (
        <>
            <div class="audience-navigation">
                <FilterPills
                    label="Audience view"
                    value={params.view === "survey" ? "survey" : "people"}
                    options={[
                        { value: "people", label: "People", href: "/admin?section=audience" },
                        {
                            value: "survey",
                            label: "Survey results",
                            href: "/admin?section=audience&view=survey",
                        },
                    ]}
                />
            </div>
            <Show when={params.view === "survey"} fallback={<People />}>
                <Audience />
            </Show>
        </>
    );
}

/** Load administrator-only people, including imported contacts and email opt-outs. */
function People() {
    const access = useAccess();
    const [result, { refetch }] = createResource(access.key, async (key) => ({
        key,
        rows: await (await memberClient()).query(api.members.management.list, {}),
    }));
    const [account, setAccount] = createSignal("all");
    const [subscription, setSubscription] = createSignal("all");
    const records = () => (result()?.key === access.key() ? result()?.rows : undefined);
    const rows = () =>
        records()?.filter(
            (row) =>
                (account() === "all" || row.account === account()) &&
                (subscription() === "all" ||
                    (subscription() === "none" && row.contacts.length === 0) ||
                    row.contacts.some((contact) => contact.status === subscription())),
        ) ?? [];

    return (
        <Card
            title="People"
            toolbar={
                <button class="button" onClick={() => void refetch()} disabled={result.loading}>
                    Refresh
                </button>
            }
        >
            <Show when={result.error}>
                <p class="form-error" role="alert">
                    Could not load people. Please retry.
                </p>
            </Show>
            <Show
                when={records()}
                fallback={
                    <Show when={!result.error}>
                        <Loading />
                    </Show>
                }
            >
                <DataGrid
                    rows={rows()}
                    label="People"
                    filename="zurich-tech-people.csv"
                    initialSort="created"
                    filters={
                        <>
                            <FilterSelect
                                label="Account"
                                value={account()}
                                onChange={setAccount}
                                options={[
                                    { value: "all", label: "All accounts" },
                                    { value: "active", label: "Active account" },
                                    { value: "disabled", label: "Disabled account" },
                                    { value: "none", label: "No account" },
                                ]}
                            />
                            <FilterSelect
                                label="Email subscription"
                                value={subscription()}
                                onChange={setSubscription}
                                options={[
                                    { value: "all", label: "All email statuses" },
                                    { value: "subscribed", label: "Subscribed" },
                                    { value: "unsubscribed", label: "Unsubscribed" },
                                    { value: "suppressed", label: "Suppressed" },
                                    { value: "none", label: "Not subscribed" },
                                ]}
                            />
                        </>
                    }
                    columns={[
                        {
                            id: "name",
                            label: "Name",
                            value: (row) => row.name,
                            render: (row) => (
                                <>
                                    {row.name || "Unnamed contact"}
                                    <small>
                                        {row.status[0].toUpperCase() + row.status.slice(1)}
                                    </small>
                                </>
                            ),
                        },
                        {
                            id: "email",
                            label: "Email",
                            value: (row) => row.contacts.map((contact) => contact.email).join("; "),
                            render: (row) => (
                                <For each={row.contacts}>
                                    {(contact) => <div>{contact.email}</div>}
                                </For>
                            ),
                        },
                        {
                            id: "account",
                            label: "Account",
                            value: (row) => row.account,
                            render: (row) =>
                                row.account === "none"
                                    ? "No account"
                                    : row.account === "active"
                                      ? "Active"
                                      : "Disabled",
                        },
                        {
                            id: "subscription",
                            label: "Email status",
                            value: (row) =>
                                row.contacts.map((contact) => contact.status).join("; "),
                            render: (row) => (
                                <For each={row.contacts}>
                                    {(contact) => (
                                        <div>
                                            {contact.status === "none"
                                                ? "Not subscribed"
                                                : contact.status[0].toUpperCase() +
                                                  contact.status.slice(1)}
                                            <Show when={contact.status === "subscribed"}>
                                                <small>
                                                    {contact.weekly
                                                        ? "Newsletter on"
                                                        : "Newsletter off"}
                                                </small>
                                            </Show>
                                        </div>
                                    )}
                                </For>
                            ),
                        },
                        {
                            id: "created",
                            label: "Added",
                            value: (row) => row.createdAt,
                            exportValue: (row) => new Date(row.createdAt).toISOString(),
                            render: (row) => (
                                <time dateTime={new Date(row.createdAt).toISOString()}>
                                    {new Date(row.createdAt).toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </time>
                            ),
                        },
                        { id: "source", label: "Source", value: (row) => row.source },
                    ]}
                />
            </Show>
        </Card>
    );
}
