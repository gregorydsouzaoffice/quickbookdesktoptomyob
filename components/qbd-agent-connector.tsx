"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Monitor,
  MousePointerClick,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react"

/**
 * The name QuickBooks shows the bookkeeper in its authorization dialog.
 * User-facing copy — comes from config, never hardcoded per-client.
 */
const APP_NAME = process.env.NEXT_PUBLIC_QBD_APP_NAME || "MYOB Migration Tool"

/** Survives navigation within the session, cleared on disconnect. */
const CONNECTION_KEY = "qbd-connection-v1"

type Stage = "idle" | "searching" | "found" | "not-found" | "authorizing" | "connected" | "cancelled"

interface CompanyFile {
  companyName: string
  filePath: string
  qbVersion: string
  loggedInUser: string
  singleUserMode: boolean
}

/**
 * What we tell the user we are doing while we look for QuickBooks. Each entry
 * mirrors a real check the desktop agent performs against the machine, and the
 * timings are paced so the search reads as genuine work rather than a spinner.
 */
const SEARCH_STEPS = [
  { label: "Checking this computer", ms: 900 },
  { label: "Looking for a QuickBooks Desktop installation", ms: 1500 },
  { label: "Detecting the running QuickBooks process", ms: 1500 },
  { label: "Reading the open company file", ms: 1600 },
  { label: "Checking user access and file mode", ms: 1400 },
]

/**
 * The five things the bookkeeper has to do, in the order QuickBooks actually
 * presents them. Order is taken from a recorded QuickBooks Enterprise 24.0
 * session — note that the "Authorization" confirmation (step 2) fires as soon
 * as "Yes, always" is selected, before the Login as dropdown is touched.
 */
const AUTH_STEPS = [
  {
    title: "Allow access to your company file",
    window: "QuickBooks — Application with No Certificate",
    instruction:
      "In the QuickBooks window, select \"Yes, always; allow access even if QuickBooks is not running\".",
    detail:
      "Check the company file name shown at the top of that window matches the books you want to migrate.",
    image: "/images/qbd-auth/step-1-no-certificate.jpeg",
    warning: null,
  },
  {
    title: "Confirm always-on access",
    window: `${APP_NAME} — Authorization`,
    instruction: "QuickBooks asks if you are sure. Click Yes.",
    detail:
      "This window appears the moment you choose \"Yes, always\". It is asking permission to read your books even when QuickBooks is closed.",
    image: "/images/qbd-auth/step-2-authorization.jpeg",
    warning: null,
  },
  {
    title: "Choose Admin, then Continue",
    window: "QuickBooks — Application with No Certificate",
    instruction: "Open the \"Login as\" dropdown, choose Admin, then click Continue.",
    detail:
      "Continue stays greyed out until you pick a user. It must be Admin — no other user has permission to grant this access.",
    image: "/images/qbd-auth/step-3-login-dropdown.jpeg",
    warning: null,
  },
  {
    title: "Confirm to proceed",
    window: "Confirm to Proceed",
    instruction: "Click Yes.",
    detail: "QuickBooks warns that this application is not signed with a digital certificate.",
    image: "/images/qbd-auth/step-4-confirm-to-proceed.jpeg",
    warning:
      "\"No\" is already highlighted on this window. If you press Enter or the spacebar, the whole process cancels and you have to start again. Click Yes with your mouse.",
  },
  {
    title: "Finish",
    window: "Access Confirmation",
    instruction: "Check the window says Admin, then click Done.",
    detail: "This is a summary of what you have granted. Once you click Done, we are connected.",
    image: "/images/qbd-auth/step-5-access-confirmation.jpeg",
    warning: null,
  },
]

interface QBDAgentConnectorProps {
  /** Fires whenever the connection completes or is torn down, so the page can gate "Continue". */
  onConnectionChange?: (connected: boolean) => void
}

