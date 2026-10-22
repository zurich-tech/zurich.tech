import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { affiliationText } from "../members/affiliations";
import { siteOrigin } from "../auth/environment";
import { escapeHtml, palette, sectionHeading } from "./layout";

/** Published speakers and their ordered programme. */
export type Programme = {
    speakers: Pick<Doc<"speakers">, "name" | "imageUrl" | "affiliations">[];
    sessions: (Pick<Doc<"sessions">, "time" | "title"> & { speakerNames?: string[] })[];
};

/** Read the published appearance snapshots rather than private member profiles. */
export async function readProgramme(
    ctx: Pick<QueryCtx, "db">,
    eventId: Id<"events">,
): Promise<Programme> {
    const speakers = await ctx.db
        .query("speakers")
        .withIndex("by_event_and_position", (q) => q.eq("eventId", eventId))
        .collect();
    const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_event_and_position", (q) => q.eq("eventId", eventId))
        .collect();

    const active = speakers.filter((speaker) => !speaker.isRemoved);
    const names = new Map(active.map((speaker) => [speaker._id, speaker.name]));

    return {
        speakers: active,
        sessions: sessions.map((session) => ({
            ...session,
            speakerNames: (session.speakerIds ?? []).map((id) => {
                const name = names.get(id);
                if (!name) throw new Error("programme speaker is missing");
                return name;
            }),
        })),
    };
}

/** Render compact speaker portraits and a separate ordered programme in both formats. */
export function programmeContent(programme?: Programme) {
    if (!programme) return { html: "", text: "" };
    const speakers = programme.speakers
        .map((speaker) => {
            const affiliation = affiliationText(speaker.affiliations);
            const portrait = speaker.imageUrl
                ? `<td width="88" valign="top" style="padding:12px 16px 12px 0"><img src="${escapeHtml(new URL(speaker.imageUrl, siteOrigin()).href)}" alt="" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:cover;border-radius:4px" /></td>`
                : "";

            return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed"><tr>${portrait}<td valign="middle" style="padding:12px 0"><p style="margin:0;font-size:20px;font-weight:600;line-height:1.3">${escapeHtml(speaker.name)}</p>${affiliation ? `<p style="margin:6px 0 0;font-size:14px;color:${palette.soft};line-height:1.5">${escapeHtml(affiliation)}</p>` : ""}</td></tr></table>`;
        })
        .join("");
    const sessions = programme.sessions
        .map(
            (session) =>
                `<tr><td width="60" valign="top" style="padding:8px 12px 8px 0;color:${palette.soft};font-size:14px">${escapeHtml(session.time)}</td><td valign="top" style="padding:8px 0;font-size:16px">${escapeHtml(session.title)}${session.speakerNames?.length ? `<br><span style="font-size:14px;color:${palette.soft}">${escapeHtml(session.speakerNames.join(", "))}</span>` : ""}</td></tr>`,
        )
        .join("");

    return {
        html:
            (speakers ? sectionHeading("Speakers") + speakers : "") +
            (sessions
                ? sectionHeading("Programme") +
                  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed">${sessions}</table>`
                : ""),
        text: [
            programme.speakers.length
                ? "Speakers\n" +
                  programme.speakers
                      .map((speaker) =>
                          [speaker.name, affiliationText(speaker.affiliations)]
                              .filter(Boolean)
                              .join(" · "),
                      )
                      .join("\n")
                : "",
            programme.sessions.length
                ? "Programme\n" +
                  programme.sessions
                      .map((session) =>
                          [session.time, session.title, ...(session.speakerNames ?? [])]
                              .filter(Boolean)
                              .join(" · "),
                      )
                      .join("\n")
                : "",
        ]
            .filter(Boolean)
            .join("\n\n"),
    };
}
