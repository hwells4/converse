import { useAuthFetch } from "@/lib/auth-fetch";
import { AWSService, type UploadToS3Params, type UploadResult, type PDFParserParams } from "@/lib/aws-service";

export function useAWSService() {
  const authFetch = useAuthFetch();
  
  const uploadToS3 = async (params: UploadToS3Params): Promise<UploadResult> => {
    const { file, documentType, carrierId, customFileName, onProgress } = params;
    
    try {
      console.log('🚀 Starting authenticated S3 upload process...');
      
      // Step 1: Request presigned URL from backend with auth
      const filename = customFileName || file.name;
      const requestBody = {
        carrierId,
        filename,
        documentType,
        contentType: file.type,
      };
      
      const presignedResponse = await authFetch(`/api/s3/presigned-upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!presignedResponse.ok) {
        const errorText = await presignedResponse.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: errorText };
        }
        throw new Error(error.message || 'Failed to generate upload URL');
      }

      const { uploadUrl, s3Key, s3Url } = await presignedResponse.json();

      // Step 2: Upload to S3 (doesn't need auth, uses presigned URL)
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      console.log('✅ File uploaded successfully');
      onProgress?.(100);

      return { s3Key, s3Url };
    } catch (error) {
      console.error('❌ Upload error:', error);
      throw error;
    }
  };

  const triggerPDFParser = async (params: PDFParserParams): Promise<void> => {
    const response = await authFetch(`/api/pdf-parser/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to trigger PDF parser');
    }
  };

  const checkProcessingStatus = async (documentId: number) => {
    // GET requests to documents endpoint don't need auth in our setup
    const response = await fetch(`/api/documents/${documentId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch document status');
    }
    return response.json();
  };

  return {
    uploadToS3,
    triggerPDFParser,
    checkProcessingStatus,
  };
}