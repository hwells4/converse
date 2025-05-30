import { useState } from "react";
import { Link } from "wouter";
import { useDocuments, useDeleteDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { CSVUploadWizard } from "@/components/csv-upload-wizard";
import { ToastNotifications } from "@/components/toast-notifications";
import { FileText, Download, Eye, ArrowLeft, Search, Filter, Shield, Trash2, ChevronDown, CheckCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

  const handleOpenCSVWizard = async (document: any) => {
    try {
      console.log("Opening CSV wizard for document:", document);
      
      // Fetch the actual CSV data from the backend
      const response = await fetch(`/api/documents/${document.id}/csv-data`);
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV data: ${response.status} ${response.statusText}`);
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
        description: "Failed to load document data for review",
        variant: "destructive",
      });
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
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
      case "review_pending":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
            Review Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            Failed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
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
                  <SelectItem value="review_pending">Review Pending</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
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
                  Array.from({ length: 8 }).map((_, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Skeleton className="w-8 h-8 rounded-lg mr-3" />
                          <div>
                            <Skeleton className="h-4 w-40 mb-1" />
                            <Skeleton className="h-3 w-20" />
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
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-3">
                          <Skeleton className="h-8 w-20" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filteredDocuments.length > 0 ? (
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
                        {getStatusBadge(document.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(document.uploadedAt), "MMM dd, yyyy 'at' h:mm a")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {document.csvUrl ? (
                          <div className="flex items-center space-x-1">
                            {/* Primary Action Button - Always show Review for documents with CSV */}
                            <Button
                              size="sm"
                              onClick={() => {
                                console.log("Review button clicked for document:", document.id, "status:", document.status);
                                handleOpenCSVWizard(document);
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                            
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
                                    console.log("CSV Preview dropdown clicked for document:", document.id);
                                    setReviewDocumentId(null); // Clear review modal state
                                    setSelectedDocumentId(document.id);
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
                        ) : (
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400 text-sm">
                              {document.status === "processing" ? "Processing..." : "Not available"}
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
                        )}
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
      
      {/* Field Mapping Modal */}
      {reviewDocumentId && (
        <FieldMappingModal
          documentId={reviewDocumentId}
          onClose={() => {
            console.log("Closing field mapping modal");
            setReviewDocumentId(null);
          }}
        />
      )}
      
      {/* CSV Preview Modal */}
      {selectedDocumentId && (
        <CSVPreview 
          documentId={selectedDocumentId} 
          onClose={() => {
            console.log("Closing CSV preview");
            setSelectedDocumentId(null);
          }} 
        />
      )}
      
      <ToastNotifications />
    </div>
  );
}