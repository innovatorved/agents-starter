import {
  generateRandomUUID,
  getSessionCookie,
  processChatsData,
} from "./lib/utils";
import { getAgentByName, type Schedule } from "agents";

import { getAuthPolicies } from "./lib/policy";

import { unstable_getSchedulePrompt } from "agents/schedule";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
  createDataStreamResponse,
  streamText,
  type StreamTextOnFinishCallback,
} from "ai";
import { AsyncLocalStorage } from "node:async_hooks";
import { executions, tools } from "@/tools";
import { processToolCalls } from "./utils";
import { createChat, getChatById, getChatsByUserId } from "./lib/db";
import {
  checkAuthenticatedUserRoute,
  loginUserRoute,
  logoutUserRoute,
  registerUserRoute,
} from "./routes/auth";
import { model } from "./lib/ai";

export const agentContext = new AsyncLocalStorage<Chat>();

export class Chat extends AIChatAgent<Env> {
  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>) {
    return agentContext.run(this, async () => {
      const dataStreamResponse = createDataStreamResponse({
        execute: async (dataStream) => {
          const processedMessages = await processToolCalls({
            messages: this.messages,
            dataStream,
            tools,
            executions,
          });

          const result = streamText({
            model: model,
            system: `You are a helpful assistant...
${unstable_getSchedulePrompt({ date: new Date() })}
If the user asks to schedule a task, use the schedule tool to schedule the task.`,
            messages: processedMessages,
            tools,
            onFinish,
            onError: (error) => console.error("Error while streaming:", error),
            maxSteps: 10,
          });
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
        id: generateRandomUUID(),
        role: "user",
        content: `Running scheduled task: ${description}`,
        createdAt: new Date(),
      },
    ]);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // 1. Healthcheck for API key
    if (url.pathname === "/check-open-ai-key") {
      const hasOpenAIKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      return Response.json({ success: hasOpenAIKey });
    }

    // 2. Auth - Me
    if (url.pathname === "/auth/me") {
      return await checkAuthenticatedUserRoute(request, env);
    }

    // 3. Auth - Logout
    if (url.pathname === "/auth/logout") {
      return logoutUserRoute(request, env);
    }

    // 4. Auth - Signup
    if (url.pathname === "/auth/signup") {
      return await registerUserRoute(request, env);
    }

    // 5. Auth - Login
    if (url.pathname === "/auth/login") {
      return await loginUserRoute(request, env);
    }

    if (url.pathname === "/auth/policy") {
      const policies = await getAuthPolicies(env);
      return Response.json(policies);
    }

    // 6. -- "Authenticated" part of the app --
    let userId = "no_user";
    const sess = getSessionCookie(request);
    if (sess) {
      try {
        const session = JSON.parse(atob(sess));
        if (session.userId) userId = session.userId;
      } catch {}
    }

    // 7. Chats: only show for logged-in users
    if (url.pathname === "/api/chats") {
      if (userId === "no_user") return Response.json([], { status: 401 });

      const results = await getChatsByUserId(env, userId);
      const chats = processChatsData(results);

      return Response.json(chats);
    }

    // 8. Create chat if not present (auto)
    const title = request.headers.get("title") || "title";
    const chatId =
      request.headers.get("chatId") || url.searchParams.get("_pk") || "no_user";
    if (userId !== "no_user" && chatId !== "no_user") {
      // create chat if missing
      const result = await getChatById(env, chatId);
      if (!result) {
        await createChat(env, userId, chatId, title);
      }
    }

    // 9. Chat agent handoff
    if (userId === "no_user")
      return Response.json({ error: "Not authenticated" }, { status: 401 });

    let namedAgent = getAgentByName<Env, Chat>(env.Chat, chatId);
    let namedResp = (await namedAgent).fetch(request);
    return namedResp;
  },
} satisfies ExportedHandler<Env>;
