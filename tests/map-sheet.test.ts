import { expect, test } from "bun:test";
import { sheetHeights, sheetPosition } from "../src/map/sheet";

test("test_fit_sheet_positions_to_the_viewport_and_controls", () => {
    expect(sheetHeights(800, 200)).toEqual([200, 480, 788]);
    expect(sheetHeights(300, 200)).toEqual([200, 200, 288]);
    expect(sheetHeights(150, 200)).toEqual([138, 138, 138]);
});

test("test_snap_drags_without_skipping_nearby_positions", () => {
    const heights = [200, 480, 788];
    expect(sheetPosition(heights, 200, -80)).toBe(1);
    expect(sheetPosition(heights, 480, -80)).toBe(2);
    expect(sheetPosition(heights, 788, 80)).toBe(1);
    expect(sheetPosition(heights, 480, 80)).toBe(0);
    expect(sheetPosition(heights, 200, -500)).toBe(2);
    expect(sheetPosition(heights, 480, 3)).toBe(1);
    expect(sheetPosition(heights, 200, 100)).toBe(0);
    expect(sheetPosition(heights, 788, -100)).toBe(2);
});
