import { getCookieValue } from "./lib/utils";
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

import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "cloudflare:workers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { executions, tools } from "@/tools";
import { processToolCalls } from "./utils";

const model = google("gemini-2.0-flash");

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

    const cookieHeader = request.headers.get("Cookie") || "";
    const title = request.headers.get("title") || "title";
    const token = getCookieValue(cookieHeader, "CF_Authorization");

    const Cloudflare_AUD = process.env.POLICY_AUD;
    const TEAM_DOMAIN = process.env.TEAM_DOMAIN;
    const CERTS_URL = `${TEAM_DOMAIN}/cdn-cgi/access/certs`;
    let userId = "no_user";
    let userEmail = null;

    const chatId =
      request.headers.get("chatId") || url.searchParams.get("_pk") || "no_user";

    try {
      const JWKS = createRemoteJWKSet(new URL(CERTS_URL));

      const result = await jwtVerify(token!, JWKS, {
        issuer: TEAM_DOMAIN,
        audience: Cloudflare_AUD,
      });
      userId = result.payload.sub || "no_user";
      userEmail = result.payload;
    } catch (error) {
      console.error("Error verifying token:", error);
    }

    if (url.pathname === "/api/chats") {
      const { results } = await env.DB.prepare(
        "SELECT chatId, title FROM Chats WHERE userId = ? ORDER BY createdTime DESC"
      )
        .bind(userId)
        .all();

      // Format the result into the array you want
      const chats =
        results.map((chat) => ({
          chatId: chat.chatId,
          title: chat.title,
        })) ?? [];

      return Response.json(chats);
    }

    console.log({
      url,
      token,
      TEAM_DOMAIN,
      CERTS_URL,
      userId,
      chatId,
      title,
    });

    if (userId !== "no_user") {
      // Fetch user data from the database
      const result = await env.DB.prepare(
        "SELECT userId FROM Users WHERE userId = ?"
      )
        .bind(userId)
        .first();

      // Step 2: If user does NOT exist, insert them
      if (!result) {
        await env.DB.prepare("INSERT INTO Users (userId, email) VALUES (?, ?)")
          .bind(userId, userEmail)
          .run();
        console.log("User created successfully.");
      }
    }

    if (userId !== "no_user" && chatId !== "no_user") {
      const result = await env.DB.prepare(
        "SELECT chatId FROM Chats WHERE chatId = ?"
      )
        .bind(chatId)
        .first();

      // Step 2: If chat does NOT exist, insert it
      if (!result) {
        await env.DB.prepare(
          "INSERT INTO Chats (chatId, userId, title) VALUES (?, ?, ?)"
        )
          .bind(chatId, userId, title)
          .run();

        console.log("Chat created successfully.");
      }
    }

    let namedAgent = getAgentByName<Env, Chat>(env.Chat, chatId);
    // Pass the incoming request straight to your Agent
    let namedResp = (await namedAgent).fetch(request);
    return namedResp;
  },
} satisfies ExportedHandler<Env>;
