import { Database } from "bun:sqlite";

import { archiveEvents } from "../convex/archive";

const appleEpoch = 978_307_200;
const bucket = "zurich-tech-media";
const cacheControl = "public, max-age=31536000, immutable";
const library = `${process.env.HOME}/Pictures/Photos Library.photoslibrary`;
const output = "/tmp/zurich-tech-photos";

/** One attributable photo published outside the local library. */
type PublishedPhoto = {
    /** The accessible image description. */
    alt: string;
    /** The visible source credit. */
    caption: string;
    /** The original public image URL. */
    url: string;
};

/** Reviewed public event photos absent from the local library. */
const published: Record<string, PublishedPhoto[]> = {
    "zurichnlp-1": [
        {
            alt: "Audience at the first ZurichNLP meetup.",
            caption: "Photo: Aleksander Ficek / LinkedIn",
            url: "https://media.licdn.com/dms/image/v2/D4E22AQFGkHJjcKLvcA/feedshare-shrink_800/feedshare-shrink_800/0/1679857579815?e=2147483647&t=fscWabin_R8tUJmk70SLdFbDXYzbii4DUOXJ6PVSHPM&v=beta",
        },
        {
            alt: "Opening remarks at the first ZurichNLP meetup.",
            caption: "Photo: Aleksander Ficek / LinkedIn",
            url: "https://media.licdn.com/dms/image/v2/D4E22AQEq-m4sKtUpJQ/feedshare-image-high-res/feedshare-image-high-res/0/1679857578382?e=2147483647&t=VHGsrk1-wytRCc6WOAzhwhujzeW5EIVj1igJX6-18rQ&v=beta",
        },
        {
            alt: "Luca Beurer-Kellner presents LMQL at ZurichNLP #1.",
            caption: "Photo: Aleksander Ficek / LinkedIn",
            url: "https://media.licdn.com/dms/image/v2/D4E22AQHGNb2m9qI0Wg/feedshare-image-high-res/feedshare-image-high-res/0/1679857578981?e=2147483647&t=ad4-oW1eplP3Wo1sCvYpQlcdigCo0nUrA_uca7y6gHs&v=beta",
        },
        {
            alt: "Basil Mustafa explains a diagram at ZurichNLP #1.",
            caption: "Photo: Aleksander Ficek / LinkedIn",
            url: "https://media.licdn.com/dms/image/v2/D4E22AQE9ZoWv8h1lEQ/feedshare-shrink_800/feedshare-shrink_800/0/1679857587016?e=2147483647&t=RMPasYeyLZjXUHFEzlCeexZA_FdhLCQmCXOiQpoFtjY&v=beta",
        },
    ],
};

/** One selected contact-sheet position per event. */
const selections: Record<string, number[]> = {
    "zurichnlp-4": [1, 3, 4, 8],
    "zurichnlp-8": [1, 3, 5, 7],
    "zurichcv-1": [2, 3, 5, 6],
    "zurichcv-2": [1, 9, 14, 19, 23],
    "zurichnlp-9": [1, 5, 8, 13, 15],
    "zurichnlp-10": [1, 2, 3, 4],
    "zurichcv-3": [1, 3, 6, 8],
    "zurichnlp-11": [1, 2, 3, 4],
    "zurichcv-4": [1, 2, 12, 15, 20],
    "zurichnlp-12": [1, 7, 10, 25, 32],
    "zurichcv-5": [1, 6, 9, 14, 15],
    "zurichnlp-13": [2, 8, 18, 24, 25],
    "zurichcv-6": [2, 6, 18, 21, 28],
    "zurichnlp-14": [1, 4, 7, 9, 14],
    "zurichcv-7": [1, 3, 7, 8],
    "zurichcv-9": [1, 2, 8, 9, 12],
    "zurichnlp-15": [1, 2, 7, 11, 15],
    "zurichnlp-16": [1, 2, 9, 16, 18],
    "zurichnlp-17": [2, 4, 5, 7, 9],
    "zurichcv-10": [4, 6, 12, 17, 23],
    "zurichrobotics-1": [1, 6, 11, 20, 24],
    "jurgen-schmidhuber": [5, 17, 22, 29],
    "zurichcv-11": [1, 3, 9, 15, 23],
    "zurichnlp-18": [3, 9, 11, 20, 28],
    "zurichrobotics-2": [1, 5, 10, 16, 20],
    "zurichnlp-19": [1, 2, 10, 12, 20],
    "zurichcv-12": [1, 10, 19, 21, 23],
    "zurichrobotics-3": [3, 6, 12, 24, 28],
    "zurichnlp-20": [1, 12, 19, 21, 32],
    "zurichcv-13": [2, 12, 19, 21, 25],
    "zurichrobotics-4": [5, 9, 10, 11, 16],
    "zurichnlp-21": [1, 4, 6, 9, 12],
    "zurichcv-14": [2, 3, 8, 14, 19],
};

