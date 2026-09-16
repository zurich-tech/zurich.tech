import { FilterPills } from "./filter-pills";

/** Choose a workspace section with the shared scrolling pills. */
export function SectionTabs(props: {
    label: string;
    options: { id: string; label: string }[];
    value: string;
    onChange: (id: string) => void;
}) {
    return (
        <FilterPills
            class="admin-tabs"
            label={props.label}
            options={props.options.map((tab) => ({ value: tab.id, label: tab.label }))}
            value={props.value}
            onChange={props.onChange}
        />
    );
}
