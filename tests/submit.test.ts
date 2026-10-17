import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
    createMemo,
    createRenderEffect,
    createRoot,
    createSignal,
    onCleanup,
    Show,
    type Accessor,
} from "solid-js";
import { isServer } from "solid-js/web";

test("test_scope_submit_panels_and_links_to_keyed_record_values", () => {
    const source = readFileSync(new URL("../src/app/routes/submit.tsx", import.meta.url), "utf8");

    // prevent guarded descendants from reading an invalidated workspace getter again
    expect(source).not.toContain("currentEvent()!");
    expect(source).toContain(
        "<Show keyed when={canPublish() && isPublished() && currentEvent()?.id}>",
    );
    expect(source).toContain(
        "<Show keyed when={!canPublish() && isPublished() && currentEvent()?.id}>",
    );
    expect(source).toContain("{(eventId) => <EventMail eventId={eventId} />}");
    expect(source).toContain("{(eventId) => <Campaigns eventId={eventId} />}");
    expect(source).toContain("<Show keyed when={currentEvent()}>");
    expect(source).toContain("isTentative(event)");
    expect(source).toContain("href={`/admin?section=series&schedule=${scheduleId}`}");
    expect(source).toContain("href={`/events/${slug}`}");
});

test("test_keep_event_panel_identity_stable_through_workspace_invalidation_and_replacement", () => {
    if (isServer) {
        const result = Bun.spawnSync([
            process.execPath,
            "--conditions=browser",
            "test",
            import.meta.path,
        ]);
        expect(result.exitCode).toBe(0);
        return;
    }

    // exercise Solid's keyed scope with the same ID boundary used by both mail panels
    const panels: { readonly eventId: string }[] = [];
    const disposed: string[] = [];
    const app = createRoot((dispose) => {
        const [event, setEvent] = createSignal<{ id: string; status: string }>();
        const [isAllowed, setAllowed] = createSignal(true);
        const currentEvent = createMemo(() => event());
        const isPublished = () => currentEvent()?.status === "scheduled";
        const boundary = Show({
            keyed: true,
            get when() {
                return isAllowed() && isPublished() && currentEvent()?.id;
            },
            children: (eventId: string) => {
                const props = {
                    get eventId() {
                        return eventId;
                    },
                };
                panels.push(props);
                onCleanup(() => disposed.push(props.eventId));

                return eventId;
            },
        }) as unknown as Accessor<string | undefined>;
        let visible: string | undefined;
        createRenderEffect(() => {
            visible = boundary();
        });

        return { dispose, setEvent, setAllowed, visible: () => visible };
    });
    try {
        expect(app.visible()).toBeUndefined();
        app.setEvent({ id: "builders-run", status: "scheduled" });
        expect(app.visible()).toBe("builders-run");
        app.setEvent({ id: "builders-run", status: "scheduled" });
        expect(panels).toHaveLength(1);

        // stale child props remain safe while the keyed owner is removed
        app.setEvent(undefined);
        expect(app.visible()).toBeUndefined();
        expect(panels[0].eventId).toBe("builders-run");
        expect(disposed).toEqual(["builders-run"]);
        app.setEvent({ id: "replacement", status: "scheduled" });
        expect(app.visible()).toBe("replacement");
        app.setEvent({ id: "next", status: "scheduled" });
        expect(app.visible()).toBe("next");
        app.setAllowed(false);
        expect(app.visible()).toBeUndefined();
        app.setAllowed(true);
        expect(app.visible()).toBe("next");
        app.setEvent({ id: "next", status: "draft" });
        expect(app.visible()).toBeUndefined();
        expect(panels.map((props) => props.eventId)).toEqual([
            "builders-run",
            "replacement",
            "next",
            "next",
        ]);
        expect(disposed).toEqual(["builders-run", "replacement", "next", "next"]);
    } finally {
        app.dispose();
    }
});
