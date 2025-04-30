import { google } from "@ai-sdk/google";

const modelId = "gemini-2.0-flash-lite";

export const model = google(modelId);
