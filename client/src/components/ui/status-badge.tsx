import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DocumentStatus = 
  | "uploaded"
  | "processing"
  | "review_pending"
  | "processed"
  | "uploading"
  | "salesforce_upload_pending"
  | "correction_pending"
  | "uploaded_to_salesforce"
  | "completed"
  | "completed_with_errors"
  | "failed";

interface StatusBadgeProps {
  status: DocumentStatus;
  className?: string;
  showTooltip?: boolean;
}

const statusConfig: Record<DocumentStatus, {
  label: string;
  color: string;
  icon?: "dot" | "spinner";
  description?: string;
}> = {
  uploaded: {
    label: "Uploaded",
    color: "bg-gray-100 text-gray-800",
    icon: "dot",
    description: "Document has been uploaded and is queued for processing"
  },
  processing: {
    label: "Processing",
    color: "bg-blue-100 text-blue-800",
    icon: "spinner",
    description: "Document is being analyzed and processed"
  },
  review_pending: {
    label: "Ready for Review",
    color: "bg-emerald-100 text-emerald-800",
    icon: "dot",
    description: "Document processing complete - ready for your review"
  },
  processed: {
    label: "Processed",
    color: "bg-green-100 text-green-800",
    icon: "dot",
    description: "Document has been successfully processed"
  },
  uploading: {
    label: "Uploading to Salesforce",
    color: "bg-blue-100 text-blue-800",
    icon: "spinner",
    description: "Data is being uploaded to Salesforce"
  },
  salesforce_upload_pending: {
    label: "Uploading to Salesforce",
    color: "bg-blue-100 text-blue-800",
    icon: "spinner",
    description: "Preparing to upload data to Salesforce"
  },
  correction_pending: {
    label: "Processing Corrections",
    color: "bg-amber-100 text-amber-800",
    icon: "spinner",
    description: "Processing corrections for failed transactions"
  },
  uploaded_to_salesforce: {
    label: "Uploaded to Salesforce",
    color: "bg-green-100 text-green-800",
    icon: "dot",
    description: "Successfully uploaded to Salesforce"
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-800",
    icon: "dot",
    description: "All transactions completed successfully"
  },
  completed_with_errors: {
    label: "Needs Attention",
    color: "bg-orange-100 text-orange-800",
    icon: "dot",
    description: "Some transactions need review or correction"
  },
  failed: {
    label: "Failed",
    color: "bg-red-100 text-red-800",
    icon: "dot",
    description: "Processing failed - please try again"
  }
};

export function StatusBadge({ status, className, showTooltip = false }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  if (!config) {
    return null;
  }

  const badge = (
    <Badge 
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        config.color,
        className
      )}
    >
      {config.icon === "spinner" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <div className={cn(
          "w-2 h-2 rounded-full",
          config.color.includes("gray") && "bg-gray-500",
          config.color.includes("blue") && "bg-blue-500",
          config.color.includes("emerald") && "bg-emerald-500",
          config.color.includes("green") && "bg-green-500",
          config.color.includes("amber") && "bg-amber-500",
          config.color.includes("orange") && "bg-orange-500",
          config.color.includes("red") && "bg-red-500"
        )} />
      )}
      {config.label}
    </Badge>
  );

  if (showTooltip && config.description) {
    return (
      <div title={config.description}>
        {badge}
      </div>
    );
  }

  return badge;
}