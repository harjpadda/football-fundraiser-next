import { useState } from "react";
import { useRouter } from "next/router";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };

    const r = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      setError(await r.text());
      return;
    }

    router.push("/auth/signin");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-6">Create your account</h1>

        {error && (
          <div className="mb-4 text-sm bg-red-500/10 border border-red-500/40 rounded-lg p-3 text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input name="name" required className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input name="email" type="email" required className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm mb-1">Password (6+ chars)</label>
            <input name="password" type="password" required className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm" />
          </div>

          <button className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5">
            Sign up
          </button>
        </form>

        <p className="text-sm text-slate-400 mt-4">
          Already have an account?{" "}
          <a className="text-emerald-400 hover:underline" href="/auth/signin">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
