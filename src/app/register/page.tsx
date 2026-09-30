"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = {};

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-border p-8">
        <h1 className="text-2xl font-semibold text-ink mb-1">Create your account</h1>
        <p className="text-sm text-muted mb-6">Track cards, loans, funds and due dates in one place.</p>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Name</label>
            <input
              name="name"
              type="text"
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="At least 8 characters"
            />
          </div>

          {state.error && (
            <p className="text-sm text-coral bg-coral-soft border border-coral rounded-xl px-3 py-2">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-accent text-white rounded-xl py-2 text-sm font-medium hover:bg-accent-strong disabled:opacity-60"
          >
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-muted mt-6 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-ink font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