/** One image asset read from the Photos library. */
type Photo = {
    /** The Apple epoch capture time. */
    created: number;
    /** The original filename. */
    filename: string;
    /** The Photos library identifier. */
    uuid: string;
};

/** One prepared image ready for public storage. */
type PreparedPhoto = {
    /** The accessible image description. */
    alt?: string;
    /** The visible source credit. */
    caption?: string;
    /** The optimized image height. */
    height: number;
    /** The optimized local path. */
    path: string;
    /** The event display position. */
    position: number;
    /** The optimized thumbnail path. */
    thumbnailPath: string;
    /** The optimized image width. */
    width: number;
};

const isProduction = Bun.argv.includes("--prod");
const isExportOnly = Bun.argv.includes("--export-only");
const isUploadOnly = Bun.argv.includes("--upload-only");
const eventArgument = Bun.argv.indexOf("--event");
const eventSlug = eventArgument < 0 ? undefined : Bun.argv[eventArgument + 1];
if (eventArgument >= 0 && eventSlug === undefined) {
    throw new Error("--event requires an archive event slug.");
}

// photos library
const database = new Database(`${library}/database/Photos.sqlite`, { readonly: true });
const photos = database.query<Photo, [number, number]>(`
    select
        asset.ZDATECREATED as created,
        attributes.ZORIGINALFILENAME as filename,
        asset.ZUUID as uuid
    from ZASSET asset
    join ZADDITIONALASSETATTRIBUTES attributes on attributes.ZASSET = asset.Z_PK
    where asset.ZTRASHEDSTATE = 0
      and asset.ZKIND = 0
      and asset.ZDATECREATED between ? and ?
    order by asset.ZDATECREATED
`);

if (!isUploadOnly) {
    if (eventSlug === undefined) {
        await Bun.$`rm -rf ${output}`;
    } else {
        await Bun.$`rm -rf ${output}/${eventSlug}`;
    }
    await Bun.$`mkdir -p ${output}`;
}

