import { useState } from "react";
import { Link } from "wouter";
import { useDocuments } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CSVPreview } from "@/components/csv-preview";
import { FileText, Download, Eye, ArrowLeft, Search, Filter, Shield } from "lucide-react";
import { format } from "date-fns";

export default function Documents() {
  const { data: documents, isLoading } = useDocuments();
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

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

  const filteredDocuments = documents?.filter(doc => {
    const matchesSearch = doc.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    const matchesType = typeFilter === "all" || doc.documentType === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  }) || [];

  if (selectedDocumentId) {
    return (
      <CSVPreview 
        documentId={selectedDocumentId} 
        onClose={() => setSelectedDocumentId(null)} 
      />
    );
  }

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
                        {(document.status === "processed" || document.status === "review_pending") && document.csvUrl ? (
                          <div className="flex space-x-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadCSV(document.csvUrl!, document.originalName)}
                              className="text-blue-600 hover:text-blue-700 h-8 px-2"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedDocumentId(document.id)}
                              className="text-gray-600 hover:text-gray-800 h-8 px-2"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </div>
                        ) : (
                          <span className="text-gray-400">
                            {document.status === "processing" ? "Processing..." : "Not available"}
                          </span>
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
    </div>
  );
}