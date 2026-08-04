using System;
using System.Runtime.InteropServices;
using System.Xml;

namespace QBDDesktopAgent
{
    public class QBDesktopConnection : IQBConnection
    {
        // QuickBooks COM HRESULT Constants
        private const int E_QB_USER_DENIED = unchecked((int)0x8004041D);
        private const int E_QB_NOT_RUNNING = unchecked((int)0x80040418);
        private const int E_QB_NO_COMPANY_FILE = unchecked((int)0x8004041A);
        private const int E_QB_CANNOT_START = unchecked((int)0x80040408);
        private const int E_QB_MULTI_USER_DENIED = unchecked((int)0x80040422);

        public PreconditionResult CheckPreconditions()
        {
            var result = new PreconditionResult { Passed = true };

            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                result.Passed = false;
                result.ErrorCode = "OS_NOT_SUPPORTED";
                result.Message = "QuickBooks Desktop agent requires Windows OS.";
                result.RemediationStep = "Run this application on a Windows machine with QuickBooks Desktop installed.";
                return result;
            }

            try
            {
                Type? requestProcessorType = Type.GetTypeFromProgID("QBXMLRP2.RequestProcessor");
                if (requestProcessorType == null)
                {
                    result.Passed = false;
                    result.ErrorCode = "SDK_NOT_INSTALLED";
                    result.Message = "QuickBooks Desktop SDK (QBXMLRP2 COM) is not registered on this system.";
                    result.RemediationStep = "Install QuickBooks Desktop or install the QuickBooks Desktop SDK / FC library.";
                    return result;
                }
            }
            catch (Exception ex)
            {
                result.Passed = false;
                result.ErrorCode = "SDK_CHECK_FAILED";
                result.Message = $"Failed to verify QuickBooks SDK COM registration: {ex.Message}";
                result.RemediationStep = "Ensure QuickBooks Desktop is installed properly on Windows.";
                return result;
            }

            return result;
        }

