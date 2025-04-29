# Cloudflare Chat App

A modern chat application powered by the Cloudflare stack, offering secure, real-time messaging and persistent chat history.

Live at: **[https://chat.vedgupta.in](https://chat.vedgupta.in)**

---

## Features

- **Real-Time Chat:** Fast messaging with Cloudflare Durable Objects for stateful chat rooms.
- **Chat History:** Messages stored in Durable object and Cloudflare D1 for reliable retrieval by chat ID.
- **User Authentication:** Only authorized users can access chat rooms via Custom Authentication.
- **Edge Hosting:** Global, low-latency performance on Cloudflare’s edge network.

## Technical Stack

- **Frontend:** React, Vite.
- **Serverless Backend:** Cloudflare Workers
- **State Management:** Cloudflare Durable Objects
- **Database:** Cloudflare D1 (serverless SQLite)
- **Caching:** Cloudflare KV for caching and metadata storage
- **Authentication:** Custom Authentication Security

---

## How It Works

1. **Messages** are saved to D1, organized by chat ID.
2. **Authentication:** Users must log in using Custom Authentication before chat access.
3. **Chat history** is loaded from D1 when entering a room; new messages are stored instantly.
4. **KV bindings** are used for caching and storing room/user metadata.

---

## Prerequisites

- Cloudflare account
- Access to Cloudflare Workers, Durable Objects, D1, and Custom Authentication

---

## Getting Started

Follow these steps **in order** to get your own deployment running:

### 1. Clone the repository

```bash
git clone https://github.com/innovatorved/chat-cloudflare-stack.git
cd chat-cloudflare-stack
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up your Cloudflare environment

- Configure your `wrangler.jsonc` with proper bindings (D1, Durable Objects, KV, etc.).
- Set up environment variables as needed.

**If your app uses the Google Generative AI API, make sure to add your API key to Cloudflare secrets:**

```bash
npx wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
```

### 4. Create the D1 Database

**Deploy your D1 database schema locally (for development):**

```bash
npx wrangler d1 execute chat-user-id-db --local --file=./schema.sql
```

**Or push your schema to Cloudflare (production):**

```bash
npx wrangler d1 execute chat-user-id-db --remote --file=./schema.sql
```

### 5. Create your KV Namespace

Used for caching and metadata:

```bash
npx wrangler kv namespace create CACHE_CHAT
```

### 6. Configure Authentication

Authentication policies are defined in the `auth-policies.json` file.
Ensure this file includes your desired password and login policies, and that it is uploaded to Cloudflare KV as shown above.

Custom Authentication will enforce the settings from `auth-policies.json` during user registration and login.

**Upload your authentication policies (for development):**

```bash
npx wrangler kv key put --binding=CACHE_CHAT auth-policies "$(cat auth-policies.json) ---local"
```

**Upload your authentication policies:**

```bash
npx wrangler kv key put --binding=CACHE_CHAT auth-policies "$(cat auth-policies.json)"
```

---

## Deployment

Once everything is configured:

```bash
npm run deploy
```

---

## Database Structure

- **Durable Objects:** For real-time chat room state.
- **Cloudflare D1:** For persistent user/message history, organized by chat ID.
- **KV:** For caching queries and storing ephemeral room/user metadata.

---

## Hosting

- The application is live at [https://chat.vedgupta.in](https://chat.vedgupta.in).

---

## Attribution

Built atop [cloudflare/agents-starter](https://github.com/cloudflare/agents-starter).
_Last modified by **Ved Gupta** – [vedgupta.in](https://vedgupta.in)_
