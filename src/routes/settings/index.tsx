import { Button } from "../../component/button";
import { Field, Input } from "../../component/field";
import { Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { requestMagicLink } from "../../data/actions";

/** Settings page. */
export default function Route() {
    // magic link
    async function submit(submitEvent: SubmitEvent) {
        submitEvent.preventDefault();

        const form = submitEvent.currentTarget as HTMLFormElement;
        const email = String(new FormData(form).get("email") ?? "");

        // require email
        if (email.length === 0) {
            return;
        }

        // sign in
        await requestMagicLink(email);
        form.reset();
    }

    return (
        <>
            <Seo title="settings" description="zurich.tech settings." />
            <Page width="narrow">
                <PageHeader title="settings" />

                {/* sign in */}
                <SignInForm onSubmit={submit} />
            </Page>
        </>
    );
}

/** Sign in form. */
function SignInForm(props: { onSubmit: (submitEvent: SubmitEvent) => Promise<void> }) {
    return (
        <Section title="login">
            <form class="grid max-w-sm gap-4" onSubmit={props.onSubmit}>
                <Field label="email">
                    <Input name="email" placeholder="you@example.com" type="email" />
                </Field>
                <Button type="submit">send magic link</Button>
            </form>
        </Section>
    );
}
