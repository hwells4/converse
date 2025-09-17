import { useState, useEffect, useRef } from "react";
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
  
  // Track active polling intervals for cleanup
  const activeIntervalsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Cleanup all active intervals when component unmounts
  useEffect(() => {
    return () => {
      // Clear all active polling intervals on unmount
      activeIntervalsRef.current.forEach((intervalId) => {
        clearInterval(intervalId);
      });
      activeIntervalsRef.current.clear();
    };
  }, []);

  // Cleanup function for intervals
  const clearPollingInterval = (intervalId: NodeJS.Timeout) => {
    clearInterval(intervalId);
    activeIntervalsRef.current.delete(intervalId);
  };

  const startPolling = (documentId: number) => {
    const pollInterval = setInterval(async () => {
      try {
        const document = await AWSService.checkProcessingStatus(documentId);
        
        if (document.status === "processed" || document.status === "review_pending") {
          clearPollingInterval(pollInterval);
          setUploadState(prev => ({ ...prev, isProcessing: false }));
          
          toast({
            title: "Processing Complete",
            description: "Document has been processed and is ready for review.",
          });
        } else if (document.status === "failed") {
          clearPollingInterval(pollInterval);
          setUploadState(prev => ({ ...prev, isProcessing: false, error: "Processing failed" }));
          
          toast({
            title: "Processing Failed",
            description: "Document processing encountered an error.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 5000);
    
    // Track this interval for cleanup
    activeIntervalsRef.current.add(pollInterval);
    
    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      clearPollingInterval(pollInterval);
    }, 300000);
  };

  const resetUpload = () => {
    setUploadState({
      isUploading: false,
      progress: 0,
      isProcessing: false,
      error: null,
    });
  };

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
      // Validate file size
      if (file.size > 50 * 1024 * 1024) {
        throw new Error("File size must be less than 50MB");
      }

      // Validate file type - now supports PDF, CSV, and XLSX
      const allowedTypes = [
        "application/pdf",
        "text/csv", 
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ];
      const allowedExtensions = ['.pdf', '.csv', '.xlsx'];
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        throw new Error("Only PDF, CSV, and XLSX files are allowed");
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

      setUploadState(prev => ({ ...prev, isUploading: false, isProcessing: false }));

      // Check if this is a spreadsheet file (CSV/XLSX)
      const isSpreadsheet = fileExtension === '.csv' || fileExtension === '.xlsx';
      
      if (isSpreadsheet) {
        // For spreadsheet files, update status to review_pending and return document for field mapping
        await updateDocument.mutateAsync({
          id: document.id,
          updates: {
            status: "review_pending",
          },
        });

        toast({
          title: "Upload Successful",
          description: `${documentType === "commission" ? "Commission Statement" : "Renewal Report"} uploaded successfully. Ready for field mapping.`,
        });

        return document; // Return document for field mapping
      } else {
        // For PDF files, trigger PDF parsing service
        setUploadState(prev => ({ ...prev, isProcessing: true }));
        
        console.log('🔄 [Upload Hook] Starting PDF processing for document:', document.id);
        const processingStartTime = Date.now();
        
        try {
          await AWSService.triggerPDFParser({ 
            s3Key, 
            documentType, 
            carrierId,
            documentId: document.id
          });
          
          const processingTime = Date.now() - processingStartTime;
          console.log('✅ [Upload Hook] PDF processing trigger completed in', processingTime, 'ms');
          
          await updateDocument.mutateAsync({
            id: document.id,
            updates: {
              status: "processing",
            },
          });

          toast({
            title: "Upload Successful",
            description: `${documentType === "commission" ? "Commission Statement" : "Renewal Report"} uploaded and parsing started.`,
          });

          // Start polling for results using document status
          startPolling(document.id);

          // Reset processing state since the API call is complete
          setUploadState(prev => ({ ...prev, isProcessing: false }));

          // Return the document so the modal knows the upload was successful
          return document;

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

  return {
    uploadState,
    uploadFile,
    resetUpload,
  };
}