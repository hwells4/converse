import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useDocuments, useDeleteDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { CSVUploadWizard } from "./csv-upload-wizard";
import { FailedTransactionsReview } from "./failed-transactions-review";
import { FileText, Download, Eye, ArrowRight, Trash2, ExternalLink, ChevronDown, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "review_pending":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
            Ready for Review
          </Badge>
        );
      case "processed":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
            Processed
          </Badge>
        );
      case "uploaded_to_salesforce":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
            Uploaded to Salesforce
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
            Completed
          </Badge>
        );
      case "completed_with_errors":
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
            <div className="w-2 h-2 bg-orange-500 rounded-full mr-1"></div>
            Partial Success
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case "uploading":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Uploading
          </Badge>
        );
      case "salesforce_upload_pending":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Uploading to Salesforce
          </Badge>
        );
      case "correction_pending":
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing Corrections
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
            Failed
          </Badge>
        );
      default:
        return null; // Remove the grey "uploaded" status entirely
    }
  };

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

  const getActionButtons = (document: any) => {
    const isDeleting = deletingDocumentId === document.id;
    
    // Common delete button for all documents
    const deleteButton = (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleDeleteDocument(document.id, document.originalName)}
        disabled={isDeleting}
        className="text-red-600 hover:text-red-700 h-8 px-2"
      >
        <Trash2 className="h-4 w-4 mr-1" />
        {isDeleting ? "Deleting..." : "Delete"}
      </Button>
    );

    // Actions based on document status - Show review for all processed documents
    if (document.status === "processed" || document.status === "review_pending" || document.status === "uploaded_to_salesforce" || document.status === "completed" || document.status === "completed_with_errors") {
      return (
        <div className="flex items-center space-x-1">
          {/* Primary Action Button */}
          {document.status === "processing" ? (
            <div className="flex items-center space-x-2 text-yellow-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Processing...</span>
            </div>
          ) : document.status === "review_pending" ? (
            <Button
              size="sm"
              onClick={() => {
                // For CSV wizard, we need to fetch the document data and open the wizard
                // This will be handled by a function that fetches CSV data and opens the wizard
                handleOpenCSVWizard(document);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Review
            </Button>
          ) : document.status === "completed_with_errors" ? (
            <Button
              size="sm"
              onClick={() => {
                handleOpenFailedTransactions(document);
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white h-8 px-3"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Review Errors
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                handleOpenCSVWizard(document);
              }}
              className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
          )}
          
          {/* Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {document.status === "completed_with_errors" && (
                <DropdownMenuItem
                  onClick={() => {
                    handleOpenFailedTransactions(document);
                  }}
                  className="cursor-pointer text-orange-600 hover:text-orange-700"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Review Failed Transactions
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  handleOpenCSVWizard(document);
                }}
                className="cursor-pointer"
              >
                <Eye className="h-4 w-4 mr-2" />
                View CSV Preview
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDownloadCSV(document.csvUrl!, document.originalName)}
                className="cursor-pointer"
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteDocument(document.id, document.originalName)}
                disabled={deletingDocumentId === document.id}
                className="cursor-pointer text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deletingDocumentId === document.id ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    // For processing, failed, or uploaded documents
    return (
      <div className="flex items-center space-x-1">
        {document.status === "processing" ? (
          <div className="flex items-center space-x-2 text-yellow-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Processing...</span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">
            {document.status === "failed" ? "Processing failed" : "Not available"}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => handleDeleteDocument(document.id, document.originalName)}
              disabled={deletingDocumentId === document.id}
              className="cursor-pointer text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deletingDocumentId === document.id ? "Deleting..." : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
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
              {isLoading ? (
                // Loading skeletons
                Array.from({ length: 3 }).map((_, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Skeleton className="w-8 h-8 rounded-lg mr-3" />
                        <div>
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-3">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-12" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : documents && documents.length > 0 ? (
                documents.map((document) => (
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
                      {getStatusBadge(document.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(document.uploadedAt), "MMM dd, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {getActionButtons(document)}
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
