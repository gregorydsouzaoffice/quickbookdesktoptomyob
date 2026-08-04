# QuickBooks Desktop Migration — Desktop Agent (.exe)

This folder contains Component B of the QuickBooks Desktop → MYOB migration architecture: the Windows Desktop Agent.

## Phase 1 Deliverable: SDK Authorization Popup Spike

### Purpose
Opens a connection to QuickBooks Desktop via the QBSDK COM interface (`QBXMLRP2Lib` / `QBFC`) and triggers QuickBooks' native **Application Certificate Authorization Dialog**.

---

## 1. How to Build `QBDDesktopAgent.exe` (Windows Machine)

### Prerequisites on Windows Build Machine
- Windows 10/11 or Windows Server.
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) installed.
- QuickBooks Desktop or QuickBooks SDK installed (registers `QBXMLRP2.dll` COM server).

### Build Command
Open PowerShell or Command Prompt in the `./agent/` directory:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true /p:EnableCompressionInSingleFile=true
```

Output executable location:
`./agent/bin/Release/net8.0-windows/win-x64/publish/QBDDesktopAgent.exe` (~30 MB standalone executable).

---

## 2. Code Signing (Important for Production / Client Distribution)

Unsigned `.exe` files will trigger Windows SmartScreen warnings ("Unknown Publisher").

To sign `QBDDesktopAgent.exe` using an EV Code Signing certificate:

```powershell
signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a "path\to\QBDDesktopAgent.exe"
```

---

## 3. Configuration (`agent.config.json`)

Place `agent.config.json` in the same directory as `QBDDesktopAgent.exe`:

```json
{
  "appName": "MYOB Migration Portal - Acme Corp",
  "webAppUrl": "https://your-migration-portal.com",
  "jobToken": "job-token-12345",
  "useMockMode": false
}
```

- **`appName`**: The exact string shown to the bookkeeper in the QuickBooks Desktop certificate dialog. Treat as user-facing copy.
- **`webAppUrl`**: Base URL of the web server receiving status callbacks.
- **`jobToken`**: Short-lived, single-use migration token issued by the web server.

---

## 4. Manual Testing Checklist (Windows + QuickBooks Desktop)

Execute the manual test steps outlined in Master Project Document §6:

- [ ] **Precondition Fail Test (QB Closed)**:
  - Close QuickBooks Desktop completely.
  - Run `QBDDesktopAgent.exe`.
  - **Result**: Reports `FAILED_PRECONDITION` error with explicit instructions to launch QuickBooks Desktop.
- [ ] **First Connection (Allow Once)**:
  - Open QuickBooks Desktop -> Log in as Admin -> Single-User Mode.
  - Run `QBDDesktopAgent.exe`.
  - **Result**: Native QuickBooks Application Certificate popup appears displaying `appName`.
  - Select "Yes, prompt each time" -> Click Continue.
  - **Result**: Agent prints `AUTHORIZED`, outputs session ticket and resolved company file name.
- [ ] **Allow Always**:
  - Re-run `QBDDesktopAgent.exe`, select "Yes, always; allow access even if QuickBooks is not running".
  - Click Continue -> Done.
  - Re-run again -> Connects silently without showing popup.
- [ ] **Deny Outcome**:
  - In QuickBooks: `Edit -> Preferences -> Integrated Applications -> Company Preferences`.
  - Revoke access for the app.
  - Run `QBDDesktopAgent.exe`.
  - **Result**: Agent reports `DENIED` with plain-English remediation instructions.

---

## 5. Local Development Mock (macOS / Linux)

To test without a Windows machine or QuickBooks Desktop COM installation:

```bash
# Run with default outcome (AUTHORIZED)
node agent/mock-runner.js

# Test DENIED outcome
node agent/mock-runner.js --outcome=DENIED

# Test FAILED_PRECONDITION outcome
node agent/mock-runner.js --outcome=FAILED_PRECONDITION
```
