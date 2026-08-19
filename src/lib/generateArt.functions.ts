import { createServerFn } from "@tanstack/react-start";
import { artInputSchema, generateArtResult } from "./generateArt.server";

export const generateArt = createServerFn({ method: "POST" })
  .inputValidator((input) => artInputSchema.parse(input))
  .handler(async ({ data }) => generateArtResult(data));
