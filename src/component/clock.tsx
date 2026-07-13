import { createMemo, createSignal, onCleanup, onMount } from "solid-js";

const timeZone = "Europe/Zurich";
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
});

/** Current civil time in Zurich. */
export function Clock() {
    const [time, setTime] = createSignal("--:--:--");
    const parts = createMemo(() => time().split(":"));

    // start the clock after hydration
    onMount(() => {
        setTime(formatTime(new Date()));

        const interval = window.setInterval(() => setTime(formatTime(new Date())), 1000);
        onCleanup(() => window.clearInterval(interval));
    });

    return (
        <time class="clock" role="timer" aria-label={`Current time in Zurich: ${time()}`}>
            {/* hours */}
            <span>{parts()[0]}</span>

            {/* separator */}
            <span class="clock__separator">:</span>

            {/* minutes */}
            <span>{parts()[1]}</span>

            {/* separator */}
            <span class="clock__separator">:</span>

            {/* seconds */}
            <span>{parts()[2]}</span>
        </time>
    );
}

/** Format one instant in Zurich's current civil time. */
function formatTime(date: Date) {
    return timeFormatter.format(date);
}
