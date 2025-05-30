import { useState } from "react";
import { UploadModal } from "@/components/upload-modal";
import { RecentDocuments } from "@/components/recent-documents";
import { ToastNotifications } from "@/components/toast-notifications";
import { CSVUploadWizard } from "@/components/csv-upload-wizard";
import { Button } from "@/components/ui/button";
import { FileText, DollarSign, Shield, User } from "lucide-react";

export default function Home() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<"commission" | "renewal" | null>(null);
  const [csvWizardData, setCsvWizardData] = useState<{
    isOpen: boolean;
    parsedData: any;
    fileName: string;
    carrierId: number;
  }>({
    isOpen: false,
    parsedData: null,
    fileName: "",
    carrierId: 0,
  });

  const handleUploadClick = (documentType: "commission" | "renewal") => {
    setSelectedDocumentType(documentType);
    setIsUploadModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsUploadModalOpen(false);
    setSelectedDocumentType(null);
  };

  const handleOpenCSVWizard = (parsedData: any, fileName: string, carrierId: number) => {
    setCsvWizardData({
      isOpen: true,
      parsedData,
      fileName,
      carrierId,
    });
  };

  const handleCloseCSVWizard = () => {
    setCsvWizardData({
      isOpen: false,
      parsedData: null,
      fileName: "",
      carrierId: 0,
    });
  };

  const handleCSVWizardComplete = (finalData: any) => {
    console.log("CSV wizard complete, ready for Salesforce:", finalData);
    handleCloseCSVWizard();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Converse Insurance</h1>
                <p className="text-sm text-gray-500">Document Processing Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                John Smith
              </div>
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <div className="mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Converse Insurance</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Upload your documents for automated processing. Our advanced system will extract and analyze data from your PDFs, providing you with structured CSV reports.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Commission Statement Upload */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Commission Statement</h3>
                <p className="text-gray-600 text-sm">Upload commission statements for automated data extraction and reporting</p>
              </div>
              <Button 
                onClick={() => handleUploadClick("commission")}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                size="lg"
              >
                <FileText className="h-5 w-5 mr-2" />
                Upload Commission Statement
              </Button>
            </div>

            {/* Renewal Report Upload */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
              <div className="mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Renewal Report</h3>
                <p className="text-gray-600 text-sm">Upload renewal reports for policy analysis and data processing</p>
              </div>
              <Button 
                onClick={() => handleUploadClick("renewal")}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors"
                size="lg"
              >
                <FileText className="h-5 w-5 mr-2" />
                Upload Renewal Report
              </Button>
            </div>
          </div>
        </div>

        {/* Recent Documents */}
        <RecentDocuments />

        {/* Upload Modal */}
        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={handleCloseModal}
          documentType={selectedDocumentType}
          onOpenCSVWizard={handleOpenCSVWizard}
        />

        {/* CSV Upload Wizard */}
        {csvWizardData.isOpen && csvWizardData.parsedData && (
          <CSVUploadWizard
            isOpen={csvWizardData.isOpen}
            onClose={handleCloseCSVWizard}
            parsedData={csvWizardData.parsedData}
            fileName={csvWizardData.fileName}
            carrierId={csvWizardData.carrierId}
            onComplete={handleCSVWizardComplete}
          />
        )}

        {/* Toast Notifications */}
        <ToastNotifications />
      </main>
    </div>
  );
}
