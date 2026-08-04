using System;

namespace QBDDesktopAgent
{
    public class PreconditionResult
    {
        public bool Passed { get; set; }
        public string ErrorCode { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string RemediationStep { get; set; } = string.Empty;
    }

    public class QBConnectResult
    {
        public bool Success { get; set; }
        public string Ticket { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string CompanyFilePath { get; set; } = string.Empty;
        public string AuthorizationStatus { get; set; } = string.Empty; // ALLOW_ONCE, ALLOW_ALWAYS, DENIED, FAILED_PRECONDITION
        public string ErrorCode { get; set; } = string.Empty;
        public string ErrorMessage { get; set; } = string.Empty;
        public string RemediationStep { get; set; } = string.Empty;
    }

    public interface IQBConnection
    {
        PreconditionResult CheckPreconditions();
        QBConnectResult Connect(string appName, string companyFilePath = "");
        string QueryCompanyName(string ticket);
        void Disconnect(string ticket);
    }
}
