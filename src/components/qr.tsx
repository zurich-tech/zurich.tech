import { createMemo } from "solid-js";
import qrcode from "qrcode-generator";

/** Render a branded QR code with high error correction and a clear quiet zone. */
export function QrCode(props: { url: string; label: string }) {
    const code = createMemo(() => {
        const value = qrcode(0, "H");
        value.addData(props.url);
        value.make();
        const modules = value.getModuleCount();
        const path = Array.from({ length: modules * modules }, (_, index) => {
            const row = Math.floor(index / modules);
            const column = index % modules;

            return value.isDark(row, column) ? `M${column} ${row}h1v1h-1z` : "";
        }).join("");

        return { modules, path };
    });

    return (
        <svg
            viewBox={`-4 -4 ${code().modules + 8} ${code().modules + 8}`}
            role="img"
            aria-label={props.label}
        >
            <path d={code().path} fill="currentColor" />
            <rect
                x={code().modules / 2 - 3.5}
                y={code().modules / 2 - 3.5}
                width="7"
                height="7"
                rx="1"
                fill="var(--color-paper)"
            />
            <image
                href="/branding/logo.svg"
                x={code().modules / 2 - 2.5}
                y={code().modules / 2 - 2.5}
                width="5"
                height="5"
            />
        </svg>
    );
}
