import {
  getAgentByName,
  routeAgentRequest,
  type AgentNamespace,
  type Schedule,
} from "agents";

import { getCookieValue } from "./lib/utils";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Chat, agentContext } from "./lib/agent";

export { Chat, agentContext };

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

    const chatId =
      request.headers.get("chatId") || url.searchParams.get("_pk") || "no_user";

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

    if (url.pathname === "/api/chats") {
      const { results } = await env.DB.prepare(
        "SELECT chatId, title FROM Chats WHERE userId = ? ORDER BY createdTime DESC"
      )
        .bind(userId)
        .all();

      // Format the result into the array you want
      const chats = results.map((chat) => ({
        chatId: chat.chatId,
        title: chat.title,
      }));

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
        await env.DB.prepare("INSERT INTO Users (userId) VALUES (?)")
          .bind(userId)
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
