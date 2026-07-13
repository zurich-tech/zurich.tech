import { Clock } from "./clock";

/** Site heading and Zurich clock. */
export function DisplayBoard() {
    return (
        <header class="display-board">
            {/* displays */}
            <div class="display-board__displays">
                <h1 class="display-board__name">zurich.tech</h1>
                <Clock />
            </div>
        </header>
    );
}
