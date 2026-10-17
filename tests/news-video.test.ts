import { expect, test } from "bun:test";
import { videoEmbed } from "../convex/news/video";

test("resolve hosted news videos without loading tracking parameters", () => {
    expect(videoEmbed("https://www.youtube.com/watch?v=L-v83ikx2-k&feature=share")).toBe(
        "https://www.youtube-nocookie.com/embed/L-v83ikx2-k?playsinline=1&autoplay=1",
    );
    expect(videoEmbed("https://youtu.be/L-v83ikx2-k")).toBe(
        "https://www.youtube-nocookie.com/embed/L-v83ikx2-k?playsinline=1&autoplay=1",
    );
    expect(videoEmbed("https://vimeo.com/1226513141")).toBe(
        "https://player.vimeo.com/video/1226513141?dnt=1&autoplay=1",
    );
    expect(videoEmbed("https://player.vimeo.com/video/123?h=abc123&tracking=yes")).toBe(
        "https://player.vimeo.com/video/123?h=abc123&dnt=1&autoplay=1",
    );
    expect(videoEmbed("https://example.com/demo.mp4")).toBeUndefined();
    expect(videoEmbed("https://youtube.com.example.com/demo.mp4")).toBeUndefined();
    expect(() => videoEmbed("https://youtube.com/watch?v=bad")).toThrow(
        "Enter a YouTube video URL.",
    );
    expect(() => videoEmbed("https://vimeo.com/channels/staffpicks")).toThrow(
        "Enter a Vimeo video URL.",
    );
});
