import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useDocuments, useDeleteDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { CSVPreview } from "./csv-preview";
// import { FieldMappingModal } from "./field-mapping-modal";
import { FileText, Download, Eye, ArrowRight, Trash2, ExternalLink, ChevronDown, CheckCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export function RecentDocuments() {
  const { data: documents, isLoading } = useDocuments();
  const deleteDocument = useDeleteDocument();
  const { toast } = useToast();
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
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
  const previousDocuments = useRef<Document[]>([]);
  
  // Check for status changes and show notifications
  useEffect(() => {
    if (documents && previousDocuments.current.length > 0) {
      documents.forEach((currentDoc) => {
        const previousDoc = previousDocuments.current.find(doc => doc.id === currentDoc.id);
        if (previousDoc && previousDoc.status !== currentDoc.status && currentDoc.status === 'review_pending') {
          toast({
            title: "Document Processing Complete",
            description: `${currentDoc.originalName || currentDoc.filename} is ready for review.`,
            variant: "default",
          });
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
      case "processing":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1 animate-pulse"></div>
            Processing
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
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            <div className="w-2 h-2 bg-gray-500 rounded-full mr-1"></div>
            Uploaded
          </Badge>
        );
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

    // Actions based on document status
    if ((document.status === "processed" || document.status === "review_pending") && document.csvUrl) {
      return (
        <div className="flex items-center space-x-1">
          {/* Primary Action Button */}
          {document.status === "review_pending" ? (
            <Button
              size="sm"
              onClick={() => {
                setSelectedDocumentId(document.id);
                setShowReviewModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Review
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setSelectedDocumentId(document.id);
                setShowReviewModal(false);
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
              <DropdownMenuItem
                onClick={() => {
                  setSelectedDocumentId(document.id);
                  setShowReviewModal(false);
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
        <span className="text-gray-400 text-sm">
          {document.status === "processing" ? "Processing..." : 
           document.status === "failed" ? "Processing failed" : "Not available"}
        </span>
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

  // Temporarily disabled field mapping modal
  // if (selectedDocumentId && showReviewModal) {
  //   return (
  //     <FieldMappingModal 
  //       documentId={selectedDocumentId} 
  //       onClose={() => {
  //         setSelectedDocumentId(null);
  //         setShowReviewModal(false);
  //       }} 
  //     />
  //   );
  // }

  if (selectedDocumentId && !showReviewModal) {
    return (
      <CSVPreview 
        documentId={selectedDocumentId} 
        onClose={() => {
          setSelectedDocumentId(null);
          setShowReviewModal(false);
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
