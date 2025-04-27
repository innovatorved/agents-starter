# Cloudflare Chat App

A modern chat application powered by the Cloudflare stack.

## Overview

This project includes a robust, real-time chat application, leveraging **Cloudflare Durable Objects** to manage chat state and **Cloudflare D1** to store chat history by chat IDs. User authentication is enforced with **Cloudflare Zero Trust Security** to ensure only authorized users may access the service.

The application is hosted at: **https://chat.vedgupta.in**

## Features

- **Real-Time Chat:** Fast and scalable messaging using Cloudflare Durable Objects for chat room state management.
- **Chat History:** Persists chat messages and history in Cloudflare D1 for reliable retrieval and record-keeping.
- **User Authentication:** Secured by Cloudflare Zero Trust, allowing only verified and authenticated users.
- **Seamless Hosting:** Hosted globally via Cloudflare’s edge infrastructure at [chat.vedgupta.in](https://chat.vedgupta.in).
- **High Performance:** Low-latency by design, utilizing Cloudflare’s edge and serverless platform.

## Technical Stack

- **Frontend:** (Describe your UI framework here, e.g., React.js, Vitejs)
- **Backend/Serverless:** Cloudflare Workers
- **State Management:** Cloudflare Durable Objects
- **Database:** Cloudflare D1 (serverless DB)
- **Authentication:** Cloudflare Zero Trust Security

## How it Works

1. **Stateful Chat:** Each chat room is backed by a Durable Object to manage real-time messages and room presence.
2. **Persistent Storage:** All messages are saved to Cloudflare D1, organized by chat ID for efficient retrieval.
3. **Authentication Flow:**
    - Users are required to log in using Cloudflare Zero Trust authentication before gaining access to chat rooms.
    - Session management and user identities are securely managed by Cloudflare.
4. **History & Retrieval:**
    - Chat history is retrieved from D1 when users enter a room, and new messages are stored instantly.

## Prerequisites

- Cloudflare account
- Access to Cloudflare Workers, Durable Objects, D1, and Zero Trust features

## Getting Started

1. **Clone the repository**
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Configure Cloudflare environment** (set up Vars, D1 DB, Durable Objects, etc.)
4. **Configure Cloudflare Zero Trust policies**
5. **Deploy:**
   ```bash
   npx wrangler deploy
   ```

## Hosting

- The live chat app is hosted at [https://chat.vedgupta.in](https://chat.vedgupta.in).

## Attribution

This project is built on top of [cloudflare/agents-starter](https://github.com/cloudflare/agents-starter) – many thanks to the original authors for their foundational work and open-source contribution.

_Last modified by **Ved Gupta** – [vedgupta.in](https://vedgupta.in)_
