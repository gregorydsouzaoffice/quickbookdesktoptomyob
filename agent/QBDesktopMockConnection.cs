using System;

namespace QBDDesktopAgent
{
    public class QBDesktopMockConnection : IQBConnection
    {
        private readonly string _mockOutcome;

        public QBDesktopMockConnection(string mockOutcome = "AUTHORIZED")
        {
            _mockOutcome = mockOutcome.ToUpperInvariant();
        }

        public PreconditionResult CheckPreconditions()
        {
            if (_mockOutcome == "FAILED_PRECONDITION")
            {
                return new PreconditionResult
                {
                    Passed = false,
                    ErrorCode = "0x80040418",
                    Message = "[MOCK MODE] QuickBooks Desktop is not running.",
                    RemediationStep = "Launch QuickBooks Desktop and open your company file as Admin."
                };
            }

            return new PreconditionResult { Passed = true };
        }

        public QBConnectResult Connect(string appName, string companyFilePath = "")
        {
            var preconditions = CheckPreconditions();
            if (!preconditions.Passed)
            {
                return new QBConnectResult
                {
                    Success = false,
                    AuthorizationStatus = "FAILED_PRECONDITION",
                    ErrorCode = preconditions.ErrorCode,
                    ErrorMessage = preconditions.Message,
                    RemediationStep = preconditions.RemediationStep
                };
            }

            if (_mockOutcome == "DENIED")
            {
                return new QBConnectResult
                {
                    Success = false,
                    AuthorizationStatus = "DENIED",
                    ErrorCode = "0x8004041D",
                    ErrorMessage = $"[MOCK MODE] QuickBooks user denied access for application '{appName}'.",
                    RemediationStep = $"To grant permission in QuickBooks Desktop:\n" +
                                     $"1. Open QuickBooks Desktop as Admin.\n" +
                                     $"2. Go to Edit -> Preferences -> Integrated Applications -> Company Preferences.\n" +
                                     $"3. Select '{appName}' and click Properties.\n" +
                                     $"4. Check 'Allow this application to read and modify this company file' and click OK."
                };
            }

            // Default: Authorized
            string mockTicket = $"MOCK-SESSION-TICKET-{Guid.NewGuid().ToString().Substring(0, 8)}";
            return new QBConnectResult
            {
                Success = true,
                Ticket = mockTicket,
                CompanyName = "Sample Acme Corp (Mock QBD Company)",
                CompanyFilePath = string.IsNullOrEmpty(companyFilePath) ? @"C:\Users\Public\Documents\Intuit\QuickBooks\Sample_Company_File.qbw" : companyFilePath,
                AuthorizationStatus = "AUTHORIZED"
            };
        }

        public string QueryCompanyName(string ticket)
        {
            return "Sample Acme Corp (Mock QBD Company)";
        }

        public void Disconnect(string ticket)
        {
            Console.WriteLine($"[MOCK MODE] Disconnected session ticket: {ticket}");
        }
    }
}
