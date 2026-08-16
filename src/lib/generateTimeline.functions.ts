import { createServerFn } from "@tanstack/react-start";
import { generateTimelineResult, timelineInputSchema } from "./generateTimeline.server";

export const generateTimeline = createServerFn({ method: "POST" })
  .inputValidator((input) => timelineInputSchema.parse(input))
  .handler(async ({ data }) => generateTimelineResult(data));
