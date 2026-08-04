/**
 * QuickBooks Desktop Agent - Local Dev Mock Runner (Node.js)
 * 
 * Simulates Desktop Agent execution on non-Windows platforms (macOS/Linux)
 * for testing Phase 1 web app integration, config parsing, and authorization state handling.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('=================================================');
console.log('   QuickBooks Desktop Migration Desktop Agent    ');
console.log('   Phase 1: SDK Authorization Popup Spike (Mock) ');
console.log('=================================================\n');

// 1. Load config
const configPath = path.join(__dirname, 'agent.config.json');
let config = {
  appName: 'MYOB Migration Portal',
  webAppUrl: 'http://localhost:3000',
  jobToken: 'demo-job-token-12345',
  mockOutcome: 'AUTHORIZED'
};

if (fs.existsSync(configPath)) {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    config = { ...config, ...JSON.parse(raw) };
  } catch (err) {
    console.warn(`[Config] Could not read agent.config.json: ${err.message}`);
  }
}

// Parse CLI args
const args = process.argv.slice(2);
let mockOutcome = config.mockOutcome || 'AUTHORIZED';

args.forEach(arg => {
  if (arg.startsWith('--outcome=')) {
    mockOutcome = arg.replace('--outcome=', '').toUpperCase();
  } else if (arg.startsWith('--appname=')) {
    config.appName = arg.replace('--appname=', '');
  } else if (arg.startsWith('--token=')) {
    config.jobToken = arg.replace('--token=', '');
  }
});

console.log(`[Config] Client-Facing App Name : ${config.appName}`);
console.log(`[Config] Web Application Base   : ${config.webAppUrl}`);
console.log(`[Config] Migration Job Token    : ${config.jobToken}`);
console.log(`[Mode] Local Dev Mock Runner (Outcome: ${mockOutcome})\n`);

console.log('[Step 1] Initiating connection to QuickBooks Desktop via SDK...');
console.log('   -> Calling OpenConnection2 & BeginSession...');
console.log('   -> (If first time, QuickBooks will display its Application Certificate popup dialog now)\n');

// Handle Mock Outcomes
if (mockOutcome === 'FAILED_PRECONDITION') {
  console.log('\x1b[31m%s\x1b[0m', '❌ PRECONDITION FAILED [0x80040418]');
  console.log('   Message    : QuickBooks Desktop is not running.');
  console.log('   Action     : Please open QuickBooks Desktop, log in to your company file as Admin, and try again.');
  sendStatusToWebApp('FAILED_PRECONDITION', 'QuickBooks Desktop is not running.', 'Please launch QuickBooks Desktop and open your company file as Admin.');
} else if (mockOutcome === 'DENIED') {
  console.log('\x1b[33m%s\x1b[0m', '⚠️ AUTHORIZATION FAILED [DENIED]');
  console.log('   Error Code : 0x8004041D');
  console.log(`   Message    : QuickBooks user denied permission to access the company file for '${config.appName}'.`);
  console.log('\n-------------------------------------------------');
  console.log('   WHAT THE BOOKKEEPER SHOULD DO NEXT:');
  console.log(`   1. Open QuickBooks Desktop as Admin.`);
  console.log(`   2. Go to Edit -> Preferences -> Integrated Applications -> Company Preferences.`);
  console.log(`   3. Select '${config.appName}' and click Properties.`);
  console.log(`   4. Check 'Allow this application to read and modify this company file' and click OK.`);
  console.log('-------------------------------------------------');
  sendStatusToWebApp('DENIED', `User denied access for app '${config.appName}'`, 'Go to Edit -> Preferences -> Integrated Applications in QuickBooks to grant permission.');
} else {
  // AUTHORIZED
  const ticket = `MOCK-TICKET-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  console.log('\x1b[32m%s\x1b[0m', '✅ AUTHORIZATION SUCCESSFUL!');
  console.log('   Status           : AUTHORIZED');
  console.log(`   Session Ticket   : ${ticket}`);
  console.log('   Company Name     : Acme Trading Co Pty Ltd');
  console.log('   Company File Path: C:\\Users\\Public\\Documents\\Intuit\\QuickBooks\\Acme_Trading_Co.qbw');
  sendStatusToWebApp('AUTHORIZED', 'Connected to Acme Trading Co Pty Ltd', '');
}

function sendStatusToWebApp(status, message, remediation) {
  try {
    const targetUrl = new URL(`${config.webAppUrl}/api/jobs/${config.jobToken}/status`);
    const payload = JSON.stringify({
      jobToken: config.jobToken,
      appName: config.appName,
      status,
      message,
      remediation,
      timestamp: new Date().toISOString()
    });

    console.log(`\n[Web App] Sending status update to: ${targetUrl.toString()}`);
    const req = http.request(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      console.log(`   -> Web app returned HTTP ${res.statusCode}`);
    });

    req.on('error', (err) => {
      console.log(`[Web App] Note: Web app server not currently running at ${config.webAppUrl} (${err.message})`);
    });

    req.write(payload);
    req.end();
  } catch (err) {
    console.log(`[Web App] Error forming request: ${err.message}`);
  }
}
