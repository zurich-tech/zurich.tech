import { TeamEdit } from "../auth/edit";
import { site } from "../app/site";

/** Public suggestions and private editorial controls share the card toolbar. */
export function NewsActions(props: { isCompact?: boolean }) {
    return (
        <>
            <a class="button" href={site.socials.discord} target="_blank" rel="noopener noreferrer">
                Suggest news
            </a>
            {!props.isCompact && <TeamEdit href="/admin?section=news" label="Manage" />}
        </>
    );
}
