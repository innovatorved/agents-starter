import { useState } from "react";
import { Button } from "@/components/button/Button";
import { Input } from "@/components/input/Input";
import { Card } from "@/components/card/Card";

export default function Login({
  onLogin,
  setView,
}: {
  onLogin: () => void;
  setView: (v: "login" | "signup") => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const resp = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (data.success) {
      onLogin();
    } else {
      setError(data.message || "Login failed.");
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen w-full">
      <Card className="p-6 w-full max-w-sm">
        <h2 className="mb-4 text-lg font-bold text-center">Sign in</h2>
        <form onSubmit={handleLogin}>
          <Input
            placeholder="Email"
            value={email}
            onValueChange={setEmail}
            className="mb-3 w-full max-w-sm"
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onValueChange={setPassword}
            className="mb-3 w-full max-w-sm"
          />
          <Button variant="primary" className="w-full" type="submit">
            Login
          </Button>
        </form>
        <div className="mt-4 text-sm text-center">
          Don't have an account?{" "}
          <button
            className="text-[#F48120] hover:underline"
            type="button"
            onClick={() => setView("signup")}
          >
            Sign up
          </button>
        </div>
        {error && <div className="text-red-500 mt-3 text-xs">{error}</div>}
      </Card>
      {/* Attribution Footer */}
      <div className="border-t border-neutral-300 dark:border-neutral-800 py-2 px-4 text-xs text-center text-muted-foreground w-full max-w-sm">
        Built by Ved Gupta with Cloudflare Stack.
        <br />
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
  );
}
