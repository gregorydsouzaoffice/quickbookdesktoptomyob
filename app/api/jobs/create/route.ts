import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const clientName = body.clientName || "Sample Client"
    
    // Issue a short-lived single-use job token
    const jobId = `job_${Date.now()}`
    const jobToken = `tok_${Math.random().toString(36).substring(2, 12)}`
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

    return NextResponse.json({
      success: true,
      jobId,
      jobToken,
      clientName,
      appName: `MYOB Migration Portal - ${clientName}`,
      expiresAt,
      downloadUrl: `/api/jobs/download?token=${jobToken}`
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create migration job" },
      { status: 500 }
    )
  }
}
