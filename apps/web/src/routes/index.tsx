import { createFileRoute } from "@tanstack/react-router";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";

import { authClient } from "../auth/client";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { data: session, isPending } = authClient.useSession();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(undefined);
    setIsSubmitting(true);

    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, name, password });

    setIsSubmitting(false);

    if (result.error) {
      setMessage(result.error.message ?? "Authentication failed.");
      return;
    }

    setMessage(mode === "sign-in" ? "Signed in." : "Account created.");
  };

  const signOut = async () => {
    setMessage(undefined);
    await authClient.signOut();
  };

  let authPanel: ReactNode;
  if (isPending) {
    authPanel = (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
        Loading session...
      </div>
    );
  } else if (session?.user) {
    authPanel = (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm text-zinc-400">Signed in as</p>
        <p className="mt-1 font-medium">{session.user.email}</p>
        <button
          className="mt-5 rounded-md bg-zinc-100 px-4 py-2 font-medium text-sm text-zinc-950"
          onClick={signOut}
          type="button"
        >
          Sign out
        </button>
      </div>
    );
  } else {
    let submitLabel = "Create account";
    if (isSubmitting) {
      submitLabel = "Working...";
    } else if (mode === "sign-in") {
      submitLabel = "Sign in";
    }

    authPanel = (
      <form
        className="rounded-lg border border-zinc-800 bg-zinc-900 p-5"
        onSubmit={submit}
      >
        <div className="grid grid-cols-2 rounded-md border border-zinc-800 p-1">
          <button
            className={`rounded px-3 py-2 text-sm ${
              mode === "sign-in" ? "bg-zinc-100 text-zinc-950" : "text-zinc-400"
            }`}
            onClick={() => setMode("sign-in")}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`rounded px-3 py-2 text-sm ${
              mode === "sign-up" ? "bg-zinc-100 text-zinc-950" : "text-zinc-400"
            }`}
            onClick={() => setMode("sign-up")}
            type="button"
          >
            Sign up
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {mode === "sign-up" ? (
            <label className="flex flex-col gap-2 text-sm">
              Name
              <input
                aria-label="Name"
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                onChange={(event) => setName(event.currentTarget.value)}
                required
                type="text"
                value={name}
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-2 text-sm">
            Email
            <input
              aria-label="Email"
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Password
            <input
              aria-label="Password"
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              minLength={8}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              type="password"
              value={password}
            />
          </label>
        </div>

        {message ? (
          <p className="mt-4 text-sm text-zinc-400">{message}</p>
        ) : null}

        <button
          className="mt-5 w-full rounded-md bg-zinc-100 px-4 py-2 font-medium text-sm text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {submitLabel}
        </button>
      </form>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div>
          <h1 className="font-semibold text-3xl">Spells</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in to configure your spells.
          </p>
        </div>

        {authPanel}
      </section>
    </main>
  );
}
