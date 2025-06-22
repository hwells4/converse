import { Badge } from "@/components/ui/badge";
import { StatusBadge, type DocumentStatus } from "@/components/ui/status-badge";
import { ActionButton } from "@/components/ui/action-button";
import { FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Document } from "@shared/schema";

interface DocumentRowProps {
  document: Document;
  onReview?: (document: Document) => void;
  onPreview?: (document: Document) => void;
  onReviewErrors?: (document: Document) => void;
  onDownload?: (document: Document) => void;
  onDelete?: (document: Document) => void;
  isDeleting?: boolean;
  compact?: boolean; // For recent documents layout
  className?: string;
}

export function DocumentRow({
  document,
  onReview,
  onPreview,
  onReviewErrors,
  onDownload,
  onDelete,
  isDeleting = false,
  compact = false,
  className
}: DocumentRowProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getDocumentTypeBadge = (type: string) => {
    const isCommission = type === "commission";
    return (
      <Badge className={cn(
        "font-medium",
        isCommission 
          ? "bg-blue-100 text-blue-800 hover:bg-blue-100" 
          : "bg-green-100 text-green-800 hover:bg-green-100"
      )}>
        {isCommission ? "Commission" : "Renewal"}
      </Badge>
    );
  };

  const handleDownload = () => {
    if (document.csvUrl && onDownload) {
      onDownload(document);
    }
  };

  return (
    <tr className={cn("hover:bg-gray-50 transition-colors", className)}>
      {/* Document Info */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
            <FileText className="h-4 w-4 text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 truncate">
              {document.originalName}
            </div>
            <div className="text-sm text-gray-500">
              {formatFileSize(document.fileSize)}
            </div>
          </div>
        </div>
      </td>

      {/* Document Type */}
      <td className="px-6 py-4 whitespace-nowrap">
        {getDocumentTypeBadge(document.documentType)}
      </td>

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <StatusBadge 
          status={document.status as DocumentStatus} 
          showTooltip={!compact}
        />
      </td>

      {/* Upload Date */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {format(
          new Date(document.uploadedAt), 
          compact ? "MMM dd, yyyy" : "MMM dd, yyyy 'at' h:mm a"
        )}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <ActionButton
          status={document.status as DocumentStatus}
          onReview={onReview ? () => onReview(document) : undefined}
          onPreview={onPreview ? () => onPreview(document) : undefined}
          onReviewErrors={onReviewErrors ? () => onReviewErrors(document) : undefined}
          onDownload={document.csvUrl && onDownload ? handleDownload : undefined}
          onDelete={onDelete ? () => onDelete(document) : undefined}
          isDeleting={isDeleting}
        />
      </td>
    </tr>
  );
}

// Specialized version for recent documents with more compact layout
export function RecentDocumentRow(props: Omit<DocumentRowProps, 'compact'>) {
  return <DocumentRow {...props} compact />;
}

// Table wrapper component for consistency
interface DocumentTableProps {
  children: React.ReactNode;
  className?: string;
}

export function DocumentTable({ children, className }: DocumentTableProps) {
  return (
    <div className={cn("bg-white rounded-xl shadow-sm border border-gray-200", className)}>
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
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}