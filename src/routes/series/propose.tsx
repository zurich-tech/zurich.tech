import { createSignal } from "solid-js";

import { Button } from "../../component/button";
import { Field, Input, Select, Textarea } from "../../component/field";
import { FormMessage } from "../../component/form";
import { Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { proposeSeries } from "../../data/actions";
import { errorMessage } from "../../error";

/** Series proposal. */
export default function Route() {
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    const [success, setSuccess] = createSignal<string>();

    // submit one complete proposal
    async function submit(submitEvent: SubmitEvent) {
        submitEvent.preventDefault();

        const form = submitEvent.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const proposal = seriesProposal(data);

        // expose the exact mutation result
        setError(undefined);
        setSuccess(undefined);
        setIsPending(true);
        try {
            await proposeSeries(proposal);
            form.reset();
            setSuccess("series submitted for review.");
        } catch (caught) {
            setError(errorMessage(caught, "series submission failed."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo title="start series" description="propose a series." />
            <Page width="narrow">
                <PageHeader title="start series" />

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

/** Series proposal form. */
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
                    <Input
                        maxlength="200"
                        name="title"
                        placeholder="systems reading group"
                        required
                    />
                </Field>

                {/* cadence and owner */}
                <div class="grid gap-5 md:grid-cols-2">
                    <Field label="cadence">
                        <Select name="cadence">
                            <option>weekly</option>
                            <option>biweekly</option>
                            <option>monthly</option>
                            <option>quarterly</option>
                        </Select>
                    </Field>
                    <Field label="first event">
                        <Input name="startsAt" required type="datetime-local" />
                    </Field>
                </div>

                <Field label="topic and audience">
                    <Textarea
                        maxlength="10000"
                        name="description"
                        placeholder="topic, cadence, audience."
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

/** Series proposal payload. */
function seriesProposal(data: FormData) {
    return {
        cadence: String(data.get("cadence") ?? "monthly") as
            "biweekly" | "monthly" | "quarterly" | "weekly",
        description: String(data.get("description") ?? ""),
        ownerEmail: String(data.get("ownerEmail") ?? ""),
        startsAt: Date.parse(String(data.get("startsAt") ?? "")),
        title: String(data.get("title") ?? ""),
    };
}
