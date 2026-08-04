using System;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace QBDDesktopAgent
{
    public class ConfigData
    {
        public string appName { get; set; } = "MYOB Migration Portal";
        public string webAppUrl { get; set; } = "http://localhost:3000";
        public string jobToken { get; set; } = "demo-job-token-12345";
        public bool useMockMode { get; set; } = false;
        public string mockOutcome { get; set; } = "AUTHORIZED";
    }

    class Program
    {
        static async Task<int> Main(string[] args)
        {
            Console.WriteLine("=================================================");
            Console.WriteLine("   QuickBooks Desktop Migration Desktop Agent    ");
            Console.WriteLine("   Phase 1: SDK Authorization Popup Spike       ");
            Console.WriteLine("=================================================\n");

            // 1. Load Configuration
            ConfigData config = LoadConfig();

            // Parse CLI flag overrides
            string mockOutcome = config.mockOutcome;
            bool forceMock = config.useMockMode;

            foreach (var arg in args)
            {
                if (arg.Equals("--mock", StringComparison.OrdinalIgnoreCase))
                {
                    forceMock = true;
                }
                else if (arg.StartsWith("--outcome=", StringComparison.OrdinalIgnoreCase))
                {
                    mockOutcome = arg.Substring("--outcome=".Length);
                }
                else if (arg.StartsWith("--appname=", StringComparison.OrdinalIgnoreCase))
                {
                    config.appName = arg.Substring("--appname=".Length);
                }
                else if (arg.StartsWith("--token=", StringComparison.OrdinalIgnoreCase))
                {
                    config.jobToken = arg.Substring("--token=".Length);
                }
            }

            Console.WriteLine($"[Config] Client-Facing App Name : {config.appName}");
            Console.WriteLine($"[Config] Web Application Base   : {config.webAppUrl}");
            Console.WriteLine($"[Config] Migration Job Token    : {config.jobToken}");

            bool isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
            bool useMock = forceMock || !isWindows;

            if (useMock)
            {
                Console.WriteLine($"[Mode] Running in MOCK mode (OS: {RuntimeInformation.OSDescription}, MockOutcome: {mockOutcome})");
            }
            else
            {
                Console.WriteLine($"[Mode] Running in REAL Windows QBSDK COM mode");
            }

            Console.WriteLine("\n[Step 1] Initiating connection to QuickBooks Desktop via SDK...");
            Console.WriteLine("   -> Calling OpenConnection2 & BeginSession...");
            Console.WriteLine("   -> (If first time, QuickBooks will display its Application Certificate popup dialog now)\n");

            IQBConnection qbConnection = useMock
                ? new QBDesktopMockConnection(mockOutcome)
                : new QBDesktopConnection();

            // Run Precondition Check first
            var preconditions = qbConnection.CheckPreconditions();
            if (!preconditions.Passed && !useMock)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"\n❌ PRECONDITION FAILED [{preconditions.ErrorCode}]");
                Console.WriteLine($"   Message    : {preconditions.Message}");
                Console.WriteLine($"   Action     : {preconditions.RemediationStep}");
                Console.ResetColor();

                await SendStatusToWebApp(config, "FAILED_PRECONDITION", preconditions.Message, preconditions.RemediationStep);
                return 1;
            }

            // Execute SDK Connection & Trigger Certificate Popup
            var connectResult = qbConnection.Connect(config.appName);

            if (connectResult.Success)
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"\n✅ AUTHORIZATION SUCCESSFUL!");
                Console.WriteLine($"   Status           : {connectResult.AuthorizationStatus}");
                Console.WriteLine($"   Session Ticket   : {connectResult.Ticket}");
                Console.WriteLine($"   Company Name     : {connectResult.CompanyName}");
                Console.WriteLine($"   Company File Path: {connectResult.CompanyFilePath}");
                Console.ResetColor();

                await SendStatusToWebApp(config, connectResult.AuthorizationStatus, $"Connected to {connectResult.CompanyName}", "");
                return 0;
            }
            else
            {
                Console.ForegroundColor = connectResult.AuthorizationStatus == "DENIED" ? ConsoleColor.Yellow : ConsoleColor.Red;
                Console.WriteLine($"\n⚠️ AUTHORIZATION / CONNECTION FAILED [{connectResult.AuthorizationStatus}]");
                Console.WriteLine($"   Error Code : {connectResult.ErrorCode}");
                Console.WriteLine($"   Message    : {connectResult.ErrorMessage}");
                Console.WriteLine("\n-------------------------------------------------");
                Console.WriteLine("   WHAT THE BOOKKEEPER SHOULD DO NEXT:");
                Console.WriteLine($"   {connectResult.RemediationStep}");
                Console.WriteLine("-------------------------------------------------");
                Console.ResetColor();

                await SendStatusToWebApp(config, connectResult.AuthorizationStatus, connectResult.ErrorMessage, connectResult.RemediationStep);
                return 1;
            }
        }

        private static ConfigData LoadConfig()
        {
            string configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "agent.config.json");
            if (File.Exists(configPath))
            {
                try
                {
                    string json = File.ReadAllText(configPath);
                    var config = JsonSerializer.Deserialize<ConfigData>(json);
                    if (config != null) return config;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Config] Warning: Could not parse agent.config.json ({ex.Message}). Using defaults.");
                }
            }
            return new ConfigData();
        }

        private static async Task SendStatusToWebApp(ConfigData config, string status, string message, string remediation)
        {
            try
            {
                using var httpClient = new HttpClient();
                string endpointUrl = $"{config.webAppUrl.TrimEnd('/')}/api/jobs/{config.jobToken}/status";
                
                var payload = new
                {
                    jobToken = config.jobToken,
                    appName = config.appName,
                    status = status,
                    message = message,
                    remediation = remediation,
                    timestamp = DateTime.UtcNow.ToString("o")
                };

                string jsonPayload = JsonSerializer.Serialize(payload);
                var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

                Console.WriteLine($"\n[Web App] Sending status update to: {endpointUrl}");
                var response = await httpClient.PostAsync(endpointUrl, content);
                if (response.IsSuccessStatusCode)
                {
                    Console.WriteLine("   -> Web app status updated successfully.");
                }
                else
                {
                    Console.WriteLine($"   -> Web app notification returned HTTP {response.StatusCode}.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Web App] Note: Could not reach web app status endpoint: {ex.Message}");
            }
        }
    }
}
