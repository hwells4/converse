import { useState } from "react";
import { UploadModal } from "@/components/upload-modal";
import { RecentDocuments } from "@/components/recent-documents";
import { ToastNotifications } from "@/components/toast-notifications";
import { CSVUploadWizard } from "@/components/csv-upload-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { FileText, DollarSign, Shield } from "lucide-react";
import { useRequireAuth } from "@/hooks/use-auth";
import { ProfileMenu } from "@/components/profile-menu";

export default function Home() {
  const { isLoading, user } = useRequireAuth();
  
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

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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
                <h1 className="text-xl font-semibold text-gray-900">Converse AI Hub</h1>
                <p className="text-sm text-gray-500">Intelligent Document Processing Platform</p>
              </div>
            </div>
            {user && <ProfileMenu user={user} />}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <div className="mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Your AI-Powered Workspace</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Transform your commission statements into actionable data with our intelligent processing system. 
              <span className="text-blue-600 font-medium"> Ready when you are.</span>
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Commission Statement Upload */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Commission Processing</h3>
                <p className="text-gray-600 text-sm">Your go-to solution for intelligent commission statement processing</p>
              </div>
              <Button 
                onClick={() => handleUploadClick("commission")}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                size="lg"
              >
                <FileText className="h-5 w-5 mr-2" />
                Process Commission Statement
              </Button>
            </div>

            {/* Expanded Capabilities - Subtle Hint */}
            <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl shadow-sm border border-gray-300 p-8 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <div className="absolute top-4 right-4 bg-gray-600 text-white px-3 py-1 rounded-full text-xs font-medium opacity-70">
                More Available
              </div>
              <div className="mb-6">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-100 transition-colors">
                  <Shield className="h-8 w-8 text-gray-500 group-hover:text-blue-600 transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Beyond Commission Processing</h3>
                <div className="text-gray-600 text-sm space-y-2 opacity-80">
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full group-hover:bg-blue-500 transition-colors"></div>
                    <span>Any document, any format</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full group-hover:bg-blue-500 transition-colors"></div>
                    <span>Direct Salesforce integration</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full group-hover:bg-blue-500 transition-colors"></div>
                    <span>Email processing workflows</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full group-hover:bg-blue-500 transition-colors"></div>
                    <span>Custom field mapping</span>
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-200 text-gray-600 py-3 px-6 rounded-lg font-medium text-center border border-gray-300 group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition-all cursor-pointer">
                <span className="group-hover:hidden">Need something more?</span>
                <span className="hidden group-hover:inline">Let's talk about your needs</span>
              </div>
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
