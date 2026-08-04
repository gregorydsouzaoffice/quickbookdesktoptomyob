"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle2, Layers, Monitor, Database } from "lucide-react"
import { QBDAgentConnector } from "@/components/qbd-agent-connector"

/** Survives navigation within the session, so stepping back does not drop the MYOB link. */
const MYOB_CONNECTION_KEY = "myob-connection-v1"

export default function NewMigrationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedSource, setSelectedSource] = useState<string>("quickbooks-desktop")
  const [selectedDestination, setSelectedDestination] = useState<string>("myob")
  const [qbConnected, setQbConnected] = useState(false)

  const [myobConnected, setMyobConnected] = useState(false)
  const [connectedBook, setConnectedBook] = useState<string | null>(null)

  // MYOB reports back through the query string when its auth flow returns here.
  // We persist it for the session so stepping forward and back does not drop it.
  useEffect(() => {
    const returnedFromAuth = searchParams.get("myob_connected") === "true"
    const book = searchParams.get("book")

    try {
      if (returnedFromAuth) {
        setMyobConnected(true)
        setConnectedBook(book)
        sessionStorage.setItem(MYOB_CONNECTION_KEY, JSON.stringify({ book }))
        return
      }
      const saved = sessionStorage.getItem(MYOB_CONNECTION_KEY)
      if (saved) {
        setMyobConnected(true)
        setConnectedBook(JSON.parse(saved).book ?? null)
      }
    } catch {
      if (returnedFromAuth) setMyobConnected(true)
    }
  }, [searchParams])

  // Both ends have to be live before there is a migration to run.
  const canContinue = qbConnected && myobConnected

  const handleConnectSource = () => {
    document.getElementById("qbd-connector")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const handleConnectDestination = () => {
    router.push(`/login/myob?source=${selectedSource}&returnTo=/dashboard/new-migration`)
  }

  const handleContinue = () => {
    // Both platforms are already connected on this page — go straight to Extract
    // rather than sending the user through a second "connect your accounts" step.
    if (selectedSource && selectedDestination) {
      router.push(`/dashboard/new-migration/extract?source=${selectedSource}&destination=${selectedDestination}`)
    }
  }

  const sourcePlatforms = [
    {
      id: "quickbooks-desktop",
      name: "QuickBooks Desktop",
      description: "Your company file on this computer",
      logo: (
        <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-600">
          <Monitor className="w-5 h-5" />
        </div>
      ),
    },
  ]

  const destinationPlatforms = [
    {
      id: "myob",
      name: "MYOB AccountRight / Business",
      description: "MYOB Cloud accounting platform",
      logo: (
        <div className="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center">
          <img src="/images/myob-logo.png" alt="MYOB" className="w-10 h-10 object-contain" />
        </div>
      ),
    },
  ]

  return (
    <div className="container py-8 max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="w-full bg-card/70 backdrop-blur-md border border-border/60 rounded-2xl shadow-lg overflow-hidden p-6 relative">
        <div className="pb-4 mb-6 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-primary/30">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                  QuickBooks Desktop → MYOB Online
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Move your books from QuickBooks Desktop on this PC to MYOB Online
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" /> Source Platform
            </h3>
            <div className="grid gap-3">
              {sourcePlatforms.map((platform) => (
                <div
                  key={platform.id}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedSource === platform.id
                      ? "border-primary/60 bg-primary/5 shadow-md shadow-primary/5"
                      : "border-border/60 hover:border-primary/40 hover:bg-primary/5"
                  }`}
                  onClick={() => setSelectedSource(platform.id)}
                >
                  <div className="flex-shrink-0">{platform.logo}</div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{platform.name}</h4>
                      {qbConnected && platform.id === selectedSource && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{platform.description}</p>
                  </div>
                  <Button
                    variant={qbConnected ? "outline" : "default"}
                    size="sm"
                    disabled={qbConnected}
                    className={`ml-auto rounded-lg text-xs font-medium ${
                      qbConnected
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 disabled:opacity-100"
                        : "bg-primary text-primary-foreground"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleConnectSource()
                    }}
                  >
                    {qbConnected ? (
                      <>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Connected
                      </>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-500" /> Destination Platform
            </h3>
            <div className="grid gap-3">
              {destinationPlatforms.map((platform) => (
                <div
                  key={platform.id}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedDestination === platform.id
                      ? "border-purple-500/60 bg-purple-500/5 shadow-md shadow-purple-500/5"
                      : "border-border/60 hover:border-purple-500/40 hover:bg-purple-500/5"
                  }`}
                  onClick={() => setSelectedDestination(platform.id)}
                >
                  <div className="flex-shrink-0">{platform.logo}</div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{platform.name}</h4>
                      {myobConnected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {myobConnected && connectedBook ? connectedBook : platform.description}
                    </p>
                  </div>
                  <Button
                    variant={myobConnected ? "outline" : "default"}
                    size="sm"
                    disabled={myobConnected}
                    className={`ml-auto rounded-lg text-xs font-medium ${
                      myobConnected
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 disabled:opacity-100"
                        : "bg-purple-600 text-white hover:bg-purple-700"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleConnectDestination()
                    }}
                  >
                    {myobConnected ? (
                      <>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Connected
                      </>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Desktop Agent Connector Panel */}
      {selectedSource === "quickbooks-desktop" && (
        <div className="space-y-4">
          <QBDAgentConnector onConnectionChange={setQbConnected} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!canContinue && (
          <span className="text-sm text-muted-foreground">
            {!qbConnected && !myobConnected
              ? "Connect QuickBooks Desktop and MYOB to continue"
              : !qbConnected
                ? "Connect QuickBooks Desktop to continue"
                : "Connect MYOB to continue"}
          </span>
        )}
        <Button onClick={handleContinue} disabled={!canContinue} className="google-button-primary">
          Continue to Extract <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
