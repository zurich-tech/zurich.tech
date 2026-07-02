/** Required route parameter. */
export function routeParam(name: string, value: string | undefined) {
    if (value === undefined) {
        throw new Error(`Missing route parameter: ${name}`);
    }

    return value;
}
