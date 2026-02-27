"use client"

import { FormEvent, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type Mode = "signin" | "register"

type FakeUser = {
  email: string
  password: string
}

export default function PulseAccessPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const title = useMemo(() => (mode === "signin" ? "Access Pulse" : "Create Pulse Access"), [mode])

  function persistFakeUser(user: FakeUser) {
    localStorage.setItem("pulse_fake_user", JSON.stringify(user))
  }

  function getFakeUser(): FakeUser | null {
    const raw = localStorage.getItem("pulse_fake_user")
    if (!raw) return null

    try {
      return JSON.parse(raw) as FakeUser
    } catch {
      return null
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.")
      return
    }

    if (password.length < 4) {
      setError("Use at least 4 characters in password.")
      return
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsLoading(true)

    window.setTimeout(() => {
      if (mode === "register") {
        persistFakeUser({ email: email.trim(), password })
        setMessage("User registered locally. Continue to project loading.")
        setIsLoading(false)
        return
      }

      const fakeUser = getFakeUser()
      if (!fakeUser || fakeUser.email !== email.trim() || fakeUser.password !== password) {
        setError("User not found. Register first or use matching credentials.")
        setIsLoading(false)
        return
      }

      setMessage("Access granted. Redirecting to project loading...")
      setIsLoading(false)
      window.setTimeout(() => router.push("/projects?flow=load"), 420)
    }, 550)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(1100px_560px_at_22%_-8%,#12365a_0%,#09121d_45%,#04070c_100%)] text-slate-100">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 md:flex-row md:items-center md:py-16">
        <div className="md:w-1/2">
          <Link href="/" className="text-xs uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200">
            Back to Home
          </Link>
          <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">FractalBuild Sequence</p>
            <h1 className="mt-3 font-heading text-5xl leading-none text-slate-100 md:text-7xl pulse-text">PULSE</h1>
            <p className="mt-4 max-w-md text-sm text-slate-300">
              Structured signal before project load. Validate access and initialize your execution environment.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-cyan-300 pulse-dot" />
              <span className="text-xs uppercase tracking-[0.14em] text-cyan-100">System Warmup Active</span>
            </div>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <p>1. Activate session identity.</p>
              <p>2. Confirm access credentials.</p>
              <p>3. Continue to project loading.</p>
            </div>
          </div>
        </div>

        <div className="md:w-1/2">
          <div className="rounded-3xl border border-slate-800 bg-slate-950/75 p-6 md:p-8">
            <div className="mb-5 inline-flex rounded-lg border border-slate-700 bg-slate-900/70 p-1 text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode("signin")
                  setError("")
                  setMessage("")
                }}
                className={`rounded-md px-3 py-2 transition ${mode === "signin" ? "bg-cyan-600 text-slate-100" : "text-slate-300 hover:text-slate-100"}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register")
                  setError("")
                  setMessage("")
                }}
                className={`rounded-md px-3 py-2 transition ${mode === "register" ? "bg-cyan-600 text-slate-100" : "text-slate-300 hover:text-slate-100"}`}
              >
                Register
              </button>
            </div>

            <h2 className="font-heading text-2xl text-slate-100 md:text-3xl">{title}</h2>
            <p className="mt-2 text-sm text-slate-400">Fictitious auth flow for guided access before entering Pulse.</p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-slate-400">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@team.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-slate-400">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
                />
              </label>

              {mode === "register" ? (
                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-slate-400">Confirm Password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
                  />
                </label>
              ) : null}

              {error ? <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
              {message ? <p className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">{message}</p> : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? "Processing..." : mode === "signin" ? "Enter Pulse" : "Register User"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/projects?flow=load")}
                  className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-900"
                >
                  Continue Without Auth
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <style jsx>{`
        .pulse-text {
          letter-spacing: 0.08em;
          text-shadow: 0 0 16px rgba(96, 212, 255, 0.3);
          animation: pulseWord 2.8s ease-in-out infinite;
        }
        .pulse-dot {
          box-shadow: 0 0 0 rgba(96, 212, 255, 0.55);
          animation: pulseDot 1.8s ease-out infinite;
        }
        @keyframes pulseWord {
          0%,
          100% {
            opacity: 0.88;
            transform: translateY(0);
          }
          50% {
            opacity: 1;
            transform: translateY(-1px);
          }
        }
        @keyframes pulseDot {
          0% {
            box-shadow: 0 0 0 0 rgba(96, 212, 255, 0.55);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(96, 212, 255, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(96, 212, 255, 0);
          }
        }
      `}</style>
    </main>
  )
}
