/** Identify the content-addressed public organisation PNGs hosted by this site. */
export function isHostedLogo(source?: string): boolean {
    const hosted = /^https:\/\/media\.zurich\.tech\/organisations\/[a-z0-9-]+\/[a-f0-9]{64}\.png$/;

    return Boolean(source && hosted.exec(source)?.[0] === source);
}