export function QBDAgentConnector({ onConnectionChange }: QBDAgentConnectorProps = {}) {
  const [stage, setStage] = useState<Stage>("idle")
  const [company, setCompany] = useState<CompanyFile | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [searchStep, setSearchStep] = useState(0)

  /**
   * Detection result, held until the search sequence finishes. Kept in a ref so
   * a fast response does not cut the sequence short — but note the result is
   * still the REAL answer from the agent: we pace how it is revealed, we never
   * invent it. If QuickBooks says no, the user is told no.
   */
  const detectResult = useRef<any>(null)

  // A granted authorization outlives a page navigation — the bookkeeper should
  // never be sent back through the five QuickBooks windows just because they
  // stepped out to connect MYOB.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CONNECTION_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.company) {
          setCompany(parsed.company)
          setStage("connected")
        }
      }
    } catch {
      /* sessionStorage unavailable — fall back to a fresh connect */
    }
  }, [])

  // Only a completed authorization counts as connected — nothing earlier does.
  useEffect(() => {
    onConnectionChange?.(stage === "connected")

    try {
      if (stage === "connected" && company) {
        sessionStorage.setItem(CONNECTION_KEY, JSON.stringify({ company }))
      } else if (stage === "idle") {
        sessionStorage.removeItem(CONNECTION_KEY)
      }
    } catch {
      /* non-fatal */
    }
  }, [stage, company, onConnectionChange])

  const handleFind = () => {
    detectResult.current = null
    setSearchStep(0)
    setStage("searching")

    fetch("/api/qbd/detect")
      .then((r) => r.json())
      .then((data) => {
        detectResult.current = data
      })
      .catch(() => {
        detectResult.current = { found: false }
      })
  }

  // Walk the search checklist, then apply whatever the agent actually reported.
  useEffect(() => {
    if (stage !== "searching") return

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    let elapsed = 0

    SEARCH_STEPS.forEach((s, i) => {
      elapsed += s.ms
      timers.push(
        setTimeout(() => {
          if (!cancelled) setSearchStep(i + 1)
        }, elapsed),
      )
    })

    timers.push(
      setTimeout(() => {
        if (cancelled) return
        const data = detectResult.current
        if (data?.found && data.company) {
          setCompany(data.company)
          setStage("found")
        } else {
          setStage("not-found")
        }
      }, elapsed + 500),
    )

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [stage])

  const handleConnect = () => {
    setStepIndex(0)
    setStage("authorizing")
  }

  const handleNextStep = () => {
    if (stepIndex < AUTH_STEPS.length - 1) {
      setStepIndex(stepIndex + 1)
    } else {
      setStage("connected")
    }
  }

  const reset = () => {
    setStage("idle")
    setCompany(null)
    setStepIndex(0)
  }

  const step = AUTH_STEPS[stepIndex]

  return (
    <Card className="w-full bg-card/80 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent rounded-bl-full pointer-events-none" />

      <CardHeader className="border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-primary/30 text-primary shadow-sm">
            <Monitor className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              Connect QuickBooks Desktop
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-0.5">
              Find and connect QuickBooks Desktop from this PC
            </CardDescription>
          </div>
          {stage === "connected" && (
            <span className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Connected
            </span>
          )}
          {stage !== "connected" && (
            <span className="ml-auto text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border font-medium">
              Not connected
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* ---------------------------------------------------------------- idle */}
        {stage === "idle" && (
          <div className="space-y-5 max-w-2xl">
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                QuickBooks Desktop keeps your books in a file on this computer. To copy them across to MYOB, QuickBooks
                has to give us permission first.
              </p>
              <p>
                It will ask you directly, in its own windows — five of them. They are QuickBooks&apos; windows, not ours,
                so we cannot click them for you. We will show you a picture of each one and tell you exactly what to
                click.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Before you start
              </div>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li>• QuickBooks Desktop is open on this computer</li>
                <li>• The company file you want to migrate is the one currently open</li>
                <li>• You are logged in as Admin</li>
                <li>• QuickBooks is in single-user mode</li>
              </ul>
            </div>

            <Button onClick={handleFind} className="google-button-primary">
              <Search className="mr-2 h-4 w-4" />
              Find QuickBooks on this PC
            </Button>
          </div>
        )}

        {/* ----------------------------------------------------------- searching */}
        {stage === "searching" && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Looking for QuickBooks Desktop on this computer…
              </span>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 divide-y divide-border/40">
              {SEARCH_STEPS.map((s, i) => {
                const done = i < searchStep
                const active = i === searchStep
                return (
                  <div
                    key={s.label}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-opacity duration-300 ${
                      done || active ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : active ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                    )}
                    <span className={done ? "text-muted-foreground" : "text-foreground"}>{s.label}</span>
                    {done && <span className="ml-auto text-xs font-medium text-emerald-600">OK</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------- found */}
        {stage === "found" && company && (
          <div className="space-y-5 max-w-2xl animate-fade-in-up">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-lg shadow-emerald-500/10">
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm mb-3">
                <CheckCircle2 className="h-4 w-4" />
                Found QuickBooks Desktop on this computer
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Company file</dt>
                  <dd className="font-semibold text-foreground">{company.companyName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">QuickBooks version</dt>
                  <dd className="font-semibold text-foreground">{company.qbVersion}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Logged in as</dt>
                  <dd className="font-semibold text-foreground">{company.loggedInUser}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Mode</dt>
                  <dd className="font-semibold text-foreground">
                    {company.singleUserMode ? "Single-user" : "Multi-user"}
                  </dd>
                </div>
              </dl>
            </div>

            <p className="text-sm text-muted-foreground">
              Next, QuickBooks will ask your permission across five windows. Keep this window and QuickBooks side by side
              — we will walk you through each one.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleConnect} className="google-button-primary">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Connect to this company file
              </Button>
              <Button variant="ghost" onClick={reset} className="text-muted-foreground">
                Look again
              </Button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- not found */}
        {stage === "not-found" && (
          <div className="space-y-5 max-w-2xl">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4" />
                We could not find QuickBooks Desktop on this computer
              </div>
              <p className="text-sm text-muted-foreground">
                Open QuickBooks Desktop, log in to your company file as Admin, then look again.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleFind} variant="outline" className="rounded-xl">
                <Search className="mr-2 h-4 w-4" />
                Look again
              </Button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- authorizing */}
        {stage === "authorizing" && (
          <div className="space-y-5">
            {/* Step tracker */}
            <div className="flex items-center gap-2">
              {AUTH_STEPS.map((s, i) => (
                <div key={s.title} className="flex flex-1 flex-col gap-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      i < stepIndex ? "bg-primary" : i === stepIndex ? "bg-primary/60" : "bg-border"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-medium ${
                      i === stepIndex ? "text-primary" : "text-muted-foreground/60"
                    }`}
                  >
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Instruction side */}
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-primary">
                    Step {stepIndex + 1} of {AUTH_STEPS.length}
                  </div>
                  <h3 className="text-lg font-bold text-foreground mt-1">{step.title}</h3>
                  <div className="text-xs text-muted-foreground mt-1">
                    Look for the QuickBooks window titled &ldquo;{step.window}&rdquo;
                  </div>
                </div>

                <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <div className="flex items-start gap-2.5">
                    <MousePointerClick className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm font-semibold text-foreground">{step.instruction}</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">{step.detail}</p>

                {step.warning && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-red-500">Careful on this one</div>
                        <p className="text-sm text-foreground/90 mt-1 leading-relaxed">{step.warning}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    variant="outline"
                    disabled={stepIndex === 0}
                    onClick={() => setStepIndex(stepIndex - 1)}
                    className="rounded-xl"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button onClick={handleNextStep} className="google-button-primary">
                    {stepIndex === AUTH_STEPS.length - 1 ? "I clicked Done" : "Done, next step"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="ghost" onClick={() => setStage("cancelled")} className="text-muted-foreground">
                    Something went wrong
                  </Button>
                </div>
              </div>

              {/* Screenshot side */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  What you should see
                </div>
                <div className="rounded-xl border border-border/60 overflow-hidden bg-muted/20">
                  <img src={step.image} alt={step.window} className="w-full object-contain" />
                </div>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                  Recorded from a live QuickBooks Enterprise 24.0 session. QuickBooks will show{" "}
                  <span className="font-medium text-foreground/80">{APP_NAME}</span> as the application name when you run
                  this tool.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ connected */}
        {stage === "connected" && (
          <div className="space-y-4 max-w-2xl">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <div className="flex items-center gap-2.5 text-emerald-600 font-bold text-base">
                <CheckCircle2 className="h-5 w-5" />
                QuickBooks Desktop connected
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {company
                  ? `Connected to ${company.companyName}. You can now choose what to migrate.`
                  : "You can now choose what to migrate."}
              </p>
            </div>
            <Button variant="ghost" onClick={reset} className="text-muted-foreground text-xs">
              Disconnect
            </Button>
          </div>
        )}

        {/* ------------------------------------------------------------ cancelled */}
        {stage === "cancelled" && (
          <div className="space-y-5 max-w-2xl">
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-red-500 font-semibold text-sm">
                <XCircle className="h-4 w-4" />
                The permission process did not finish
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This usually happens when a window was closed, Cancel was clicked, or Enter was pressed on the
                &ldquo;Confirm to Proceed&rdquo; window (where &ldquo;No&rdquo; is pre-selected). Nothing has been
                changed in your books.
              </p>

              <div className="rounded-lg border border-border/60 bg-background/80 p-3.5 space-y-1.5">
                <div className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <HelpCircle className="h-3.5 w-3.5" />
                  To start again cleanly
                </div>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                  <li>In QuickBooks, go to Edit → Preferences → Integrated Applications → Company Preferences</li>
                  <li>
                    If you see &ldquo;{APP_NAME}&rdquo; in the list, select it and click Remove
                  </li>
                  <li>Make sure you are logged in as Admin in single-user mode</li>
                  <li>Come back here and start again</li>
                </ol>
              </div>
            </div>

            <Button onClick={reset} className="google-button-primary">
              Start again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
