import { socialRedirect } from "../../server/socials";

/** Redirect visitors to the public account. */
export const GET = socialRedirect;

/** Return the redirect headers without a response body. */
export const HEAD = socialRedirect;
