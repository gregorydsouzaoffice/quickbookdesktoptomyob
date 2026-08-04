import { NextResponse } from "next/server"

// Simple in-memory status store for Phase 1 spike
const jobStore = new Map<string, any>()

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const statusUpdate = {
      jobId: id,
      jobToken: body.jobToken || id,
      appName: body.appName || "MYOB Migration Portal",
      status: body.status || "UNKNOWN", // AUTHORIZED, DENIED, FAILED_PRECONDITION, PENDING
      message: body.message || "",
      remediation: body.remediation || "",
      updatedAt: body.timestamp || new Date().toISOString()
    }

    jobStore.set(id, statusUpdate)

    console.log(`[API /jobs/${id}/status] Updated job status:`, statusUpdate)

    return NextResponse.json({
      success: true,
      jobId: id,
      status: statusUpdate.status,
      receivedAt: statusUpdate.updatedAt
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update status" },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = jobStore.get(id)

  if (!job) {
    return NextResponse.json({
      jobId: id,
      status: "PENDING",
      message: "Waiting for Desktop Agent to connect to QuickBooks Desktop...",
      updatedAt: new Date().toISOString()
    })
  }

  return NextResponse.json(job)
}
