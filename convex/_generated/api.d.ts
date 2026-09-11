/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth_access from "../auth/access.js";
import type * as auth_component from "../auth/component.js";
import type * as auth_environment from "../auth/environment.js";
import type * as auth_index from "../auth/index.js";
import type * as auth_member from "../auth/member.js";
import type * as auth_providers from "../auth/providers.js";
import type * as auth_queries from "../auth/queries.js";
import type * as auth_server from "../auth/server.js";
import type * as billing_checkouts from "../billing/checkouts.js";
import type * as billing_payments from "../billing/payments.js";
import type * as billing_purchases from "../billing/purchases.js";
import type * as billing_stripe from "../billing/stripe.js";
import type * as crons from "../crons.js";
import type * as events_fields from "../events/fields.js";
import type * as events_gallery from "../events/gallery.js";
import type * as events_mutations from "../events/mutations.js";
import type * as events_photos from "../events/photos.js";
import type * as events_queries from "../events/queries.js";
import type * as events_registrations from "../events/registrations.js";
import type * as events_series from "../events/series.js";
import type * as events_workspace from "../events/workspace.js";
import type * as http from "../http.js";
import type * as jobs_fields from "../jobs/fields.js";
import type * as jobs_jobs from "../jobs/jobs.js";
import type * as mail_deliveries from "../mail/deliveries.js";
import type * as mail_digests from "../mail/digests.js";
import type * as mail_events from "../mail/events.js";
import type * as mail_layout from "../mail/layout.js";
import type * as mail_limits from "../mail/limits.js";
import type * as mail_preferences from "../mail/preferences.js";
import type * as mail_subscriptions from "../mail/subscriptions.js";
import type * as mail_templates from "../mail/templates.js";
import type * as mail_verification from "../mail/verification.js";
import type * as members_audience from "../members/audience.js";
import type * as members_avatars from "../members/avatars.js";
import type * as members_demographics from "../members/demographics.js";
import type * as members_emails from "../members/emails.js";
import type * as members_links from "../members/links.js";
import type * as members_profiles from "../members/profiles.js";
import type * as members_queries from "../members/queries.js";
import type * as members_search from "../members/search.js";
import type * as members_tags from "../members/tags.js";
import type * as members_team from "../members/team.js";
import type * as members_urls from "../members/urls.js";
import type * as organisations_mutations from "../organisations/mutations.js";
import type * as organisations_queries from "../organisations/queries.js";
import type * as organisations_workspace from "../organisations/workspace.js";
import type * as places_locations from "../places/locations.js";
import type * as places_map from "../places/map.js";
import type * as search_search from "../search/search.js";
import type * as sponsorships_members from "../sponsorships/members.js";
import type * as sponsorships_organisations from "../sponsorships/organisations.js";
import type * as statistics_queries from "../statistics/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "auth/access": typeof auth_access;
  "auth/component": typeof auth_component;
  "auth/environment": typeof auth_environment;
  "auth/index": typeof auth_index;
  "auth/member": typeof auth_member;
  "auth/providers": typeof auth_providers;
  "auth/queries": typeof auth_queries;
  "auth/server": typeof auth_server;
  "billing/checkouts": typeof billing_checkouts;
  "billing/payments": typeof billing_payments;
  "billing/purchases": typeof billing_purchases;
  "billing/stripe": typeof billing_stripe;
  crons: typeof crons;
  "events/fields": typeof events_fields;
  "events/gallery": typeof events_gallery;
  "events/mutations": typeof events_mutations;
  "events/photos": typeof events_photos;
  "events/queries": typeof events_queries;
  "events/registrations": typeof events_registrations;
  "events/series": typeof events_series;
  "events/workspace": typeof events_workspace;
  http: typeof http;
  "jobs/fields": typeof jobs_fields;
  "jobs/jobs": typeof jobs_jobs;
  "mail/deliveries": typeof mail_deliveries;
  "mail/digests": typeof mail_digests;
  "mail/events": typeof mail_events;
  "mail/layout": typeof mail_layout;
  "mail/limits": typeof mail_limits;
  "mail/preferences": typeof mail_preferences;
  "mail/subscriptions": typeof mail_subscriptions;
  "mail/templates": typeof mail_templates;
  "mail/verification": typeof mail_verification;
  "members/audience": typeof members_audience;
  "members/avatars": typeof members_avatars;
  "members/demographics": typeof members_demographics;
  "members/emails": typeof members_emails;
  "members/links": typeof members_links;
  "members/profiles": typeof members_profiles;
  "members/queries": typeof members_queries;
  "members/search": typeof members_search;
  "members/tags": typeof members_tags;
  "members/team": typeof members_team;
  "members/urls": typeof members_urls;
  "organisations/mutations": typeof organisations_mutations;
  "organisations/queries": typeof organisations_queries;
  "organisations/workspace": typeof organisations_workspace;
  "places/locations": typeof places_locations;
  "places/map": typeof places_map;
  "search/search": typeof search_search;
  "sponsorships/members": typeof sponsorships_members;
  "sponsorships/organisations": typeof sponsorships_organisations;
  "statistics/queries": typeof statistics_queries;
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