        public QBConnectResult Connect(string appName, string companyFilePath = "")
        {
            var result = new QBConnectResult
            {
                Success = false,
                CompanyFilePath = companyFilePath
            };

            // Precondition Check
            var preconditions = CheckPreconditions();
            if (!preconditions.Passed)
            {
                result.AuthorizationStatus = "FAILED_PRECONDITION";
                result.ErrorCode = preconditions.ErrorCode;
                result.ErrorMessage = preconditions.Message;
                result.RemediationStep = preconditions.RemediationStep;
                return result;
            }

            dynamic? requestProcessor = null;
            string ticket = string.Empty;

            try
            {
                Type rpType = Type.GetTypeFromProgID("QBXMLRP2.RequestProcessor") 
                    ?? throw new InvalidOperationException("QBXMLRP2.RequestProcessor COM component not registered.");
                
                requestProcessor = Activator.CreateInstance(rpType);
                if (requestProcessor == null)
                {
                    throw new InvalidOperationException("Could not instantiate QBXMLRP2.RequestProcessor.");
                }

                // Step 1: Open Connection to QuickBooks Desktop SDK
                // appID="", appName from config (user-facing copy shown in popup dialog), connType=1 (ctLocalQBD)
                requestProcessor.OpenConnection2("", appName, 1);

                // Step 2: Begin Session
                // THIS CALL TRIGGERS THE NATIVE QUICKBOOKS APPLICATION CERTIFICATE DIALOG!
                // fileMode = 0 (omDontCare)
                ticket = requestProcessor.BeginSession(companyFilePath, 0);

                result.Ticket = ticket;
                result.Success = true;
                result.AuthorizationStatus = "AUTHORIZED";

                // Step 3: Query Company Name via qbXML
                result.CompanyName = QueryCompanyNameWithProcessor(requestProcessor, ticket);
            }
            catch (COMException comEx)
            {
                result.Success = false;
                result.ErrorCode = $"0x{comEx.ErrorCode:X8}";

                switch (comEx.ErrorCode)
                {
                    case E_QB_USER_DENIED:
                        result.AuthorizationStatus = "DENIED";
                        result.ErrorMessage = "QuickBooks user denied permission to access the company file.";
                        result.RemediationStep = $"To grant permission in QuickBooks Desktop:\n" +
                                                $"1. Open QuickBooks Desktop as Admin.\n" +
                                                $"2. Go to Edit -> Preferences -> Integrated Applications -> Company Preferences.\n" +
                                                $"3. Select '{appName}' and click Properties.\n" +
                                                $"4. Check 'Allow this application to read and modify this company file' and click OK.";
                        break;

                    case E_QB_NOT_RUNNING:
                    case E_QB_CANNOT_START:
                        result.AuthorizationStatus = "FAILED_PRECONDITION";
                        result.ErrorMessage = "QuickBooks Desktop is not running.";
                        result.RemediationStep = "Please open QuickBooks Desktop, log in to your company file as Admin, and try again.";
                        break;

                    case E_QB_NO_COMPANY_FILE:
                        result.AuthorizationStatus = "FAILED_PRECONDITION";
                        result.ErrorMessage = "No company file is open in QuickBooks Desktop.";
                        result.RemediationStep = "Open your target company file in QuickBooks Desktop before running the agent.";
                        break;

                    case E_QB_MULTI_USER_DENIED:
                        result.AuthorizationStatus = "FAILED_PRECONDITION";
                        result.ErrorMessage = "First-time application authorization requires Single-User Mode in QuickBooks Desktop.";
                        result.RemediationStep = "In QuickBooks Desktop, go to File -> Switch to Single-User Mode, log in as Admin, and run the agent again.";
                        break;

                    default:
                        result.AuthorizationStatus = "ERROR";
                        result.ErrorMessage = $"QuickBooks SDK COM Error ({result.ErrorCode}): {comEx.Message}";
                        result.RemediationStep = "Ensure QuickBooks Desktop is open, running as Admin in Single-User Mode, and no modal dialogs are blocking QuickBooks.";
                        break;
                }
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.AuthorizationStatus = "ERROR";
                result.ErrorCode = "UNEXPECTED_ERROR";
                result.ErrorMessage = ex.Message;
                result.RemediationStep = "Check agent logs and verify QuickBooks Desktop SDK environment.";
            }
            finally
            {
                if (requestProcessor != null && !string.IsNullOrEmpty(ticket))
                {
                    try
                    {
                        requestProcessor.EndSession(ticket);
                        requestProcessor.CloseConnection();
                    }
                    catch
                    {
                        // Ignore cleanup errors
                    }
                }
            }

            return result;
        }

        public string QueryCompanyName(string ticket)
        {
            // Helper overload
            return string.Empty;
        }

        private string QueryCompanyNameWithProcessor(dynamic requestProcessor, string ticket)
        {
            try
            {
                string requestXml = @"<?xml version=""1.0"" encoding=""utf-8""?>
<?qbxml version=""13.0""?>
<QBXML>
  <QBXMLMsgsRq onError=""stopOnError"">
    <CompanyQueryRq requestID=""1"" />
  </QBXMLMsgsRq>
</QBXML>";

                string responseXml = requestProcessor.ProcessRequest(ticket, requestXml);
                XmlDocument doc = new XmlDocument();
                doc.LoadXml(responseXml);

                XmlNode? companyNameNode = doc.SelectSingleNode("//CompanyName");
                if (companyNameNode != null && !string.IsNullOrWhiteSpace(companyNameNode.InnerText))
                {
                    return companyNameNode.InnerText;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[QBDesktopConnection] Note: Could not query CompanyName via qbXML: {ex.Message}");
            }

            return "Unknown QuickBooks Company";
        }

        public void Disconnect(string ticket)
        {
            // Handled in finally block during connect session lifecycle
        }
    }
}
