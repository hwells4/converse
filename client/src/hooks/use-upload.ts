import { useState } from "react";
import { AWSService } from "@/lib/aws-service";
import { useCreateDocument, useUpdateDocument } from "./use-documents";
import { useToast } from "@/hooks/use-toast";

export interface UploadState {
  isUploading: boolean;
  progress: number;
  isProcessing: boolean;
  error: string | null;
}

export function useUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    isProcessing: false,
    error: null,
  });

  const createDocument = useCreateDocument();
  const updateDocument = useUpdateDocument();
  const { toast } = useToast();

  const uploadFile = async (
    file: File, 
    documentType: "commission" | "renewal", 
    carrierId: number,
    customFileName?: string
  ) => {
    setUploadState({
      isUploading: true,
      progress: 0,
      isProcessing: false,
      error: null,
    });

    try {
      // Validate file
      if (file.type !== "application/pdf") {
        throw new Error("Only PDF files are allowed");
      }

      if (file.size > 50 * 1024 * 1024) {
        throw new Error("File size must be less than 50MB");
      }

      // Upload to S3 via backend proxy
      const { s3Key, s3Url } = await AWSService.uploadToS3({
        file,
        documentType,
        carrierId,
        customFileName,
        onProgress: (progress) => {
          setUploadState(prev => ({ ...prev, progress }));
        },
      });

      // Create document record
      const finalFileName = customFileName || file.name;
      const document = await createDocument.mutateAsync({
        filename: finalFileName,
        originalName: file.name,
        documentType,
        carrierId,
        s3Key,
        s3Url,
        fileSize: file.size,
        status: "uploaded",
        textractJobId: null,
        csvS3Key: null,
        csvUrl: null,
        jsonS3Key: null,
        jsonUrl: null,
        processingError: null,
        metadata: null,
      });

      setUploadState(prev => ({ ...prev, isUploading: false, isProcessing: true }));

      // Trigger Lambda processing via backend proxy
      try {
        const jobId = await AWSService.triggerTextractLambda({ 
          s3Key, 
          documentType, 
          carrierId 
        });
        
        await updateDocument.mutateAsync({
          id: document.id,
          updates: {
            status: "processing",
            textractJobId: jobId,
          },
        });

        toast({
          title: "Upload Successful",
          description: `${documentType === "commission" ? "Commission Statement" : "Renewal Report"} uploaded and processing started.`,
        });

        // Start polling for results using document status
        startPolling(document.id);

      } catch (processingError) {
        await updateDocument.mutateAsync({
          id: document.id,
          updates: {
            status: "failed",
            processingError: processingError instanceof Error ? processingError.message : "Processing failed",
          },
        });

        throw processingError;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      setUploadState(prev => ({ ...prev, error: errorMessage, isUploading: false, isProcessing: false }));
      
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const startPolling = (documentId: number) => {
    const pollInterval = setInterval(async () => {
      try {
        // Use the new backend API to check document status
        const document = await AWSService.checkProcessingStatus(documentId);
        
        if (document.status === "processed" || document.status === "review_pending") {
          clearInterval(pollInterval);
          
          setUploadState(prev => ({ ...prev, isProcessing: false }));
          
          const statusMessage = document.status === "review_pending" 
            ? "Your document has been processed and is ready for review."
            : "Your document has been processed and the data is available for download.";
          
          toast({
            title: "Processing Complete",
            description: statusMessage,
          });
        } else if (document.status === "failed") {
          clearInterval(pollInterval);
          setUploadState(prev => ({ ...prev, isProcessing: false }));
          
          toast({
            title: "Processing Failed",
            description: document.processingError || "Document processing failed.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 5000); // Poll every 5 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setUploadState(prev => ({ ...prev, isProcessing: false }));
    }, 5 * 60 * 1000);
  };

  const resetUpload = () => {
    setUploadState({
      isUploading: false,
      progress: 0,
      isProcessing: false,
      error: null,
    });
  };

  return {
    uploadState,
    uploadFile,
    resetUpload,
  };
}
