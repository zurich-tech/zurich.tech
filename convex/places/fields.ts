import { v } from "convex/values";

/** City and country shared by addresses and vacancy locations. */
export const localityFields = { locality: v.string(), countryCode: v.string() };
