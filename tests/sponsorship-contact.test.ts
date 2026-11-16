import { expect, test } from "bun:test";
import { sponsorshipInquiry } from "../src/sponsorships/inquiries";

test("sponsorship enquiries use the dedicated address and retain supplied details", () => {
    const inquiry = new URL(sponsorshipInquiry("Gold", "Jane & Alex", "Example AG"));
    expect(inquiry.pathname).toBe("sponsor@zurich.tech");
    expect(inquiry.searchParams.get("subject")).toBe("Sponsorship inquiry");
    expect(inquiry.searchParams.get("body")).toContain("Hi zurich.tech team,");
    expect(inquiry.searchParams.get("body")).toContain("Jane & Alex from Example AG");
    expect(inquiry.searchParams.get("body")).toContain("in the Gold tier");
});
