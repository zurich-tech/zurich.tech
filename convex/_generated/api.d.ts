/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as auth_component from "../auth/component.js";
import type * as auth_index from "../auth/index.js";
import type * as auth_member from "../auth/member.js";
import type * as auth_server from "../auth/server.js";
import type * as checkout from "../checkout.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as environment from "../environment.js";
import type * as event from "../event.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as job from "../job.js";
import type * as jobs from "../jobs.js";
import type * as limit from "../limit.js";
import type * as mail from "../mail.js";
import type * as media from "../media.js";
import type * as newsletter from "../newsletter.js";
import type * as organisations from "../organisations.js";
import type * as patrons from "../patrons.js";
import type * as payments from "../payments.js";
import type * as public_ from "../public.js";
import type * as purchase from "../purchase.js";
import type * as registration from "../registration.js";
import type * as search from "../search.js";
import type * as series from "../series.js";
import type * as sponsors from "../sponsors.js";
import type * as stripe from "../stripe.js";
import type * as tag from "../tag.js";
import type * as url from "../url.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  "auth/component": typeof auth_component;
  "auth/index": typeof auth_index;
  "auth/member": typeof auth_member;
  "auth/server": typeof auth_server;
  checkout: typeof checkout;
  crons: typeof crons;
  email: typeof email;
  environment: typeof environment;
  event: typeof event;
  events: typeof events;
  http: typeof http;
  job: typeof job;
  jobs: typeof jobs;
  limit: typeof limit;
  mail: typeof mail;
  media: typeof media;
  newsletter: typeof newsletter;
  organisations: typeof organisations;
  patrons: typeof patrons;
  payments: typeof payments;
  public: typeof public_;
  purchase: typeof purchase;
  registration: typeof registration;
  search: typeof search;
  series: typeof series;
  sponsors: typeof sponsors;
  stripe: typeof stripe;
  tag: typeof tag;
  url: typeof url;
  workspace: typeof workspace;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
