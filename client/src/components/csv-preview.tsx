import { useState, useEffect } from "react";
import { useDocument } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AWSService } from "@/lib/aws-service";
import { Download, X } from "lucide-react";

interface CSVPreviewProps {
  documentId: number;
  onClose: () => void;
}

interface CSVData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export function CSVPreview({ documentId, onClose }: CSVPreviewProps) {
  const { data: documentData, isLoading: documentLoading } = useDocument(documentId);
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [isLoadingCSV, setIsLoadingCSV] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (documentData?.csvS3Key) {
      loadCSVData();
    }
  }, [documentData]);

  const loadCSVData = async () => {
    if (!documentData?.csvS3Key) return;

    setIsLoadingCSV(true);
    setError(null);

    try {
      const csvContent = await AWSService.downloadCSV(documentData.csvS3Key);
      const parsed = AWSService.parseCSV(csvContent);
      setCsvData(parsed);
    } catch (error) {
      setError("Failed to load CSV data");
      console.error("Error loading CSV:", error);
    } finally {
      setIsLoadingCSV(false);
    }
  };

  const handleDownloadCSV = () => {
    if (documentData?.csvUrl && documentData?.originalName) {
      const link = document.createElement("a");
      link.href = documentData.csvUrl;
      link.download = documentData.originalName.replace(".pdf", ".csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (documentLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <div className="flex space-x-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="p-6">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Document not found</p>
        <Button variant="outline" onClick={onClose} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold text-gray-900">Extracted Data Preview</h3>
        <div className="flex items-center space-x-3">
          <Button
            onClick={handleDownloadCSV}
            disabled={!documentData.csvUrl}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Full CSV
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close Preview
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">
                {documentData.originalName?.replace(".pdf", ".csv") || "Unknown file.csv"}
              </h4>
              <p className="text-sm text-gray-600">
                {csvData ? `${csvData.totalRows} records extracted` : "Loading..."}
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {csvData && csvData.totalRows > 10 && "Showing first 10 rows"}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoadingCSV ? (
            <div className="p-6">
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button variant="outline" onClick={loadCSVData}>
                Retry
              </Button>
            </div>
          ) : csvData ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {csvData.headers.map((header, index) => (
                    <th
                      key={index}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {csvData.rows.slice(0, 10).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3 text-sm text-gray-900">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500">No data available</p>
            </div>
          )}
        </div>

        {csvData && csvData.totalRows > 10 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
            <p className="text-sm text-gray-600">
              ... and <span className="font-medium">{csvData.totalRows - 10}</span> more rows.{" "}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadCSV}
                className="text-blue-600 hover:text-blue-700 p-0 h-auto font-medium"
              >
                Download complete CSV file
              </Button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
