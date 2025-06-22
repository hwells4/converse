import { useState } from "react";
import { Link } from "wouter";
import { useDocuments, useDeleteDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type DocumentStatus } from "@/components/ui/status-badge";
import { ActionButton } from "@/components/ui/action-button";
import { DocumentsPageTableSkeleton } from "@/components/ui/loading-skeleton";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { CSVUploadWizard } from "@/components/csv-upload-wizard";
import { FailedTransactionsReview } from "@/components/failed-transactions-review";
import { ToastNotifications } from "@/components/toast-notifications";
import { DocumentStatusDebugger } from "@/components/document-status-debugger";
import { FileText, ArrowLeft, Search, Filter, Shield } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Documents() {
  const { data: documents, isLoading } = useDocuments();
  const deleteDocument = useDeleteDocument();
  const { toast } = useToast();
  const [csvWizardData, setCsvWizardData] = useState<{
    isOpen: boolean;
    parsedData: any;
    fileName: string;
    carrierId: number;
  } | null>(null);

  const [failedTransactionsData, setFailedTransactionsData] = useState<{
    isOpen: boolean;
    failedTransactions: any[];
    document: any;
  } | null>(null);

  const handleOpenCSVWizard = async (document: any) => {
    try {
      console.log("Opening CSV wizard for document:", document);
      
      // Fetch the actual CSV data from the backend
      const response = await fetch(`/api/documents/${document.id}/csv-data`);
      if (!response.ok) {
        // Try to get error message from response, but handle cases where response body is empty
        let errorMessage = `Failed to fetch CSV data: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (jsonError) {
          // Response body is not JSON or is empty - use the default error message
          console.warn("Could not parse error response as JSON:", jsonError);
        }
        throw new Error(errorMessage);
      }
      
      const csvData = await response.json();
      console.log("Received CSV data:", csvData);
      
      // Transform the data to match the CSV wizard format
      const parsedData = {
        headers: csvData.headers || [],
        rows: csvData.rows?.map((row: any[]) => 
          row.map((cell: any) => typeof cell === 'object' ? cell.value : cell)
        ) || [],
        detectedHeaderRow: 0
      };
      
      setCsvWizardData({
        isOpen: true,
        parsedData,
        fileName: document.originalName || document.filename,
        carrierId: document.carrierId || 1
      });
    } catch (error) {
      console.error("Error opening CSV wizard:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load document data for review",
        variant: "destructive",
      });
    }
  };

  const handleOpenFailedTransactions = (document: any) => {
    const metadata = document.metadata;
    const completionData = metadata?.completionData;
    const failedTransactions = completionData?.failedTransactions || [];
    
    setFailedTransactionsData({
      isOpen: true,
      failedTransactions,
      document
    });
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    documentId: number | null;
    documentName: string;
  }>({
    isOpen: false,
    documentId: null,
    documentName: "",
  });


  const getDocumentTypeBadge = (type: string) => {
    const isCommission = type === "commission";
    return (
      <Badge className={`${isCommission ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"} hover:bg-current`}>
        {isCommission ? "Commission" : "Renewal"}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleDownloadCSV = (csvUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = csvUrl;
    link.download = filename.replace(".pdf", ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteDocument = async (documentId: number, documentName: string) => {
    setDeleteConfirmation({
      isOpen: true,
      documentId,
      documentName,
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.documentId) return;

    setDeletingDocumentId(deleteConfirmation.documentId);
    
    try {
      await deleteDocument.mutateAsync(deleteConfirmation.documentId);

      toast({
        title: "Document Deleted",
        description: `"${deleteConfirmation.documentName}" has been deleted successfully.`,
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingDocumentId(null);
      setDeleteConfirmation({
        isOpen: false,
        documentId: null,
        documentName: "",
      });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmation({
      isOpen: false,
      documentId: null,
      documentName: "",
    });
  };

  const filteredDocuments = documents?.filter(doc => {
    const matchesSearch = doc.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    const matchesType = typeFilter === "all" || doc.documentType === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-800">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Document Management</h1>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">All Documents</h2>
          <p className="text-gray-600">
            Manage your uploaded commission statements and renewal reports
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="uploading">Uploading</SelectItem>
                  <SelectItem value="review_pending">Review Pending</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="completed_with_errors">Partial Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="commission">Commission</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        {!isLoading && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Showing {filteredDocuments.length} of {documents?.length || 0} documents
            </p>
          </div>
        )}

        {/* Documents Table */}
        {isLoading ? (
          <DocumentsPageTableSkeleton />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDocuments.length > 0 ? (
                    filteredDocuments.map((document) => (
                      <tr key={document.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                              <FileText className="h-4 w-4 text-red-600" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {document.originalName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatFileSize(document.fileSize)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getDocumentTypeBadge(document.documentType)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={document.status as DocumentStatus} showTooltip />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(document.uploadedAt), "MMM dd, yyyy 'at' h:mm a")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <ActionButton
                            status={document.status as DocumentStatus}
                            onReview={() => handleOpenCSVWizard(document)}
                            onPreview={() => handleOpenCSVWizard(document)}
                            onReviewErrors={() => handleOpenFailedTransactions(document)}
                            onDownload={document.csvUrl ? () => handleDownloadCSV(document.csvUrl!, document.originalName) : undefined}
                            onDelete={() => handleDeleteDocument(document.id, document.originalName)}
                            isDeleting={deletingDocumentId === document.id}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="text-gray-500">
                          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <h3 className="text-lg font-medium mb-2">
                            {searchTerm || statusFilter !== "all" || typeFilter !== "all" 
                              ? "No documents match your filters" 
                              : "No documents yet"
                            }
                          </h3>
                          <p className="text-sm">
                            {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                              ? "Try adjusting your search or filters."
                              : "Upload your first document to get started."
                            }
                          </p>
                          {(searchTerm || statusFilter !== "all" || typeFilter !== "all") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSearchTerm("");
                                setStatusFilter("all");
                                setTypeFilter("all");
                              }}
                              className="mt-4"
                            >
                              Clear Filters
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <ConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Document"
        description={`Are you sure you want to delete "${deleteConfirmation.documentName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deletingDocumentId === deleteConfirmation.documentId}
      />
      
      {/* CSV Upload Wizard */}
      {csvWizardData?.isOpen && (
        <CSVUploadWizard 
          isOpen={csvWizardData.isOpen}
          onClose={() => {
            setCsvWizardData(null);
          }}
          parsedData={csvWizardData.parsedData}
          fileName={csvWizardData.fileName}
          carrierId={csvWizardData.carrierId}
          onComplete={(finalData) => {
            console.log("CSV wizard completed:", finalData);
            setCsvWizardData(null);
          }}
        />
      )}

      {/* Failed Transactions Review */}
      {failedTransactionsData?.isOpen && (
        <FailedTransactionsReview
          isOpen={failedTransactionsData.isOpen}
          onClose={() => setFailedTransactionsData(null)}
          failedTransactions={failedTransactionsData.failedTransactions}
          document={failedTransactionsData.document}
          onResubmit={(correctedTransactions) => {
            console.log("Corrected transactions:", correctedTransactions);
            setFailedTransactionsData(null);
          }}
        />
      )}
      
      <ToastNotifications />
      
      {/* Status Debugger - Show in development or with ?debug=true */}
      {(process.env.NODE_ENV === 'development' || 
        new URLSearchParams(window.location.search).get('debug') === 'true') && (
        <DocumentStatusDebugger />
      )}
    </div>
  );
}