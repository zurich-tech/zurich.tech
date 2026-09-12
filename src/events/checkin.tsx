import { useAccount } from "../auth";
import { createResource, createSignal, For, Show, onCleanup } from "solid-js";
import { Card } from "../components/card";
import { api } from "../../convex/_generated/api";
import { memberClient, publicClient } from "../auth/convex";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "../components/errors";
import { useConfirmation } from "../components/dialog";
import "./participation.css";

/** Display the attendee's pass without sharing their management credential. */
export function Pass(props: { token: string }) {
    const [pass] = createResource(
        () => props.token,
        (token) => publicClient().mutation(api.events.checkin.pass, { token }),
    );
    return (
        <Show when={pass()}>
            {(item) => (
                <Card title="Pass" class="registration-pass">
                    <div class="event-pass">
                        <img
                            src={item().image}
                            alt={`Check-in pass for ${item().name}`}
                            width="240"
                            height="240"
                        />
                        <strong>{item().name}</strong>
                    </div>
                </Card>
            )}
        </Show>
    );
}

/** Keep the camera ready between scans and offer a searchable manual fallback. */
export function CheckIn(props: { eventId: Id<"events"> }) {
    const confirm = useConfirmation();
    const account = useAccount();
    const [roster, { refetch }] = createResource(
        () => (account.user()?.id ? props.eventId : undefined),
        async (eventId) => (await memberClient()).query(api.events.checkin.roster, { eventId }),
    );
    const [search, setSearch] = createSignal("");
    const [filter, setFilter] = createSignal("All");
    const [message, setMessage] = createSignal("");
    const [isError, setIsError] = createSignal(false);
    const [isScanning, setIsScanning] = createSignal(false);
    const [pending, setPending] = createSignal(false);
    let video!: HTMLVideoElement;
    let scanner: import("qr-scanner").default | undefined;
    let lastScan = "";
    let lastAt = 0;
    let isDisposed = false;
    onCleanup(() => {
        isDisposed = true;
        scanner?.destroy();
    });

    async function record(input: { token?: string; registrationId?: Id<"registrations"> }) {
        if (pending()) return;
        setPending(true);
        setIsError(false);
        try {
            const result = await (
                await memberClient()
            ).mutation(api.events.checkin.record, { eventId: props.eventId, ...input });
            setMessage(
                `${result.isDuplicate ? "Already checked in" : "Checked in"} · ${result.name}`,
            );
            await refetch();
        } catch (error) {
            setIsError(true);
            setMessage(errorMessage(error, "Check-in failed. Try again."));
        } finally {
            setPending(false);
        }
    }
    async function start() {
        try {
            const { default: QrScanner } = await import("qr-scanner");
            if (isDisposed) return;
            scanner ??= new QrScanner(
                video,
                (result) => {
                    if (result.data === lastScan && Date.now() - lastAt < 3000) return;
                    lastScan = result.data;
                    lastAt = Date.now();
                    const prefix = "zurich.tech:checkin:";
                    if (!result.data.startsWith(prefix)) {
                        setIsError(true);
                        setMessage("Invalid pass");
                        return;
                    }
                    void record({ token: result.data.slice(prefix.length) });
                },
                { preferredCamera: "environment", returnDetailedScanResult: true },
            );
            await scanner.start();
            if (isDisposed) {
                scanner.destroy();
                return;
            }
            setIsScanning(true);
        } catch (error) {
            setIsError(true);
            setMessage(errorMessage(error, "Camera unavailable. Use the attendee search."));
        }
    }
    async function undo(id: Id<"registrations">, name: string) {
        if (
            !(await confirm({
                title: "Undo check-in",
                subject: name,
                description: "Remove this attendance record. Registration stays confirmed.",
                action: "Undo check-in",
                emails: 0,
                isDestructive: true,
            }))
        )
            return;
        setPending(true);
        try {
            await (await memberClient()).mutation(api.events.checkin.undo, { registrationId: id });
            await refetch();
            setMessage(`Check-in removed · ${name}`);
        } catch (error) {
            setIsError(true);
            setMessage(errorMessage(error, "Could not undo check-in."));
        } finally {
            setPending(false);
        }
    }
    const rows = () =>
        roster()?.rows.filter(
            (row) =>
                `${row.name} ${row.email}`.toLowerCase().includes(search().toLowerCase()) &&
                (filter() === "All" ||
                    (filter() === "Checked in" ? !!row.checkedInAt : !row.checkedInAt)),
        );
    return (
        <Card
            title="Check-in"
            toolbar={
                <a class="button" href={`/admin?event=${props.eventId}`}>
                    Attendees
                </a>
            }
        >
            <Show when={!account.isPending() && !account.user()}>
                <a class="button" href="/sign-in">
                    Sign in
                </a>
            </Show>
            <Show when={roster.error}>
                <p role="alert">{errorMessage(roster.error, "Could not load attendees.")}</p>
            </Show>
            <Show when={roster()}>
                {(data) => (
                    <>
                        <a href={`/events/${data().slug}`}>{data().title}</a>
                        <p>
                            <strong>{data().rows.filter((row) => row.checkedInAt).length}</strong>{" "}
                            checked in
                            <Show when={data().venueCapacity}>
                                {" "}
                                / {data().venueCapacity} venue capacity
                            </Show>{" "}
                            · {data().rows.filter((row) => row.status === "going").length} confirmed
                        </p>
                        <Show when={data().isEnabled} fallback={<p>Check-in is disabled.</p>}>
                            <video
                                ref={video}
                                class="checkin-video"
                                classList={{ "checkin-video--active": isScanning() }}
                                muted
                                playsinline
                            />
                            <div class="form-actions">
                                <button
                                    class="button button--primary"
                                    type="button"
                                    onClick={() => {
                                        if (isScanning()) {
                                            scanner?.stop();
                                            setIsScanning(false);
                                        } else void start();
                                    }}
                                >
                                    {isScanning() ? "Stop camera" : "Start camera"}
                                </button>
                            </div>
                            <Show when={message()}>
                                <p
                                    role="status"
                                    class="checkin-result"
                                    classList={{ "checkin-result--error": isError() }}
                                >
                                    {message()}
                                </p>
                            </Show>
                            <div class="admin-filters">
                                <input
                                    type="search"
                                    placeholder="Name or email"
                                    aria-label="Search attendees"
                                    value={search()}
                                    onInput={(event) => setSearch(event.currentTarget.value)}
                                />
                                <div class="filter-bar">
                                    <For each={["All", "Checked in", "Not checked in"]}>
                                        {(value) => (
                                            <button
                                                type="button"
                                                classList={{ active: filter() === value }}
                                                onClick={() => setFilter(value)}
                                            >
                                                {value}
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </div>
                            <div class="table-scroll">
                                <table class="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={rows()}>
                                            {(row) => (
                                                <tr>
                                                    <td>
                                                        {row.name}
                                                        <div class="text-soft">{row.email}</div>
                                                    </td>
                                                    <td>
                                                        {row.checkedInAt
                                                            ? "Checked in"
                                                            : row.status === "going"
                                                              ? "Confirmed"
                                                              : row.status}
                                                    </td>
                                                    <td>
                                                        <Show
                                                            when={row.checkedInAt}
                                                            fallback={
                                                                <button
                                                                    class="button"
                                                                    disabled={
                                                                        pending() ||
                                                                        row.status !== "going"
                                                                    }
                                                                    onClick={() =>
                                                                        record({
                                                                            registrationId: row.id,
                                                                        })
                                                                    }
                                                                >
                                                                    Check in
                                                                </button>
                                                            }
                                                        >
                                                            <button
                                                                class="button"
                                                                disabled={pending()}
                                                                onClick={() =>
                                                                    undo(row.id, row.name)
                                                                }
                                                            >
                                                                Undo
                                                            </button>
                                                        </Show>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </Show>
                    </>
                )}
            </Show>
        </Card>
    );
}
