import { createSignal } from "solid-js";

import { Button } from "../../component/button";
import { Field, Input, Select, Textarea } from "../../component/field";
import { FormMessage } from "../../component/form";
import { Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { proposeEvent } from "../../data/actions";
import { errorMessage } from "../../error";

/** Event proposal page. */
export default function Route() {
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    const [success, setSuccess] = createSignal<string>();

    // submit one complete proposal
    async function submit(submitEvent: SubmitEvent) {
        submitEvent.preventDefault();

        const form = submitEvent.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const proposal = eventProposal(data);

        // expose the exact mutation result
        setError(undefined);
        setSuccess(undefined);
        setIsPending(true);
        try {
            await proposeEvent(proposal);
            form.reset();
            setSuccess("event submitted for review.");
        } catch (caught) {
            setError(errorMessage(caught, "event submission failed."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo title="propose event" description="Event proposal." />
            <Page width="narrow">
                <PageHeader title="propose event" />

                {/* form */}
                <ProposalForm
                    error={error()}
                    isPending={isPending()}
                    onSubmit={submit}
                    success={success()}
                />
            </Page>
        </>
    );
}

/** Event proposal form. */
function ProposalForm(props: {
    error?: string;
    isPending: boolean;
    onSubmit: (submitEvent: SubmitEvent) => Promise<void>;
    success?: string;
}) {
    return (
        <Section title="details">
            <form class="grid gap-5" onSubmit={props.onSubmit}>
                <Field label="title">
                    <Input maxlength="200" name="title" placeholder="systems workshop" required />
                </Field>

                {/* format and capacity */}
                <div class="grid gap-5 md:grid-cols-2">
                    <Field label="format">
                        <Select name="format">
                            <option value="meetup">meetup</option>
                            <option value="talk">talk</option>
                            <option value="workshop">workshop</option>
                            <option value="office_hours">office hours</option>
                            <option value="other">roundtable</option>
                        </Select>
                    </Field>

                    <Field label="capacity">
                        <Input max="10000" min="1" name="capacity" placeholder="80" type="number" />
                    </Field>
                </div>

                {/* date and venue */}
                <div class="grid gap-5 md:grid-cols-2">
                    <Field label="date">
                        <Input name="startsAt" required type="datetime-local" />
                    </Field>

                    <Field label="venue">
                        <Input
                            maxlength="300"
                            name="venue"
                            placeholder="eth, trust square, online"
                        />
                    </Field>
                </div>

                <Field label="description">
                    <Textarea
                        maxlength="10000"
                        name="description"
                        placeholder="topic, speakers, agenda."
                        required
                    />
                </Field>

                <Field label="owner email">
                    <Input name="ownerEmail" placeholder="you@example.com" required type="email" />
                </Field>

                <Button disabled={props.isPending} type="submit">
                    {props.isPending ? "submitting..." : "submit"}
                </Button>
                <FormMessage error={props.error} success={props.success} />
            </form>
        </Section>
    );
}

/** Event proposal payload. */
function eventProposal(data: FormData) {
    const capacity = String(data.get("capacity") ?? "");
    const startsAt = String(data.get("startsAt") ?? "");

    return {
        capacity: capacity.length === 0 ? undefined : Number(capacity),
        description: String(data.get("description") ?? ""),
        format: String(data.get("format") ?? "other") as
            "hackathon" | "meetup" | "office_hours" | "other" | "talk" | "workshop",
        ownerEmail: String(data.get("ownerEmail") ?? ""),
        startsAt: Date.parse(startsAt),
        title: String(data.get("title") ?? ""),
        venue: String(data.get("venue") ?? ""),
    };
}
