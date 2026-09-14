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
import type * as auth_grants from "../auth/grants.js";
import type * as auth_index from "../auth/index.js";
import type * as auth_management from "../auth/management.js";
import type * as auth_member from "../auth/member.js";
import type * as auth_permissions from "../auth/permissions.js";
import type * as auth_providers from "../auth/providers.js";
import type * as auth_queries from "../auth/queries.js";
import type * as auth_server from "../auth/server.js";
import type * as billing_checkouts from "../billing/checkouts.js";
import type * as billing_payments from "../billing/payments.js";
import type * as billing_purchases from "../billing/purchases.js";
import type * as billing_stripe from "../billing/stripe.js";
import type * as crons from "../crons.js";
import type * as events_actions from "../events/actions.js";
import type * as events_checkin from "../events/checkin.js";
import type * as events_conditions from "../events/conditions.js";
import type * as events_confirmation from "../events/confirmation.js";
import type * as events_deletions from "../events/deletions.js";
import type * as events_feedback from "../events/feedback.js";
import type * as events_fields from "../events/fields.js";
import type * as events_gallery from "../events/gallery.js";
import type * as events_mail from "../events/mail.js";
import type * as events_management from "../events/management.js";
import type * as events_mutations from "../events/mutations.js";
import type * as events_organisers from "../events/organisers.js";
import type * as events_photos from "../events/photos.js";
import type * as events_place from "../events/place.js";
import type * as events_queries from "../events/queries.js";
import type * as events_recurrence from "../events/recurrence.js";
import type * as events_registrations from "../events/registrations.js";
import type * as events_schedules from "../events/schedules.js";
import type * as events_series from "../events/series.js";
import type * as events_speakers from "../events/speakers.js";
import type * as events_workspace from "../events/workspace.js";
import type * as http from "../http.js";
import type * as jobs_fields from "../jobs/fields.js";
import type * as jobs_jobs from "../jobs/jobs.js";
import type * as mail_access from "../mail/access.js";
import type * as mail_audiences from "../mail/audiences.js";
import type * as mail_campaigns from "../mail/campaigns.js";
import type * as mail_events from "../mail/events.js";
import type * as mail_followup from "../mail/followup.js";
import type * as mail_history from "../mail/history.js";
import type * as mail_layout from "../mail/layout.js";
import type * as mail_limits from "../mail/limits.js";
import type * as mail_messages from "../mail/messages.js";
import type * as mail_model from "../mail/model.js";
import type * as mail_newsletter from "../mail/newsletter.js";
import type * as mail_personalization from "../mail/personalization.js";
import type * as mail_policy from "../mail/policy.js";
import type * as mail_preferences from "../mail/preferences.js";
import type * as mail_progress from "../mail/progress.js";
import type * as mail_provider from "../mail/provider.js";
import type * as mail_sending from "../mail/sending.js";
import type * as mail_series from "../mail/series.js";
import type * as mail_subscriptions from "../mail/subscriptions.js";
import type * as mail_templates from "../mail/templates.js";
import type * as mail_verification from "../mail/verification.js";
import type * as mail_webhooks from "../mail/webhooks.js";
import type * as members_affiliations from "../members/affiliations.js";
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
import type * as migrations_events from "../migrations/events.js";
import type * as migrations_mail from "../migrations/mail.js";
import type * as news_content from "../news/content.js";
import type * as news_mutations from "../news/mutations.js";
import type * as news_queries from "../news/queries.js";
import type * as organisations_mutations from "../organisations/mutations.js";
import type * as organisations_queries from "../organisations/queries.js";
import type * as organisations_workspace from "../organisations/workspace.js";
import type * as places_locations from "../places/locations.js";
import type * as places_map from "../places/map.js";
import type * as search_search from "../search/search.js";
import type * as sponsorships_members from "../sponsorships/members.js";
import type * as sponsorships_organisations from "../sponsorships/organisations.js";
import type * as statistics_history from "../statistics/history.js";
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
  "auth/grants": typeof auth_grants;
  "auth/index": typeof auth_index;
  "auth/management": typeof auth_management;
  "auth/member": typeof auth_member;
  "auth/permissions": typeof auth_permissions;
  "auth/providers": typeof auth_providers;
  "auth/queries": typeof auth_queries;
  "auth/server": typeof auth_server;
  "billing/checkouts": typeof billing_checkouts;
  "billing/payments": typeof billing_payments;
  "billing/purchases": typeof billing_purchases;
  "billing/stripe": typeof billing_stripe;
  crons: typeof crons;
  "events/actions": typeof events_actions;
  "events/checkin": typeof events_checkin;
  "events/conditions": typeof events_conditions;
  "events/confirmation": typeof events_confirmation;
  "events/deletions": typeof events_deletions;
  "events/feedback": typeof events_feedback;
  "events/fields": typeof events_fields;
  "events/gallery": typeof events_gallery;
  "events/mail": typeof events_mail;
  "events/management": typeof events_management;
  "events/mutations": typeof events_mutations;
  "events/organisers": typeof events_organisers;
  "events/photos": typeof events_photos;
  "events/place": typeof events_place;
  "events/queries": typeof events_queries;
  "events/recurrence": typeof events_recurrence;
  "events/registrations": typeof events_registrations;
  "events/schedules": typeof events_schedules;
  "events/series": typeof events_series;
  "events/speakers": typeof events_speakers;
  "events/workspace": typeof events_workspace;
  http: typeof http;
  "jobs/fields": typeof jobs_fields;
  "jobs/jobs": typeof jobs_jobs;
  "mail/access": typeof mail_access;
  "mail/audiences": typeof mail_audiences;
  "mail/campaigns": typeof mail_campaigns;
  "mail/events": typeof mail_events;
  "mail/followup": typeof mail_followup;
  "mail/history": typeof mail_history;
  "mail/layout": typeof mail_layout;
  "mail/limits": typeof mail_limits;
  "mail/messages": typeof mail_messages;
  "mail/model": typeof mail_model;
  "mail/newsletter": typeof mail_newsletter;
  "mail/personalization": typeof mail_personalization;
  "mail/policy": typeof mail_policy;
  "mail/preferences": typeof mail_preferences;
  "mail/progress": typeof mail_progress;
  "mail/provider": typeof mail_provider;
  "mail/sending": typeof mail_sending;
  "mail/series": typeof mail_series;
  "mail/subscriptions": typeof mail_subscriptions;
  "mail/templates": typeof mail_templates;
  "mail/verification": typeof mail_verification;
  "mail/webhooks": typeof mail_webhooks;
  "members/affiliations": typeof members_affiliations;
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
  "migrations/events": typeof migrations_events;
  "migrations/mail": typeof migrations_mail;
  "news/content": typeof news_content;
  "news/mutations": typeof news_mutations;
  "news/queries": typeof news_queries;
  "organisations/mutations": typeof organisations_mutations;
  "organisations/queries": typeof organisations_queries;
  "organisations/workspace": typeof organisations_workspace;
  "places/locations": typeof places_locations;
  "places/map": typeof places_map;
  "search/search": typeof search_search;
  "sponsorships/members": typeof sponsorships_members;
  "sponsorships/organisations": typeof sponsorships_organisations;
  "statistics/history": typeof statistics_history;
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
