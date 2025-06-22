import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckCircle, Eye, AlertTriangle, Download, Trash2, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentStatus } from "./status-badge";

interface ActionButtonProps {
  status: DocumentStatus;
  onReview?: () => void;
  onPreview?: () => void;
  onReviewErrors?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  className?: string;
}

export function ActionButton({
  status,
  onReview,
  onPreview,
  onReviewErrors,
  onDownload,
  onDelete,
  isDeleting = false,
  className
}: ActionButtonProps) {
  const isProcessing = ["processing", "uploading", "salesforce_upload_pending", "correction_pending"].includes(status);
  const isActionable = ["review_pending", "processed", "completed", "completed_with_errors", "uploaded_to_salesforce"].includes(status);

  // Processing states - show spinner and text
  if (isProcessing) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <div className="flex items-center space-x-2 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">
            {status === "processing" && "Processing..."}
            {status === "uploading" && "Uploading..."}
            {status === "salesforce_upload_pending" && "Preparing upload..."}
            {status === "correction_pending" && "Processing corrections..."}
          </span>
        </div>
        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={onDelete}
                disabled={isDeleting}
                className="cursor-pointer text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }

  // Actionable states - show primary action + dropdown
  if (isActionable) {
    return (
      <div className={cn("flex items-center space-x-1", className)}>
        {/* Primary Action Button */}
        {status === "review_pending" && onReview && (
          <Button
            size="sm"
            onClick={onReview}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 font-medium"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Review
          </Button>
        )}
        
        {status === "completed_with_errors" && onReviewErrors && (
          <Button
            size="sm"
            onClick={onReviewErrors}
            className="bg-orange-600 hover:bg-orange-700 text-white h-8 px-3 font-medium"
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            Review Errors
          </Button>
        )}
        
        {(status === "processed" || status === "completed" || status === "uploaded_to_salesforce") && onPreview && (
          <Button
            size="sm"
            onClick={onPreview}
            className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 font-medium"
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
            {status === "completed_with_errors" && onReviewErrors && (
              <DropdownMenuItem
                onClick={onReviewErrors}
                className="cursor-pointer text-orange-600 hover:text-orange-700"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Review Failed Transactions
              </DropdownMenuItem>
            )}
            
            {onPreview && (
              <DropdownMenuItem
                onClick={onPreview}
                className="cursor-pointer"
              >
                <Eye className="h-4 w-4 mr-2" />
                View CSV Preview
              </DropdownMenuItem>
            )}
            
            {onDownload && (
              <DropdownMenuItem
                onClick={onDownload}
                className="cursor-pointer"
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </DropdownMenuItem>
            )}
            
            {onDelete && (
              <DropdownMenuItem
                onClick={onDelete}
                disabled={isDeleting}
                className="cursor-pointer text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Non-actionable states - show status message + delete option
  return (
    <div className={cn("flex items-center space-x-1", className)}>
      <span className="text-gray-400 text-sm font-medium">
        {status === "failed" ? "Processing failed" : "Not available"}
      </span>
      {onDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={onDelete}
              disabled={isDeleting}
              className="cursor-pointer text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "Deleting..." : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}