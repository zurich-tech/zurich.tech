/** Keep a recoverable search failure beside the control it affects. */
export function SearchNotice(props: { message: string; retry: () => void }) {
    return (
        <div class="search-notice" role="status">
            <span>{props.message}</span>
            <button type="button" class="button" onClick={props.retry}>
                Retry
            </button>
        </div>
    );
}
