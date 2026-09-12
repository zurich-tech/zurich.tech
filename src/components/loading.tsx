import "./loading.css";

/** Reserve space while a section loads without shifting its surrounding controls. */
export function Loading() {
    return (
        <div class="loading-placeholder" role="status" aria-label="Loading">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
        </div>
    );
}
