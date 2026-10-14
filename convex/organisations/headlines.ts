/** Trim an organisation headline and omit its trailing full stop. */
export function normalizeHeadline(value: string): string {
    return value.trim().replace(/\.+$/, "").trimEnd();
}
