import sharp from "sharp";

// fit the square mark inside the maskable icon's central 80 percent safe circle
const logo = await sharp(new URL("../../src/components/assets/logo.svg", import.meta.url).pathname)
    .resize(280, 280)
    .png()
    .toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#ffffff" } })
    .composite([{ input: logo, left: 116, top: 116 }])
    .png()
    .toFile(new URL("../../public/icon-maskable.png", import.meta.url).pathname);
