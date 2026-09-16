import { FilterPills } from "../components/filter-pills";
import { Show, Suspense, createResource } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { Campaigns } from "./campaigns";
import { NewsletterSchedule } from "./schedule";
import { Sending } from "./sending";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import "./mail.css";

const sections = ["Campaigns", "Newsletter", "Settings"];

/** Separate composing mail, automatic editions and sender configuration. */
export function EmailAdmin() {
    const [params] = useSearchParams();
    const view = () =>
        sections.map((value) => value.toLowerCase()).includes(String(params.mail))
            ? params.mail
            : "campaigns";
    const [sending] = createResource(async () =>
        (await memberClient()).query(api.mail.sending.current, {}),
    );

    return (
        <div class="mail-workspace">
            <FilterPills
                class="mail-tabs"
                label="Email sections"
                value={String(view())}
                options={sections.map((name) => ({
                    value: name.toLowerCase(),
                    label: name,
                    href: `/admin?section=email&mail=${name.toLowerCase()}`,
                }))}
            />
            <Show when={sending()?.isLocked}>
                <span class="tag tag-status status-control mail-mode mail-warning">
                    Test mode · audience sending is off
                </span>
            </Show>
            <Suspense fallback={<p>Loading email…</p>}>
                <Show when={view() === "campaigns"}>
                    <Campaigns />
                </Show>
                <Show when={view() === "newsletter"}>
                    <NewsletterSchedule />
                </Show>
                <Show when={view() === "settings"}>
                    <Sending />
                </Show>
            </Suspense>
        </div>
    );
}
