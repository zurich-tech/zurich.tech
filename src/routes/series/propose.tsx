import { Button } from "../../component/button";
import { Field, Input, Select, Textarea } from "../../component/field";
import { Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { proposeSeries } from "../../data/actions";

/** Series proposal. */
export default function Route() {
    // submission
    async function submit(submitEvent: SubmitEvent) {
        submitEvent.preventDefault();

        const form = submitEvent.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const proposal = seriesProposal(data);

        // require fields
        if (
            proposal.title.length === 0 ||
            proposal.description.length === 0 ||
            proposal.ownerEmail.length === 0
        ) {
            return;
        }

        // submit proposal
        await proposeSeries(proposal);
        form.reset();
    }

    return (
        <>
            <Seo title="start series" description="propose a series." />
            <Page width="narrow">
                <PageHeader title="start series" />

                {/* form */}
                <ProposalForm onSubmit={submit} />
            </Page>
        </>
    );
}

/** Series proposal form. */
function ProposalForm(props: { onSubmit: (submitEvent: SubmitEvent) => Promise<void> }) {
    return (
        <Section title="details">
            <form class="grid gap-5" onSubmit={props.onSubmit}>
                <Field label="title">
                    <Input name="title" placeholder="systems reading group" />
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
                    <Field label="owner email">
                        <Input name="ownerEmail" placeholder="you@example.com" type="email" />
                    </Field>
                </div>

                <Field label="topic and audience">
                    <Textarea name="description" placeholder="topic, cadence, audience." />
                </Field>

                <Button type="submit">submit</Button>
            </form>
        </Section>
    );
}

/** Series proposal payload. */
function seriesProposal(data: FormData) {
    return {
        description: String(data.get("description") ?? ""),
        ownerEmail: String(data.get("ownerEmail") ?? ""),
        title: String(data.get("title") ?? ""),
    };
}
