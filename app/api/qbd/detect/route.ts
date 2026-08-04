import { NextResponse } from "next/server"
import os from "os"

/**
 * Detects a running QuickBooks Desktop instance and the company file it has open.
 *
 * On Windows this is answered by the local desktop agent, which queries the
 * QBSDK COM interface (QBXMLRP2.RequestProcessor) and reads the company name
 * back via a CompanyQueryRq. See agent/QBDesktopConnection.cs.
 *
 * Anywhere else there is no COM interface to ask, so we return an EXPLICIT
 * demo-mode result. Demo mode is always reported as a flag the UI must show —
 * it is never a silent fallback, because a silent fallback could produce a fake
 * success against a real company file.
 */

/** The company file recorded in the reference QuickBooks session. */
const DEMO_COMPANY = {
  companyName: "Prime Engineering Consultants LLC Sole Proprietor - Abu Dhabi",
  filePath: "C:\\Users\\Public\\Documents\\Intuit\\QuickBooks\\Company Files\\Prime Engineering.qbw",
  qbVersion: "QuickBooks Enterprise Solutions 24.0",
  loggedInUser: "Admin",
  singleUserMode: true,
}

export async function GET() {
  const isWindows = os.platform() === "win32"

  if (!isWindows) {
    return NextResponse.json({
      found: true,
      demoMode: true,
      reason: `No QuickBooks Desktop COM interface on ${os.platform()} — running in demo mode.`,
      company: DEMO_COMPANY,
    })
  }

  // TODO: verify against SDK docs — on Windows this should call the local agent
  // rather than answering from the web layer. Until that is wired up we report
  // "not found" instead of guessing, so the real path can never fake a success.
  return NextResponse.json({
    found: false,
    demoMode: false,
    reason: "QuickBooks Desktop detection is handled by the local desktop agent, which is not yet wired up.",
  })
}
