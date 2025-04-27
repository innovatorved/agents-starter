import { getSessionCookie, setSessionCookie } from "./lib/utils";
import { getAgentByName, type Schedule } from "agents";

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
import { executions, tools } from "@/tools";
import { hashPassword, verifyPassword } from "./lib/crypto-utils";
import { processToolCalls } from "./utils";

const model = google("gemini-2.0-flash");
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
            model,
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
        id: generateId(),
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
      const sess = getSessionCookie(request);
      if (sess) {
        try {
          const session = JSON.parse(atob(sess));
          if (session.userId) return Response.json({ authenticated: true });
        } catch {}
      }
      return Response.json({ authenticated: false });
    }

    // 3. Auth - Logout
    if (url.pathname === "/auth/logout") {
      const resp = Response.json({ success: true });
      resp.headers.set(
        "Set-Cookie",
        "session=; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
      );
      return resp;
    }

    // 4. Auth - Signup
    if (url.pathname === "/auth/signup") {
      if (request.method !== "POST")
        return new Response("Method Not Allowed", { status: 405 });
      const { email, password } = (await request.json()) as {
        email: string;
        password: string;
      };
      if (!email || !password)
        return Response.json({
          success: false,
          message: "Both fields required",
        });

      // check if exists
      const exists = await env.DB.prepare("SELECT 1 FROM Users WHERE email = ?")
        .bind(email)
        .first();
      if (exists)
        return Response.json({ success: false, message: "Already registered" });

      const { salt, hash } = await hashPassword(password);
      const userId = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO Users (userId, email, passwordHash, passwordSalt) VALUES (?, ?, ?, ?)"
      )
        .bind(userId, email, hash, salt)
        .run();

      const resp = Response.json({ success: true });
      resp.headers.set("Set-Cookie", setSessionCookie(userId));
      return resp;
    }

    // 5. Auth - Login
    if (url.pathname === "/auth/login") {
      if (request.method !== "POST")
        return new Response("Method Not Allowed", { status: 405 });
      const { email, password } = (await request.json()) as {
        email: string;
        password: string;
      };
      if (!email || !password)
        return Response.json({
          success: false,
          message: "Both fields required",
        });

      const row = await env.DB.prepare(
        "SELECT userId, passwordHash, passwordSalt FROM Users WHERE email = ?"
      )
        .bind(email)
        .first();
      if (!row || !row.passwordHash || !row.passwordSalt)
        return Response.json({
          success: false,
          message: "Invalid credentials",
        });

      const valid = await verifyPassword(
        password,
        row.passwordSalt,
        row.passwordHash
      );
      if (!valid)
        return Response.json({
          success: false,
          message: "Invalid credentials",
        });

      const resp = Response.json({ success: true });
      resp.headers.set("Set-Cookie", setSessionCookie(row.userId));
      return resp;
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

      const { results } = await env.DB.prepare(
        "SELECT chatId, title, createdTime FROM Chats WHERE userId = ? ORDER BY createdTime DESC"
      )
        .bind(userId)
        .all();

      const chats =
        results.map((chat) => ({
          chatId: chat.chatId,
          title: chat.title,
          createdTime: String(chat.createdTime),
        })) ?? [];

      return Response.json(chats);
    }

    // 8. Create chat if not present (auto)
    const title = request.headers.get("title") || "title";
    const chatId =
      request.headers.get("chatId") || url.searchParams.get("_pk") || "no_user";
    if (userId !== "no_user" && chatId !== "no_user") {
      // create chat if missing
      const result = await env.DB.prepare(
        "SELECT chatId FROM Chats WHERE chatId = ?"
      )
        .bind(chatId)
        .first();
      if (!result) {
        await env.DB.prepare(
          "INSERT INTO Chats (chatId, userId, title) VALUES (?, ?, ?)"
        )
          .bind(chatId, userId, title)
          .run();
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
