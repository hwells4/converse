import { useState, useEffect } from "react";
import { useDocument, useDocumentProcessedData } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, FileText, AlertCircle, CheckCircle, Edit3, Download } from "lucide-react";
import { format } from "date-fns";

interface DocumentReviewModalProps {
  documentId: number;
  onClose: () => void;
}

interface TableData {
  headers: string[];
  rows: Array<Array<{ value: string; confidence?: number }>>;
}

export function DocumentReviewModal({ documentId, onClose }: DocumentReviewModalProps) {
  const { data: document, isLoading: documentLoading } = useDocument(documentId);
  const { data: processedData, isLoading: dataLoading, error: dataError } = useDocumentProcessedData(documentId);
  const [tableData, setTableData] = useState<TableData | null>(null);

  useEffect(() => {
    if (processedData) {
      // Parse the processed JSON data into table format
      // This will depend on the actual structure from your Lambda
      // For now, assuming a structure like: { headers: string[], rows: Array<Array<{value: string, confidence?: number}>> }
      if (processedData.headers && processedData.rows) {
        setTableData(processedData);
      } else if (Array.isArray(processedData) && processedData.length > 0) {
        // If it's an array of objects, convert to table format
        const headers = Object.keys(processedData[0]);
        const rows = processedData.map(row => 
          headers.map(header => ({
            value: row[header]?.toString() || '',
            confidence: row[`${header}_confidence`] || undefined
          }))
        );
        setTableData({ headers, rows });
      }
    }
  }, [processedData]);

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return '';
    if (confidence >= 0.9) return 'bg-green-50 border-green-200';
    if (confidence >= 0.7) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null;
    
    const percentage = Math.round(confidence * 100);
    if (confidence >= 0.9) {
      return <Badge className="bg-green-100 text-green-800 text-xs ml-2">{percentage}%</Badge>;
    }
    if (confidence >= 0.7) {
      return <Badge className="bg-yellow-100 text-yellow-800 text-xs ml-2">{percentage}%</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800 text-xs ml-2">{percentage}%</Badge>;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Document Review</h2>
              {document && (
                <p className="text-gray-600">{document.originalName}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          {documentLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !document ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Document Not Found</h3>
                <p className="text-gray-600">The requested document could not be found.</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col space-y-6">
              {/* Document Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Document Information</span>
                    <div className="flex items-center space-x-2">
                      {document.status === 'review_pending' && (
                        <Badge className="bg-blue-100 text-blue-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ready for Review
                        </Badge>
                      )}
                      {document.status === 'processing' && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          Processing...
                        </Badge>
                      )}
                      {document.status === 'failed' && (
                        <Badge className="bg-red-100 text-red-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Processing Failed
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-500">File Name:</span>
                      <p className="text-gray-900">{document.originalName}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Document Type:</span>
                      <p className="text-gray-900 capitalize">{document.documentType}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Uploaded:</span>
                      <p className="text-gray-900">{format(new Date(document.uploadedAt), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                    {document.processedAt && (
                      <div>
                        <span className="font-medium text-gray-500">Processed:</span>
                        <p className="text-gray-900">{format(new Date(document.processedAt), 'MMM d, yyyy HH:mm')}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Data Table */}
              <Card className="flex-1 overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Extracted Data</span>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit Data
                      </Button>
                      {document.csvUrl && (
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Download CSV
                        </Button>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  {dataLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : dataError ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Not Available</h3>
                        <p className="text-gray-600">
                          {document.status === 'processing' 
                            ? 'Document is still being processed. Please check back later.'
                            : 'Processed data could not be loaded.'}
                        </p>
                      </div>
                    </div>
                  ) : tableData ? (
                    <div className="overflow-auto h-full border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {tableData.headers.map((header, index) => (
                              <TableHead key={index} className="font-semibold bg-gray-50">
                                {header}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tableData.rows.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <TableCell 
                                  key={cellIndex}
                                  className={`${getConfidenceColor(cell.confidence)} relative`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{cell.value}</span>
                                    {getConfidenceBadge(cell.confidence)}
                                  </div>
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
                        <p className="text-gray-600">No processed data found for this document.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {tableData && (
                <span>{tableData.rows.length} rows • {tableData.headers.length} columns</span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Continue to Review
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 