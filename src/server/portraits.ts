import { PhotonImage, initPhoton, resize, SamplingFilter } from "@cf-wasm/photon";

/** Limit optional public portraits to two megabytes and eight seconds per download. */
const maxBytes = 2 * 1024 * 1024;

/** Normalise supported portrait formats to a small PNG the SVG renderer can decode. */
export async function portraitData(bytes: Uint8Array) {
    await initPhoton.ensure();
    const original = PhotonImage.new_from_byteslice(bytes);
    try {
        const width = original.get_width();
        const height = original.get_height();
        const scale = Math.min(1, 208 / Math.max(width, height));
        const small = resize(
            original,
            Math.max(1, Math.round(width * scale)),
            Math.max(1, Math.round(height * scale)),
            SamplingFilter.Lanczos3,
        );
        try {
            return imageData(small.get_bytes(), "image/png");
        } finally {
            small.free();
        }
    } finally {
        original.free();
    }
}

/** Encode images for a self-contained SVG without external renderer requests. */
export function imageData(bytes: Uint8Array, type: string) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));

    return `data:${type};base64,${btoa(binary)}`;
}

/** Allow public HTTPS portrait sources, including each redirect destination. */
export function publicPortrait(value: string) {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.port &&
        host.includes(".") &&
        !/^[\d.]+$/.test(host) &&
        !host.includes(":") &&
        !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)
    );
}

/** Fetch an optional remote portrait with bounded size, duration and redirects. */
export async function portrait(value: string): Promise<string | undefined> {
    try {
        let url = value;
        const signal = AbortSignal.timeout(8000);
        for (let redirects = 0; redirects <= 3; redirects++) {
            if (!publicPortrait(url)) throw new Error("portrait URL must be public HTTPS");
            const response = await fetch(url, { redirect: "manual", signal });
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get("location");
                await response.body?.cancel();
                if (!location) throw new Error("portrait redirect has no location");
                url = new URL(location, url).href;
                continue;
            }
            const type = response.headers.get("content-type")?.split(";")[0];
            if (
                !response.ok ||
                !type ||
                !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(type)
            ) {
                await response.body?.cancel();
                throw new Error("portrait response is not a supported image");
            }
            if (!response.body) throw new Error("portrait response is empty");

            // bound streamed bytes even when the remote server omits content-length
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let length = 0;
            while (true) {
                const result = await reader.read();
                if (result.done) break;
                length += result.value.length;
                if (length > maxBytes) {
                    await reader.cancel();
                    throw new Error("portrait exceeds size limit");
                }
                chunks.push(result.value);
            }
            const bytes = new Uint8Array(length);
            let offset = 0;
            for (const chunk of chunks) {
                bytes.set(chunk, offset);
                offset += chunk.length;
            }

            return await portraitData(bytes);
        }
        throw new Error("portrait has too many redirects");
    } catch (error) {
        // portraits are optional; make their failure observable while preserving the event text
        console.warn("could not load sharing portrait", value, error);

        return undefined;
    }
}
