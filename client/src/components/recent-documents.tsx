import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useDocuments, useDeleteDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type DocumentStatus } from "@/components/ui/status-badge";
import { ActionButton } from "@/components/ui/action-button";
import { RecentDocumentsTableSkeleton } from "@/components/ui/loading-skeleton";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { CSVUploadWizard } from "./csv-upload-wizard";
import { FailedTransactionsReview } from "./failed-transactions-review";
import { FileText, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Document as DocumentType } from "@shared/schema";


export function RecentDocuments() {
  const { data: documents, isLoading } = useDocuments();
  const deleteDocument = useDeleteDocument();
  const { toast } = useToast();
  const [csvWizardData, setCsvWizardData] = useState<{
    isOpen: boolean;
    parsedData: any;
    fileName: string;
    carrierId: number;
    documentId: number;
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
      
      console.log("🔵 CSV fetch response status:", response.status);
      console.log("🔵 CSV fetch response headers:", Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        // Try to get error message from response, but handle cases where response body is empty
        let errorMessage = `Failed to fetch CSV data: ${response.status} ${response.statusText}`;
        let responseText = '';
        
        try {
          responseText = await response.text();
          console.log("🔵 Error response body:", responseText);
          
          if (responseText) {
            const errorData = JSON.parse(responseText);
            if (errorData && errorData.message) {
              errorMessage = errorData.message;
              
              // Special handling for Railway/Doctly processing issues
              if (errorMessage.includes("The specified key does not exist")) {
                errorMessage = "The document appears to have been processed, but the CSV file is missing from storage. This is likely a processing service issue. Please try re-uploading the document or contact support.";
              }
            }
          }
        } catch (jsonError) {
          // Response body is not JSON or is empty - use the default error message
          console.warn("Could not parse error response as JSON:", jsonError);
          console.warn("Raw response text:", responseText);
        }
        
        console.error("🔴 Final error message:", errorMessage);
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
        carrierId: document.carrierId || 1,
        documentId: document.id
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
  
  // Track previous document statuses to detect changes
  const previousDocuments = useRef<DocumentType[]>([]);
  
  // Check for status changes and show notifications
  useEffect(() => {
    if (documents && previousDocuments.current.length > 0) {
      documents.forEach((currentDoc) => {
        const previousDoc = previousDocuments.current.find(doc => doc.id === currentDoc.id);
        if (previousDoc && previousDoc.status !== currentDoc.status) {
          // Notification for review pending
          if (currentDoc.status === 'review_pending') {
            toast({
              title: "Document Processing Complete",
              description: `${currentDoc.originalName || currentDoc.filename} is ready for review.`,
              variant: "default",
            });
          }
          // Notification for completed status
          else if (currentDoc.status === 'completed') {
            const completionData = (currentDoc.metadata as any)?.completionData;
            let description = `${currentDoc.originalName || currentDoc.filename} has been completed successfully.`;
            
            if (completionData) {
              description = completionData.message || description;
            }
            
            toast({
              title: "Document Upload Complete",
              description,
              variant: "default",
            });
          }
          // Notification for corrections processed
          else if (currentDoc.status === 'completed_with_errors') {
            const completionData = (currentDoc.metadata as any)?.completionData;
            const correctionHistory = completionData?.correctionHistory;
            
            // Check if there's a new correction attempt
            if (correctionHistory && correctionHistory.length > 0) {
              const latestCorrection = correctionHistory[correctionHistory.length - 1];
              const previousDoc = previousDocuments.current.find(doc => doc.id === currentDoc.id);
              const previousHistory = (previousDoc?.metadata as any)?.completionData?.correctionHistory || [];
              
              // If we have a new correction entry, show notification
              if (correctionHistory.length > previousHistory.length) {
                toast({
                  title: "Correction Update",
                  description: `${latestCorrection.successful} of ${latestCorrection.attempted} corrections successful. ${completionData.numberOfSuccessful}/${completionData.totalTransactions} total completed.`,
                  variant: "default",
                });
              }
            }
          }
        }
      });
    }
    previousDocuments.current = documents || [];
  }, [documents, toast]);


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


  if (failedTransactionsData?.isOpen) {
    return (
      <FailedTransactionsReview
        isOpen={failedTransactionsData.isOpen}
        onClose={() => setFailedTransactionsData(null)}
        failedTransactions={failedTransactionsData.failedTransactions}
        document={failedTransactionsData.document}
        onResubmit={(correctedTransactions) => {
          console.log("Corrected transactions:", correctedTransactions);
          // TODO: Implement resubmission to Salesforce
        }}
      />
    );
  }

  if (csvWizardData?.isOpen) {
    return (
      <CSVUploadWizard 
        isOpen={csvWizardData.isOpen}
        onClose={() => {
          setCsvWizardData(null);
        }}
        parsedData={csvWizardData.parsedData}
        fileName={csvWizardData.fileName}
        carrierId={csvWizardData.carrierId}
        documentId={csvWizardData.documentId}
        onComplete={(finalData) => {
          console.log("CSV wizard completed:", finalData);
          setCsvWizardData(null);
        }}
      />
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-semibold text-gray-900">Recent Documents</h3>
        <Link href="/documents">
          <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <RecentDocumentsTableSkeleton />
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
                {documents && documents.length > 0 ? (
                  documents.slice(0, 3).map((document) => (
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
                        {format(new Date(document.uploadedAt), "MMM dd, yyyy")}
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
                        <h3 className="text-lg font-medium mb-2">No documents yet</h3>
                        <p className="text-sm">Upload your first document to get started.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
    </div>
  );
}
