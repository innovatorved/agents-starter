import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Input } from "@/components/input/Input";
import { Avatar } from "@/components/avatar/Avatar";
import Login from "@/components/auth/Login";
import SignUp from "@/components/auth/Signup";
import { ArrowLeft, ChatText, Plus } from "@phosphor-icons/react";
import Chat from "./chat";
import { formatRelativeTime, generateRandomUUID } from "./lib/utils";
import { Toggle } from "./components/toggle/Toggle";

interface ChatInterface {
  chatId: string;
  title: string;
  createdTime: string;
}

export default function ChatsView() {
  const [chats, setChats] = useState<Array<ChatInterface>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [creatingChat, setCreatingChat] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState("");
  const [lastCreatedChatTitle, setLastCreatedChatTitle] = useState(""); // for passing to Chat component

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    // Check localStorage first, default to dark if not found
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "dark";
  });

  const [authenticated, setAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<"login" | "signup">("login");

  // Auth check
  useEffect(() => {
    fetch("/auth/me")
      .then(
        (r) =>
          r.json() as unknown as {
            authenticated: boolean;
          },
      )
      .then((data) => setAuthenticated(!!data.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    // Apply theme class on mount and when theme changes
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }

    // Save theme preference to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const fetchChats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/chats");
      if (response.status === 401) {
        setAuthenticated(false);
        setAuthView("login");
        return;
      }
      const data = (await response.json()) as Array<ChatInterface>;
      setChats(data);
      setError(null);
    } catch (err) {
      setError("Failed to load chats. Please try again.");
      console.error("Error fetching chats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = async () => {
    await fetch("/auth/logout");
    setAuthenticated(false);
    setAuthView("login");
    setChats([]);
    setLoading(true);
    setError(null);
    setSelectedChat(null);
    setCreatingChat(false);
    setNewChatTitle("");
    setLastCreatedChatTitle("");
  };

  const handleLogin = async () => {
    setAuthenticated(true);
    setChats([]);
    setError(null);
    setSelectedChat(null);
    setCreatingChat(false);
    setNewChatTitle("");
    setLastCreatedChatTitle("");
    await fetchChats(); // Immediately fetch after login
  };

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Auth screens
  if (!authenticated) {
    if (authView === "signup")
      return <SignUp onSignUp={handleLogin} setView={setAuthView} />;
    return <Login onLogin={handleLogin} setView={setAuthView} />;
  }

  // UI actions
  const openChat = (chatId: string) => {
    setSelectedChat(chatId);
    setLastCreatedChatTitle(""); // Reset for existing chats
  };

  const startNewChat = () => {
    setCreatingChat(true);
  };

  const createChat = () => {
    if (!newChatTitle.trim()) return;
    const chatId = generateRandomUUID();
    setSelectedChat(chatId);
    setLastCreatedChatTitle(newChatTitle);
    setCreatingChat(false);
    setNewChatTitle("");
  };

  const cancelCreateChat = () => {
    setCreatingChat(false);
    setNewChatTitle("");
  };

  const goBackToList = async () => {
    setSelectedChat(null);
    setLastCreatedChatTitle("");
    await fetchChats();
  };

  // -------------- Render ---------------

  // Chat detail view
  if (selectedChat) {
    const chatObj = chats.find((chat) => chat.chatId === selectedChat);
    // Prefer manually set title if this is a brand new chat (not in chats array yet)
    const title = chatObj?.title || lastCreatedChatTitle || "New Chat";
    return (
      <div className="h-full w-full flex flex-col">
        <div className="px-4 py-3 border-0 flex items-center gap-3 sticky top-0 z-10">
          <Button
            variant="ghost"
            size="md"
            shape="square"
            className="rounded-full h-9 w-9"
            onClick={goBackToList}
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="flex-1">
            <h2 className="font-semibold text-base">{title}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <Chat
            chatId={selectedChat}
            title={title}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="h-[100vh] w-full p-4 flex justify-center items-center bg-fixed overflow-hidden">
      <div className="h-[calc(100vh-5rem)] md:h-[calc(100vh-4rem)] w-full mx-auto max-w-lg md:max-w-3xl flex flex-col shadow-xl rounded-md overflow-hidden relative border border-neutral-300 dark:border-neutral-800">
        <div className="px-4 py-3 border-b border-neutral-300 dark:border-neutral-800 flex items-center gap-3 sticky top-0 z-10">
          <div className="flex items-center justify-center h-8 w-8">
            <svg
              width="28px"
              height="28px"
              className="text-[#F48120]"
              data-icon="agents"
            >
              <title>Cloudflare Agents</title>
              <symbol id="ai:local:agents" viewBox="0 0 80 79">
                <path
                  fill="currentColor"
                  d="M69.3 39.7c-3.1 0-5.8 2.1-6.7 5H48.3V34h4.6l4.5-2.5c1.1.8 2.5 1.2 3.9 1.2 3.8 0 7-3.1 7-7s-3.1-7-7-7-7 3.1-7 7c0 .9.2 1.8.5 2.6L51.9 30h-3.5V18.8h-.1c-1.3-1-2.9-1.6-4.5-1.9h-.2c-1.9-.3-3.9-.1-5.8.6-.4.1-.8.3-1.2.5h-.1c-.1.1-.2.1-.3.2-1.7 1-3 2.4-4 4 0 .1-.1.2-.1.2l-.3.6c0 .1-.1.1-.1.2v.1h-.6c-2.9 0-5.7 1.2-7.7 3.2-2.1 2-3.2 4.8-3.2 7.7 0 .7.1 1.4.2 2.1-1.3.9-2.4 2.1-3.2 3.5s-1.2 2.9-1.4 4.5c-.1 1.6.1 3.2.7 4.7s1.5 2.9 2.6 4c-.8 1.8-1.2 3.7-1.1 5.6 0 1.9.5 3.8 1.4 5.6s2.1 3.2 3.6 4.4c1.3 1 2.7 1.7 4.3 2.2v-.1q2.25.75 4.8.6h.1c0 .1.1.1.1.1.9 1.7 2.3 3 4 4 .1.1.2.1.3.2h.1c.4.2.8.4 1.2.5 1.4.6 3 .8 4.5.7.4 0 .8-.1 1.3-.1h.1c1.6-.3 3.1-.9 4.5-1.9V62.9h3.5l3.1 1.7c-.3.8-.5 1.7-.5 2.6 0 3.8 3.1 7 7 7s7-3.1 7-7-3.1-7-7-7c-1.5 0-2.8.5-3.9 1.2l-4.6-2.5h-4.6V48.7h14.3c.9 2.9 3.5 5 6.7 5 3.8 0 7-3.1 7-7s-3.1-7-7-7m-7.9-16.9c1.6 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.4-3 3-3m0 41.4c1.6 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.4-3 3-3M44.3 72c-.4.2-.7.3-1.1.3-.2 0-.4.1-.5.1h-.2c-.9.1-1.7 0-2.6-.3-1-.3-1.9-.9-2.7-1.7-.7-.8-1.3-1.7-1.6-2.7l-.3-1.5v-.7q0-.75.3-1.5c.1-.2.1-.4.2-.7s.3-.6.5-.9c0-.1.1-.1.1-.2.1-.1.1-.2.2-.3s.1-.2.2-.3c0 0 0-.1.1-.1l.6-.6-2.7-3.5c-1.3 1.1-2.3 2.4-2.9 3.9-.2.4-.4.9-.5 1.3v.1c-.1.2-.1.4-.1.6-.3 1.1-.4 2.3-.3 3.4-.3 0-.7 0-1-.1-2.2-.4-4.2-1.5-5.5-3.2-1.4-1.7-2-3.9-1.8-6.1q.15-1.2.6-2.4l.3-.6c.1-.2.2-.4.3-.5 0 0 0-.1.1-.1.4-.7.9-1.3 1.5-1.9 1.6-1.5 3.8-2.3 6-2.3q1.05 0 2.1.3v-4.5c-.7-.1-1.4-.2-2.1-.2-1.8 0-3.5.4-5.2 1.1-.7.3-1.3.6-1.9 1s-1.1.8-1.7 1.3c-.3.2-.5.5-.8.8-.6-.8-1-1.6-1.3-2.6-.2-1-.2-2 0-2.9.2-1 .6-1.9 1.3-2.6.6-.8 1.4-1.4 2.3-1.8l1.8-.9-.7-1.9c-.4-1-.5-2.1-.4-3.1s.5-2.1 1.1-2.9q.9-1.35 2.4-2.1c.9-.5 2-.8 3-.7.5 0 1 .1 1.5.2 1 .2 1.8.7 2.6 1.3s1.4 1.4 1.8 2.3l4.1-1.5c-.9-2-2.3-3.7-4.2-4.9q-.6-.3-.9-.6c.4-.7 1-1.4 1.6-1.9.8-.7 1.8-1.1 2.9-1.3.9-.2 1.7-.1 2.6 0 .4.1.7.2 1.1.3V72zm25-22.3c-1.6 0-3-1.3-3-3 0-1.6 1.3-3 3-3s3 1.3 3 3c0 1.6-1.3 3-3 3"
                />
              </symbol>
              <use href="#ai:local:agents" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-base">Chat List</h2>
          </div>
          <Button
            variant="primary"
            size="md"
            shape="square"
            className="rounded-full h-9 w-9"
            onClick={startNewChat}
          >
            <Plus size={20} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await fetch("/auth/logout");
              setAuthenticated(false);
              setAuthView("login");
            }}
          >
            Logout
          </Button>
        </div>

        {/* Create Chat Modal */}
        {creatingChat && (
          <div className="p-4 border-b border-neutral-300 dark:border-neutral-800">
            <div className="mb-3">
              <h3 className="font-medium text-sm mb-2">Create New Chat</h3>
              <Input
                placeholder="Enter chat title..."
                value={newChatTitle}
                onValueChange={setNewChatTitle}
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={cancelCreateChat}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={createChat}
                disabled={!newChatTitle.trim()}
              >
                Create
              </Button>
            </div>
          </div>
        )}

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center py-4">Loading chats...</div>
          ) : error ? (
            <div className="text-center py-4 text-red-500">{error}</div>
          ) : chats.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Card className="p-6 max-w-md mx-auto bg-neutral-100 dark:bg-neutral-900">
                <div className="text-center space-y-4">
                  <div className="bg-[#F48120]/10 text-[#F48120] rounded-full p-3 inline-flex">
                    <ChatText size={24} />
                  </div>
                  <h3 className="font-semibold text-lg">No Chats Yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Start a new conversation by clicking the + button.
                  </p>
                  <div className="text-xs text-muted-foreground pt-2 border-t border-neutral-200 dark:border-neutral-800 mt-2">
                    Built by Ved Gupta with Cloudflare Stack
                    <br />
                    <a
                      href="https://github.com/innovatorved/chat-cloudflare-tools"
                      className="text-[#F48120] hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      GitHub: innovatorved/chat-cloudflare-tools
                    </a>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            chats.map((chat) => (
              <Card
                key={chat.chatId}
                className="p-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-900 transition"
                onClick={() => openChat(chat.chatId)}
              >
                <div className="flex items-center gap-3">
                  <Avatar username={chat.title.charAt(0)} />
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{chat.title}</h3>
                  </div>
                  <div className="ml-2 text-xs text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(new Date(chat.createdTime))}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
        {/* Attribution Footer */}
        <div className="border-t border-neutral-300 dark:border-neutral-800 py-2 px-4 text-xs text-center text-muted-foreground">
          Built by Ved Gupta with Cloudflare Stack.
          <a
            href="https://github.com/innovatorved/chat-cloudflare-tools"
            className="ml-1 text-[#F48120] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub: innovatorved/chat-cloudflare-tools
          </a>
        </div>
      </div>
    </div>
  );
}
