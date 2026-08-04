import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")

  if (!token) {
    return NextResponse.json(
      { error: "Missing required job token parameter" },
      { status: 400 }
    )
  }

  // Stub endpoint serving agent package information / download payload
  return NextResponse.json({
    message: "QuickBooks Desktop Agent Executable (.exe) Download Stub",
    token,
    instructions: "Run QBDDesktopAgent.exe on the Windows machine hosting QuickBooks Desktop.",
    configRequired: {
      appName: "MYOB Migration Portal",
      jobToken: token,
      webAppUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    }
  })
}
