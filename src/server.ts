import {
  getAgentByName,
  routeAgentRequest,
  type AgentNamespace,
  type Schedule,
} from "agents";

import { unstable_getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  createDataStreamResponse,
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
} from "ai";
import { google } from "@ai-sdk/google";

import { processToolCalls } from "./utils";
import { tools, executions } from "./tools";
import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "cloudflare:workers";
import { getCookieValue } from "./lib/utils";
import { createRemoteJWKSet, jwtVerify } from "jose";

const model = google("gemini-2.0-flash");

interface Env {
  Chat: AgentNamespace<Chat>;
}

// we use ALS to expose the agent context to the tools
export const agentContext = new AsyncLocalStorage<Chat>();
/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages and manages the response stream
   * @param onFinish - Callback function executed when streaming completes
   */

  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>) {
    // Create a streaming response that handles both text and tool outputs
    return agentContext.run(this, async () => {
      const dataStreamResponse = createDataStreamResponse({
        execute: async (dataStream) => {
          // Process any pending tool calls from previous messages
          // This handles human-in-the-loop confirmations for tools
          const processedMessages = await processToolCalls({
            messages: this.messages,
            dataStream,
            tools,
            executions,
          });

          // Stream the AI response using GPT-4
          const result = streamText({
            model,
            system: `You are a helpful assistant that can do various tasks...

${unstable_getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.
`,
            messages: processedMessages,
            tools,
            onFinish,
            onError: (error) => {
              console.error("Error while streaming:", error);
            },
            maxSteps: 10,
          });

          // Merge the AI response stream with tool execution outputs
          result.mergeIntoDataStream(dataStream);
        },
      });

      return dataStreamResponse;
    });
  }
  async executeTask(description: string, task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        content: `Running scheduled task: ${description}`,
        createdAt: new Date(),
      },
    ]);
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const cookieHeader = request.headers.get("Cookie") || "";
    const token = getCookieValue(cookieHeader, "CF_Authorization");

    const Cloudflare_AUD = process.env.POLICY_AUD;
    const TEAM_DOMAIN = process.env.TEAM_DOMAIN;
    const CERTS_URL = `${TEAM_DOMAIN}/cdn-cgi/access/certs`;
    let userId = "no_user";

    try {
      const JWKS = createRemoteJWKSet(new URL(CERTS_URL));

      const result = await jwtVerify(token!, JWKS, {
        issuer: TEAM_DOMAIN,
        audience: Cloudflare_AUD,
      });
      userId = result.payload.sub || "no_user";
    } catch (error) {
      console.error("Error verifying token:", error);
    }

    console.log({
      url,
      token,
      TEAM_DOMAIN,
      CERTS_URL,
      userId,
    });

    if (url.pathname === "/check-open-ai-key") {
      const hasOpenAIKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      return Response.json({
        success: hasOpenAIKey,
      });
    }
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error(
        "GOOGLE_GENERATIVE_AI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
      );
    }

    const durableObjectId = env.Chat.idFromName("userId");
    const agentStub = env.Chat.get(durableObjectId);

    // return (
    //   // Route the request to our agent or return 404 if not found
    //   (await routeAgentRequest(request, env)) ||
    //   new Response("Not found", { status: 404 })
    // );
    //
    let namedAgent = getAgentByName<Env, Chat>(env.Chat, userId);
    // Pass the incoming request straight to your Agent
    let namedResp = (await namedAgent).fetch(request);
    return namedResp;
  },
} satisfies ExportedHandler<Env>;
