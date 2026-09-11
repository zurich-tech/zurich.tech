/** Give an empty card the same spacing and typography as a populated panel. */
export function Empty(props: { title: string }) {
    return (
        <div class="card-empty">
            <p>{props.title}</p>
        </div>
    );
}
