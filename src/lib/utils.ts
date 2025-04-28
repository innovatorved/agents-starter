import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCookieValue(
  cookieHeader: string,
  key: string
): string | null {
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === key) return value;
  }
  return null;
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000; // in seconds

  if (diff < 60) return "just now";
  if (diff < 3600)
    return `${Math.floor(diff / 60)} minute${Math.floor(diff / 60) === 1 ? "" : "s"} ago`;
  if (diff < 86400)
    return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) === 1 ? "" : "s"} ago`;

  // Is it "yesterday"?
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "yesterday";

  // Otherwise (older): use date in format "MMM d, yyyy"
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function setSessionCookie(userId: string) {
  // Use a signed cookie for production! This is for demo.
  // In production, use a proper session token.
  return `session=${btoa(JSON.stringify({ userId }))}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function getSessionCookie(request: Request): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

export function processChatsData(results: Record<string, unknown>[]) {
  const chats =
    results.map((chat) => ({
      chatId: chat.chatId,
      title: chat.title,
      createdTime: String(chat.createdTime),
    })) ?? [];

  return chats;
}

export function generateRandomUUID(): string {
  return crypto.randomUUID();
}
