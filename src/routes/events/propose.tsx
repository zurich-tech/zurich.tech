import { Button } from "../../component/button";
import { Field, Input, Select, Textarea } from "../../component/field";
import { Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { proposeEvent } from "../../data/actions";

/** Event proposal page. */
export default function Route() {
    // proposal
    async function submit(submitEvent: SubmitEvent) {
        submitEvent.preventDefault();

        const form = submitEvent.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const proposal = eventProposal(data);

        // require fields
        if (
            proposal.title.length === 0 ||
            proposal.description.length === 0 ||
            proposal.ownerEmail.length === 0
        ) {
            return;
        }

        // submit proposal
        await proposeEvent(proposal);
        form.reset();
    }

    return (
        <>
            <Seo title="propose event" description="Event proposal." />
            <Page width="narrow">
                <PageHeader title="propose event" />

                {/* form */}
                <ProposalForm onSubmit={submit} />
            </Page>
        </>
    );
}

/** Event proposal form. */
function ProposalForm(props: { onSubmit: (submitEvent: SubmitEvent) => Promise<void> }) {
    return (
        <Section title="details">
            <form class="grid gap-5" onSubmit={props.onSubmit}>
                <Field label="title">
                    <Input name="title" placeholder="systems workshop" />
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
                        <Input min="1" name="capacity" placeholder="80" type="number" />
                    </Field>
                </div>

                {/* date and venue */}
                <div class="grid gap-5 md:grid-cols-2">
                    <Field label="date">
                        <Input name="startsAt" type="date" />
                    </Field>

                    <Field label="venue">
                        <Input name="venue" placeholder="eth, trust square, online" />
                    </Field>
                </div>

                <Field label="description">
                    <Textarea name="description" placeholder="topic, speakers, agenda." />
                </Field>

                <Field label="owner email">
                    <Input name="ownerEmail" placeholder="you@example.com" type="email" />
                </Field>

                <Button type="submit">submit</Button>
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
        format: String(data.get("format") ?? "other") as "meetup",
        ownerEmail: String(data.get("ownerEmail") ?? ""),
        startsAt: startsAt.length === 0 ? undefined : Date.parse(startsAt),
        title: String(data.get("title") ?? ""),
        venue: String(data.get("venue") ?? ""),
    };
}
