import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import { useState } from "react";

export default function SignIn() {
  const router = useRouter();
  const callbackUrl = (router.query.callbackUrl as string) || "/";
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (!res || res.error) {
      setError("Incorrect email or password.");
      return;
    }

    router.push(res.url || callbackUrl);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-6">Sign in</h1>

        {error && (
          <div className="mb-4 text-sm bg-red-500/10 border border-red-500/40 rounded-lg p-3 text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input name="email" type="email" required className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input name="password" type="password" required className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm" />
          </div>

          <button className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5">
            Sign in
          </button>
        </form>

        <p className="text-sm text-slate-400 mt-4">
          No account yet?{" "}
          <a className="text-emerald-400 hover:underline" href="/auth/signup">
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
