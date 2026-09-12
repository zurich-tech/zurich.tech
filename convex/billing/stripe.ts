import Stripe from "stripe";
import { action, httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { purchase } from "./purchases";
import { requiredEnvironment, siteOrigin } from "../auth/environment";

/** Open hosted checkout for one annual term, including a paid invoice. */
export const start = action({
    args: { purchase },
    handler: async (ctx, args): Promise<string> => {
        const stripe = client();
        requiredEnvironment("STRIPE_WEBHOOK_SECRET");
        const checkout = await ctx.runMutation(internal.billing.checkouts.reserve, args);
        if (checkout.url) return checkout.url;

        // keep amounts and entitlement references outside browser control
        const session = await stripe.checkout.sessions.create(
            {
                mode: "payment",
                payment_method_types: ["card"],
                customer_email: checkout.email,
                customer_creation: "always",
                billing_address_collection: "required",
                invoice_creation: {
                    enabled: true,
                    invoice_data: { metadata: { checkoutId: checkout._id } },
                },
                line_items: [
                    {
                        quantity: 1,
                        price_data: {
                            currency: "chf",
                            unit_amount: checkout.amount * 100,
                            product_data: { name: checkout.name },
                        },
                    },
                ],
                client_reference_id: checkout._id,
                metadata: { checkoutId: checkout._id },
                expires_at: Math.floor(checkout.expiresAt / 1000),
                success_url: `${siteOrigin()}/payment?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${siteOrigin()}/${args.purchase.kind === "support" ? "sponsor" : "manage"}`,
            },
            { idempotencyKey: checkout._id },
        );
        if (!session.url) throw new Error("Stripe returned no checkout URL.");
        await ctx.runMutation(internal.billing.checkouts.attachSession, {
            id: checkout._id,
            sessionId: session.id,
            url: session.url,
        });

        return session.url;
    },
});

/** Verify Stripe's signature before applying any payment event. */
export const webhook = httpAction(async (ctx, request) => {
    const stripe = client();
    const signature = request.headers.get("stripe-signature");
    if (!signature) return new Response("Missing signature", { status: 400 });
    const body = await request.text();
    let event: Stripe.Event;
    try {
        event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            requiredEnvironment("STRIPE_WEBHOOK_SECRET"),
            undefined,
            Stripe.createSubtleCryptoProvider(),
        );
    } catch {
        return new Response("Invalid signature", { status: 400 });
    }

    // grant access only after Stripe reports a paid session
    if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded"
    ) {
        const session = event.data.object;
        if (session.payment_status === "paid" && session.metadata?.checkoutId) {
            const invoice =
                typeof session.invoice === "string"
                    ? await stripe.invoices.retrieve(session.invoice)
                    : session.invoice;
            if (
                typeof session.payment_intent !== "string" ||
                session.amount_total === null ||
                !session.currency
            )
                throw new Error("Paid checkout has incomplete payment details.");
            const payment = await stripe.paymentIntents.retrieve(session.payment_intent, {
                expand: ["latest_charge"],
            });
            await ctx.runMutation(internal.billing.checkouts.complete, {
                id: session.metadata.checkoutId as Id<"checkouts">,
                sessionId: session.id,
                amount: session.amount_total,
                currency: session.currency,
                paymentIntent: session.payment_intent,
                invoiceUrl: invoice?.hosted_invoice_url ?? undefined,
            });
            if (
                payment.latest_charge &&
                typeof payment.latest_charge !== "string" &&
                payment.latest_charge.refunded
            )
                await ctx.runMutation(internal.billing.checkouts.refund, {
                    paymentIntent: payment.id,
                });
        }
    } else if (
        event.type === "checkout.session.expired" ||
        event.type === "checkout.session.async_payment_failed"
    ) {
        await ctx.runMutation(internal.billing.checkouts.expire, {
            sessionId: event.data.object.id,
        });
    } else if (event.type === "invoice.paid") {
        const invoice = event.data.object;
        if (invoice.metadata?.checkoutId && invoice.hosted_invoice_url)
            await ctx.runMutation(internal.billing.checkouts.recordInvoice, {
                id: invoice.metadata.checkoutId as Id<"checkouts">,
                url: invoice.hosted_invoice_url,
            });
    } else if (event.type === "charge.refunded") {
        const charge = event.data.object;
        if (charge.refunded && typeof charge.payment_intent === "string")
            await ctx.runMutation(internal.billing.checkouts.refund, {
                paymentIntent: charge.payment_intent,
            });
    }

    return new Response("OK");
});

/** Construct the payment client with the server-only credential. */
function client() {
    return new Stripe(requiredEnvironment("STRIPE_SECRET_KEY"), {
        httpClient: Stripe.createFetchHttpClient(),
    });
}