let didFindEvent = false;
for (const event of archiveEvents) {
    if (eventSlug !== undefined && event.slug !== eventSlug) {
        continue;
    }

    didFindEvent = true;
    const indexes = selections[event.slug];
    const sources = published[event.slug];
    if (indexes === undefined && sources === undefined) {
        continue;
    }
    if (indexes !== undefined && sources !== undefined) {
        throw new Error(`${event.slug} has both local and published photo selections.`);
    }

    const directory = `${output}/${event.slug}`;
    const count = indexes?.length ?? sources?.length ?? 0;
    let prepared: PreparedPhoto[];

    // reuse an existing prepared export
    if (isUploadOnly) {
        prepared = await Promise.all(
            Array.from(
                { length: count },
                async (_, position) => await readPrepared(directory, position, sources?.[position]),
            ),
        );
    }
    // download reviewed public photos
    else if (sources !== undefined) {
        prepared = await Promise.all(
            sources.map(
                async (photo, position) => await preparePublished(directory, photo, position),
            ),
        );
        console.log(`${event.slug}: prepared ${prepared.length}`);
    }
    // otherwise export the reviewed choices from Photos
    else {
        if (indexes === undefined) {
            throw new Error(`${event.slug} has no local photo selection.`);
        }

        const start = Date.parse(event.startsAt) / 1_000 - 3_600 - appleEpoch;
        const end = Date.parse(event.endsAt) / 1_000 + 7_200 - appleEpoch;
        const candidates = photos.all(start, end);
        const selected = indexes.map((index) => {
            const photo = candidates[index - 1];
            if (photo === undefined) {
                throw new Error(`${event.slug} has no Photos candidate ${index}.`);
            }

            return photo;
        });

        await exportOriginals(directory, selected);
        prepared = await Promise.all(
            selected.map(async (photo, position) => await prepare(directory, photo, position)),
        );
        console.log(`${event.slug}: prepared ${prepared.length}`);
    }

    if (!isExportOnly) {
        await upload(event.slug, prepared);
        console.log(`${event.slug}: uploaded ${prepared.length}`);
    }
}

if (eventSlug !== undefined && !didFindEvent) {
    throw new Error(`Archive event ${eventSlug} does not exist.`);
}

/** Export exact Photos originals, triggering iCloud downloads when required. */
async function exportOriginals(directory: string, selected: Photo[]) {
    await Bun.$`mkdir -p ${directory}`;
    const references = selected.map((photo) => `media item id "${photo.uuid}/L0/001"`).join(", ");
    const script = `tell application "Photos" to export {${references}} to POSIX file "${directory}" with using originals`;
    const scriptPath = `${directory}/export.applescript`;
    await Bun.write(scriptPath, script);

    const result = Bun.spawnSync(["osascript", scriptPath]);
    if (result.exitCode !== 0) {
        throw new Error(new TextDecoder().decode(result.stderr));
    }
}

/** Convert one exported original into a bounded WebP image. */
async function prepare(directory: string, photo: Photo, position: number): Promise<PreparedPhoto> {
    const source = `${directory}/${photo.filename}`;
    if (!(await Bun.file(source).exists())) {
        throw new Error(`Photos did not export ${photo.filename}.`);
    }

    return await optimize(directory, source, position);
}

/** Download and prepare one reviewed public image. */
async function preparePublished(
    directory: string,
    photo: PublishedPhoto,
    position: number,
): Promise<PreparedPhoto> {
    const response = await fetch(photo.url);
    if (!response.ok) {
        throw new Error(`Published photo download failed with ${response.status}.`);
    }

    // retain the source for inspection beside the optimized image
    await Bun.$`mkdir -p ${directory}`;
    const source = `${directory}/${String(position).padStart(2, "0")}-source`;
    await Bun.write(source, await response.arrayBuffer());

    return await optimize(directory, source, position, photo);
}

/** Optimize one image for public delivery. */
async function optimize(
    directory: string,
    source: string,
    position: number,
    photo?: PublishedPhoto,
): Promise<PreparedPhoto> {
    const path = `${directory}/${String(position).padStart(2, "0")}.webp`;

    // normalize orientation, dimensions, metadata, and encoding
    const convert = Bun.spawnSync([
        "magick",
        source,
        "-auto-orient",
        "-resize",
        "1600x1600>",
        "-strip",
        "-quality",
        "82",
        path,
    ]);
    if (convert.exitCode !== 0) {
        throw new Error(new TextDecoder().decode(convert.stderr));
    }

    return await readPrepared(directory, position, photo);
}

