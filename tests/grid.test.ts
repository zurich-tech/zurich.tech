import { expect, test } from "bun:test";
import { csvText, gridRows } from "../src/components/rows";

test("filter and sort all matching grid rows without changing the input", () => {
    const rows = [
        { name: "Beta", count: 12 },
        { name: "Alpha", count: 2 },
        { name: "Gamma", count: 9 },
    ];
    expect(
        gridRows(
            rows,
            " A ",
            (row) => row.name,
            (row) => row.count,
            true,
        ),
    ).toEqual([rows[0], rows[2], rows[1]]);
    expect(
        gridRows(
            rows,
            "",
            (row) => row.name,
            (row) => row.name,
            false,
        ),
    ).toEqual([rows[1], rows[0], rows[2]]);
    expect(
        gridRows(
            rows,
            "missing",
            (row) => row.name,
            (row) => row.name,
            false,
        ),
    ).toEqual([]);
    expect(rows).toEqual([
        { name: "Beta", count: 12 },
        { name: "Alpha", count: 2 },
        { name: "Gamma", count: 9 },
    ]);
});

test("escape exported CSV and neutralise formulas after whitespace", () => {
    expect(
        csvText([
            ["Name", "Email"],
            ['A "name", here', "line\nnext"],
            [" =SUM(1)", "\t@evil"],
            ["+2", "-2"],
            ["normal", ""],
        ]),
    ).toBe(
        '"Name","Email"\r\n"A ""name"", here","line\nnext"\r\n"\' =SUM(1)","\'\t@evil"\r\n"\'+2","\'-2"\r\n"normal",""',
    );
});
