import { createMemo, createSignal, For, Show } from "solid-js";
import { ArrowLeft, Plus } from "lucide-solid";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { memberClient } from "../auth/convex";
import type { Perform } from "../app/workspace";
import { Card } from "../components/card";
import { Dialog } from "../components/dialog";
import { FilterSelect } from "../components/filter-select";
import { TableToolbar } from "../components/toolbar";
import { SponsorshipCard } from "./editor";
import { civilTime } from "../../convex/events/time";
import { selectTerm } from "../../convex/sponsorships/benefits";

/** Manage sponsor relationships separately from agreement and billing forms. */
export function SponsorshipManagement(props: {
    /** Authorised organisations, agreements and invoices. */
    workspace: FunctionReturnType<typeof api.organisations.workspace.employer>;
    /** Execute an edit and refresh the authorised workspace. */
    perform: Perform;
    /** Whether another edit is being saved. */
    isPending: boolean;
}) {
    const [selected, setSelected] = createSignal<string>();
    const [search, setSearch] = createSignal("");
    const [isCreating, setCreating] = createSignal(false);
    const [organisationId, setOrganisation] = createSignal("");
    const [tier, setTier] = createSignal("gold");
    const [email, setEmail] = createSignal("");
    const sponsor = () => props.workspace.sponsorships.find((item) => item._id === selected());

    // index organisation names once for filtering and each table row
    const companies = createMemo(
        () => new Map(props.workspace.organisations.map((item) => [item._id, item])),
    );
    const rows = createMemo(() =>
        props.workspace.sponsorships.filter((item) =>
            companies()
                .get(item.organisationId)
                ?.name.toLowerCase()
                .includes(search().trim().toLowerCase()),
        ),
    );
    const options = createMemo(() =>
        props.workspace.organisations
            .filter(
                (item) =>
                    !props.workspace.sponsorships.some(
                        (sponsor) => sponsor.organisationId === item._id,
                    ),
            )
            .map((item) => ({ value: item._id, label: item.name })),
    );

    return (
        <Show
            when={sponsor()}
            fallback={
                <Card
                    title="Sponsors"
                    toolbar={
                        <Show when={props.workspace.isAdmin}>
                            <button class="action-link" onClick={() => setCreating(true)}>
                                <Plus size={16} /> Add sponsor
                            </button>
                        </Show>
                    }
                >
                    <TableToolbar
                        value={search()}
                        onSearch={setSearch}
                        placeholder="Search sponsors…"
                    />
                    <div class="table-scroll">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Organisation</th>
                                    <th>Tier</th>
                                    <th>Recognition</th>
                                    <th>Period</th>
                                    <th>Invoices</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={rows()}>
                                    {(item) => {
                                        // show the latest retained agreement, including upcoming sponsorships
                                        const term = () =>
                                            item.term ??
                                            item.history.find(
                                                (term) =>
                                                    !term.supersededAt &&
                                                    term.endedAt === undefined,
                                            );
                                        const invoices = () =>
                                            item.history
                                                .flatMap((term) => term.invoices)
                                                .filter((invoice) => !invoice.voidedAt);
                                        const balance = () =>
                                            invoices().reduce(
                                                (sum, invoice) => sum + invoice.balance,
                                                0,
                                            );

                                        return (
                                            <tr>
                                                <td>
                                                    <button
                                                        class="text-link"
                                                        onClick={() => setSelected(item._id)}
                                                    >
                                                        {companies().get(item.organisationId)?.name}
                                                    </button>
                                                </td>
                                                <td class="sponsorship-tier">
                                                    {term()?.tier ?? item.tier}
                                                </td>
                                                <td>
                                                    {selectTerm(item.history, Date.now(), true)
                                                        ? "Public"
                                                        : "Private"}
                                                </td>
                                                <td>
                                                    {term()
                                                        ? `${civilTime(term()!.startsAt).slice(0, 10)} – ${civilTime(term()!.endsAt - 1).slice(0, 10)}`
                                                        : "Not agreed"}
                                                </td>
                                                <td>
                                                    {!invoices().length
                                                        ? "No invoice"
                                                        : balance() <= 0
                                                          ? "Paid"
                                                          : `CHF ${balance().toLocaleString("en-CH")} due`}
                                                </td>
                                                <td>
                                                    <button
                                                        class="action-link"
                                                        onClick={() => setSelected(item._id)}
                                                    >
                                                        Manage
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    }}
                                </For>
                            </tbody>
                        </table>
                        <Show when={!rows().length}>
                            <p class="text-soft">No matching sponsors.</p>
                        </Show>
                    </div>
                    <Dialog
                        isOpen={isCreating()}
                        title="Add sponsor"
                        onClose={() => setCreating(false)}
                        actions={
                            <button type="button" class="button" onClick={() => setCreating(false)}>
                                Cancel
                            </button>
                        }
                    >
                        <form
                            class="editor"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void props.perform(async () => {
                                    const id = await (
                                        await memberClient()
                                    ).mutation(api.sponsorships.organisations.request, {
                                        organisationId: organisationId() as Id<"organisations">,
                                        tier: tier() as "gold" | "silver" | "bronze",
                                        billingEmail: email(),
                                    });
                                    setSelected(id);
                                    setCreating(false);
                                }, "Sponsor added. Record the agreement to publish recognition.");
                            }}
                        >
                            <FilterSelect
                                label="Organisation"
                                value={organisationId()}
                                onChange={setOrganisation}
                                options={options()}
                            />
                            <FilterSelect
                                label="Tier"
                                value={tier()}
                                onChange={setTier}
                                options={[
                                    { value: "gold", label: "Gold" },
                                    { value: "silver", label: "Silver" },
                                    { value: "bronze", label: "Bronze" },
                                ]}
                            />
                            <label>
                                Billing email
                                <input
                                    type="email"
                                    required
                                    value={email()}
                                    onInput={(event) => setEmail(event.currentTarget.value)}
                                />
                            </label>
                            <button
                                class="button button--primary"
                                disabled={props.isPending || !organisationId()}
                            >
                                Add sponsor
                            </button>
                        </form>
                    </Dialog>
                </Card>
            }
        >
            {(current) => (
                <>
                    <button class="action-link" onClick={() => setSelected(undefined)}>
                        <ArrowLeft size={16} /> Sponsors
                    </button>
                    <SponsorshipCard
                        sponsor={current()}
                        companies={props.workspace.organisations}
                        isAdmin={props.workspace.isAdmin}
                        isPending={props.isPending}
                        perform={props.perform}
                    />
                </>
            )}
        </Show>
    );
}