/** Read one prepared image and its exact dimensions. */
async function readPrepared(
    directory: string,
    position: number,
    photo?: PublishedPhoto,
): Promise<PreparedPhoto> {
    const path = `${directory}/${String(position).padStart(2, "0")}.webp`;
    if (!(await Bun.file(path).exists())) {
        throw new Error(`Prepared photo ${path} does not exist.`);
    }

    // prepare one grid thumbnail from the exact normalized full image
    const thumbnailPath = `${directory}/${String(position).padStart(2, "0")}-thumbnail.webp`;
    createThumbnail(path, thumbnailPath);

    // retain the exact rendered dimensions
    const identify = Bun.spawnSync(["magick", "identify", "-format", "%w %h", path]);
    const dimensions = new TextDecoder().decode(identify.stdout).trim().split(" ").map(Number);
    const [width, height] = dimensions;
    if (identify.exitCode !== 0 || width === undefined || height === undefined) {
        throw new Error(`Could not read dimensions for ${path}.`);
    }

    return {
        alt: photo?.alt,
        caption: photo?.caption,
        height,
        path,
        position,
        thumbnailPath,
        width,
    };
}

/** Create one bounded grid thumbnail. */
function createThumbnail(source: string, path: string) {
    // encode enough pixels for dense desktop and mobile displays
    const convert = Bun.spawnSync([
        "magick",
        source,
        "-resize",
        "800x800>",
        "-strip",
        "-quality",
        "78",
        path,
    ]);
    if (convert.exitCode !== 0) {
        throw new Error(new TextDecoder().decode(convert.stderr));
    }
}

/** Upload one prepared event batch and attach its public object keys. */
async function upload(slug: string, photos: PreparedPhoto[]) {
    const images = await Promise.all(
        photos.map(async (photo) => {
            // publish the exact optimized bytes under their stable hash
            const key = await objectKey(`events/${slug}`, photo.path);
            const thumbnailKey = await objectKey(`events/${slug}/thumbnails`, photo.thumbnailPath);
            await Promise.all([
                r2([
                    "object",
                    "put",
                    `${bucket}/${key}`,
                    "--file",
                    photo.path,
                    "--content-type",
                    "image/webp",
                    "--cache-control",
                    cacheControl,
                    "--remote",
                    "--force",
                ]),
                r2([
                    "object",
                    "put",
                    `${bucket}/${thumbnailKey}`,
                    "--file",
                    photo.thumbnailPath,
                    "--content-type",
                    "image/webp",
                    "--cache-control",
                    cacheControl,
                    "--remote",
                    "--force",
                ]),
            ]);

            return {
                alt: photo.alt,
                caption: photo.caption,
                height: photo.height,
                key,
                position: photo.position,
                thumbnailKey,
                width: photo.width,
            };
        }),
    );

    // commit the complete gallery before removing obsolete objects
    const result = convex<{ removedKeys: string[] }>("media:attachEventBatch", { images, slug });
    await Promise.all(
        result.removedKeys.map((key) => r2(["object", "delete", `${bucket}/${key}`, "--remote"])),
    );
}

/** Build one content-addressed R2 object key. */
async function objectKey(namespace: string, path: string) {
    // hash the exact bytes served to clients
    const bytes = await Bun.file(path).arrayBuffer();
    const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

    return `${namespace}/${digest}.webp`;
}

/** Run one remote R2 command and surface its complete failure. */
async function r2(args: string[]) {
    const command = ["bunx", "wrangler", "r2", ...args];
    const child = Bun.spawn(command, {
        cwd: `${import.meta.dir}/..`,
        stderr: "pipe",
        stdout: "ignore",
    });
    const exitCode = await child.exited;
    if (exitCode !== 0) {
        throw new Error(await new Response(child.stderr).text());
    }
}

/** Run one internal Convex function and parse its result. */
function convex<Result>(name: string, args: object): Result {
    const command = ["bunx", "convex", "run", name, JSON.stringify(args)];
    if (isProduction) {
        command.push("--prod");
    }
    const result = Bun.spawnSync(command, { cwd: `${import.meta.dir}/..` });
    if (result.exitCode !== 0) {
        throw new Error(new TextDecoder().decode(result.stderr));
    }

    return JSON.parse(new TextDecoder().decode(result.stdout).trim()) as Result;
}
