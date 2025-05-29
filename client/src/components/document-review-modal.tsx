import { useState, useEffect } from "react";
import { useDocument, useDocumentProcessedData, useDocumentProcessedCSVData } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, FileText, AlertCircle, CheckCircle, Edit3, Download, ChevronRight, ArrowRight, ArrowDown } from "lucide-react";
import { format } from "date-fns";

interface DocumentReviewModalProps {
  documentId: number;
  onClose: () => void;
}

interface TableData {
  headers: string[];
  rows: Array<Array<{ value: string; confidence?: number }>>;
}

interface RowSelection {
  [rowIndex: number]: boolean;
}

export function DocumentReviewModal({ documentId, onClose }: DocumentReviewModalProps) {
  const { data: document, isLoading: documentLoading } = useDocument(documentId);
  const { data: processedData, isLoading: dataLoading, error: dataError } = useDocumentProcessedData(documentId);
  const { data: csvData, isLoading: csvLoading, error: csvError } = useDocumentProcessedCSVData(documentId);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [viewMode, setViewMode] = useState<'json' | 'csv'>('json');
  const [selectedRows, setSelectedRows] = useState<RowSelection>({});
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    const currentData = viewMode === 'csv' ? csvData : processedData;
    
    if (currentData) {
      console.log(`Processing ${viewMode} data:`, currentData);
      console.log("Data type:", typeof currentData);
      console.log("Data keys:", Object.keys(currentData));
      
      // Handle CSV data (already in the right format)
      if (viewMode === 'csv' && currentData.headers && currentData.rows) {
        console.log("Using CSV data format");
        setTableData(currentData);
        return;
      }
      
      // Handle JSON data (original logic)
      if (viewMode === 'json') {
        // NEW APPROACH: Use tables from JSON to create a clean CSV-like display
        if (currentData.tables && Array.isArray(currentData.tables) && currentData.tables.length > 0) {
          console.log("Found tables:", currentData.tables.length);
          
          const firstTable = currentData.tables[0];
          console.log("First table:", firstTable);
          
          if (firstTable.rows && Array.isArray(firstTable.rows) && firstTable.rows.length > 0) {
            console.log("Table has rows:", firstTable.rows.length);
            
            // Extract headers from the first row
            const firstRow = firstTable.rows[0];
            const headers = firstRow?.cells?.map((cell: any) => cell.text || '') || [];
            
            // Convert all remaining rows to clean data (no confidence in separate columns)
            const rows = firstTable.rows.slice(1).map((row: any) => 
              row.cells?.map((cell: any) => ({
                value: cell.text || '',
                confidence: cell.confidence || 0 // Keep confidence but don't display it separately
              })) || []
            );
            
            console.log("Extracted headers:", headers);
            console.log("Converted rows:", rows.length);
            setTableData({ headers, rows });
            return;
          }
        } else if (currentData.keyValuePairs && Array.isArray(currentData.keyValuePairs) && currentData.keyValuePairs.length > 0) {
          console.log("Found key-value pairs:", currentData.keyValuePairs.length);
          // Clean key-value display
          const headers = ['Key', 'Value'];
          const rows = currentData.keyValuePairs.map((pair: any) => [
            { value: pair.key || '', confidence: pair.keyConfidence || 0 },
            { value: pair.value || '', confidence: pair.valueConfidence || 0 }
          ]);
          
          setTableData({ headers, rows });
          return;
        } else if (currentData.rawLines && Array.isArray(currentData.rawLines) && currentData.rawLines.length > 0) {
          console.log("Found raw lines:", currentData.rawLines.length);
          // Clean lines display
          const headers = ['Text', 'Page'];
          const rows = currentData.rawLines.map((line: any) => [
            { value: line.text || '', confidence: line.confidence || 0 },
            { value: line.pageNumber?.toString() || '', confidence: 100 }
          ]);
          
          setTableData({ headers, rows });
          return;
        } else {
          // Fallback: try the original logic for backwards compatibility
          if (currentData.headers && currentData.rows) {
            console.log("Using fallback: headers and rows format");
            setTableData(currentData);
            return;
          } else if (Array.isArray(currentData) && currentData.length > 0) {
            console.log("Using fallback: array of objects format");
            const headers = Object.keys(currentData[0]);
            const rows = currentData.map(row => 
              headers.map(header => ({
                value: row[header]?.toString() || '',
                confidence: row[`${header}_confidence`] || 0
              }))
            );
            setTableData({ headers, rows });
            return;
          }
        }
      }
      
      console.log("No processable data found in:", currentData);
      setTableData(null);
    } else {
      console.log(`No ${viewMode} data available`);
      setTableData(null);
    }
  }, [processedData, csvData, viewMode]);

  // Reset selection when data changes
  useEffect(() => {
    setSelectedRows({});
    setSelectAll(false);
  }, [tableData]);

  // Handle row selection
  const handleRowSelect = (rowIndex: number, checked: boolean) => {
    setSelectedRows(prev => ({
      ...prev,
      [rowIndex]: checked
    }));
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (!tableData) return;
    
    const newSelection: RowSelection = {};
    if (checked) {
      tableData.rows.forEach((_, index) => {
        newSelection[index] = true;
      });
    }
    setSelectedRows(newSelection);
  };

  // Get selected row count
  const selectedCount = Object.values(selectedRows).filter(Boolean).length;
  const totalRows = tableData?.rows.length || 0;

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence || confidence === 0) return '';
    // Confidence is already in 0-100 range from Lambda
    if (confidence >= 90) return 'bg-green-50 border-green-200';
    if (confidence >= 70) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence || confidence === 0 || confidence === 100) return null;
    
    // Confidence is already in 0-100 range from Lambda
    const percentage = Math.round(confidence);
    if (confidence >= 90) {
      return <Badge className="bg-green-100 text-green-800 text-xs ml-2">{percentage}%</Badge>;
    }
    if (confidence >= 70) {
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
                      <p className="text-gray-900">
                        {document.uploadedAt 
                          ? format(new Date(document.uploadedAt), 'MMM d, yyyy HH:mm')
                          : 'Unknown'
                        }
                      </p>
                    </div>
                    {document.processedAt && (
                      <div>
                        <span className="font-medium text-gray-500">Processed:</span>
                        <p className="text-gray-900">
                          {format(new Date(document.processedAt), 'MMM d, yyyy HH:mm')}
                        </p>
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
                      {/* View Mode Toggle */}
                      <div className="flex items-center space-x-2 mr-4">
                        <span className="text-sm text-gray-600">View:</span>
                        <Button
                          variant={viewMode === 'json' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('json')}
                          className="text-xs"
                        >
                          JSON
                        </Button>
                        <Button
                          variant={viewMode === 'csv' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('csv')}
                          className="text-xs"
                        >
                          CSV
                        </Button>
                      </div>
                      
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
                  {(viewMode === 'json' ? dataLoading : csvLoading) ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (viewMode === 'json' ? dataError : csvError) ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Not Available</h3>
                        <p className="text-gray-600">
                          {document.status === 'processing' 
                            ? 'Document is still being processed. Please check back later.'
                            : `Processed ${viewMode.toUpperCase()} data could not be loaded.`}
                        </p>
                      </div>
                    </div>
                  ) : tableData ? (
                    <div className="h-full flex flex-col">
                      {/* Selection Controls */}
                      <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={selectAll}
                              onCheckedChange={handleSelectAll}
                              id="select-all"
                            />
                            <label htmlFor="select-all" className="text-sm font-medium text-gray-700 cursor-pointer">
                              Select All
                            </label>
                          </div>
                          <span className="text-sm text-gray-600">
                            {selectedCount} of {totalRows} rows selected
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <ArrowRight className="h-3 w-3" />
                          <span>Scroll right for more columns</span>
                          <ArrowDown className="h-3 w-3 ml-4" />
                          <span>Scroll down for more rows</span>
                        </div>
                      </div>

                      {/* Table Container */}
                      <div className="flex-1 relative">
                        <ScrollArea className="h-full w-full">
                          <div className="min-w-full">
                            {/* Header */}
                            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
                              <div className="flex">
                                {/* Selection column */}
                                <div className="w-12 flex-shrink-0 p-2 bg-gray-50 border-r border-gray-200">
                                  <div className="h-8 flex items-center justify-center">
                                    <span className="text-xs font-medium text-gray-500">#</span>
                                  </div>
                                </div>
                                
                                {/* Data columns */}
                                {tableData.headers.map((header, index) => (
                                  <div 
                                    key={index}
                                    className="min-w-[120px] max-w-[250px] flex-shrink-0 p-2 bg-gray-50 border-r border-gray-200 last:border-r-0"
                                  >
                                    <div className="h-8 flex items-center">
                                      <span className="text-xs font-semibold text-gray-700 truncate" title={header}>
                                        {header}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Rows */}
                            <div className="divide-y divide-gray-100">
                              {tableData.rows.map((row, rowIndex) => (
                                <div 
                                  key={rowIndex}
                                  className={`flex hover:bg-gray-50 transition-colors ${
                                    selectedRows[rowIndex] ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                                  }`}
                                >
                                  {/* Selection column */}
                                  <div className="w-12 flex-shrink-0 p-2 border-r border-gray-200">
                                    <div className="h-8 flex items-center justify-center">
                                      <Checkbox
                                        checked={selectedRows[rowIndex] || false}
                                        onCheckedChange={(checked) => handleRowSelect(rowIndex, checked as boolean)}
                                        className="scale-90"
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Data columns */}
                                  {row.map((cell, cellIndex) => (
                                    <div 
                                      key={cellIndex}
                                      className={`min-w-[120px] max-w-[250px] flex-shrink-0 p-2 border-r border-gray-200 last:border-r-0 ${
                                        getConfidenceColor(cell.confidence)
                                      }`}
                                    >
                                      <div className="h-8 flex items-center justify-between">
                                        <span 
                                          className="text-sm text-gray-900 truncate mr-1" 
                                          title={cell.value}
                                        >
                                          {cell.value}
                                        </span>
                                        {getConfidenceBadge(cell.confidence)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        </ScrollArea>
                      </div>
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
            <div className="flex items-center space-x-6">
              <div className="text-sm text-gray-500">
                {tableData && (
                  <span>{tableData.rows.length} rows • {tableData.headers.length} columns</span>
                )}
              </div>
              {selectedCount > 0 && (
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-blue-600 font-medium">{selectedCount} rows selected</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedRows({});
                      setSelectAll(false);
                    }}
                  >
                    Clear Selection
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {selectedCount > 0 ? (
                <Button className="bg-green-600 hover:bg-green-700">
                  Approve {selectedCount} Row{selectedCount === 1 ? '' : 's'}
                </Button>
              ) : (
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Review All Data
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 