// Frontend AWS Service - Refactored to use backend proxy endpoints
// This eliminates direct AWS credentials in the frontend

export interface UploadToS3Params {
  file: File;
  documentType: "commission" | "renewal";
  carrierId: number;
  customFileName?: string;
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  s3Key: string;
  s3Url: string;
}

export interface LambdaInvocationParams {
  s3Key: string;
  documentType: "commission" | "renewal";
  carrierId: number;
}

export interface PDFParserParams {
  s3Key: string;
  documentType: "commission" | "renewal";
  carrierId: number;
  documentId: number;
}

export class AWSService {
  private static apiBaseUrl = 'https://db59eecd-7dcd-4e12-a7ea-047fe8f08497-00-2h9g2oppbu6bq.riker.replit.dev';

  /**
   * Upload file to S3 using backend-generated presigned URL
   */
  static async uploadToS3({ file, documentType, carrierId, customFileName, onProgress }: UploadToS3Params): Promise<UploadResult> {
    try {
      console.log('🚀 Starting S3 upload process...');
      console.log('📁 File details:', {
        name: file.name,
        size: file.size,
        type: file.type,
        documentType,
        carrierId,
        customFileName
      });

      // Step 1: Request presigned URL from backend
      const filename = customFileName || file.name;
      
      console.log('📡 Requesting presigned URL from backend...');
      console.log('🔗 API URL:', `${this.apiBaseUrl}/api/s3/presigned-upload-url`);
      
      const requestBody = {
        carrierId,
        filename,
        documentType,
        contentType: file.type,
      };
      console.log('📤 Request body:', requestBody);
      
      const presignedResponse = await fetch(`${this.apiBaseUrl}/api/s3/presigned-upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Presigned URL response status:', presignedResponse.status);
      console.log('📥 Presigned URL response headers:', Object.fromEntries(presignedResponse.headers.entries()));

      if (!presignedResponse.ok) {
        const errorText = await presignedResponse.text();
        console.error('❌ Presigned URL request failed:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: errorText };
        }
        throw new Error(error.message || 'Failed to generate upload URL');
      }

      const responseData = await presignedResponse.json();
      console.log('✅ Presigned URL received:', {
        s3Key: responseData.s3Key,
        uploadUrlLength: responseData.uploadUrl?.length,
        s3Url: responseData.s3Url
      });

      const { uploadUrl, s3Key, s3Url } = responseData;

      if (!uploadUrl || !s3Key) {
        console.error('❌ Invalid response from backend:', responseData);
        throw new Error('Invalid response from backend: missing uploadUrl or s3Key');
      }

      // Step 2: Upload file directly to S3 using presigned URL
      console.log('☁️ Starting direct S3 upload...');
      if (onProgress) {
        onProgress(10);
      }

      // Use XMLHttpRequest for better progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 90) + 10; // 10-100%
            console.log(`📊 Upload progress: ${progress}% (${event.loaded}/${event.total} bytes)`);
            onProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          console.log('📤 S3 upload completed with status:', xhr.status);
          console.log('📤 S3 response headers:', xhr.getAllResponseHeaders());
          console.log('📤 S3 response text:', xhr.responseText);
          
          if (xhr.status >= 200 && xhr.status < 300) {
            if (onProgress) onProgress(100);
            console.log('✅ S3 upload successful!');
            resolve({ s3Key, s3Url });
          } else {
            console.error('❌ S3 upload failed with status:', xhr.status);
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
          }
        });

        xhr.addEventListener('error', (event) => {
          console.error('❌ S3 upload error event:', event);
          console.error('❌ XMLHttpRequest error details:', {
            readyState: xhr.readyState,
            status: xhr.status,
            statusText: xhr.statusText,
            responseText: xhr.responseText
          });
          reject(new Error('Upload failed due to network error'));
        });

        xhr.addEventListener('timeout', () => {
          console.error('❌ S3 upload timeout');
          reject(new Error('Upload timed out'));
        });

        console.log('🔄 Initiating XMLHttpRequest to S3...');
        console.log('🔗 S3 Upload URL (first 100 chars):', uploadUrl.substring(0, 100) + '...');
        
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

    } catch (error) {
      console.error("💥 S3 upload failed with error:", error);
      console.error("💥 Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Trigger PDF Parser service via backend endpoint
   */
  static async triggerPDFParser({ s3Key, documentType, carrierId, documentId }: PDFParserParams): Promise<void> {
    try {
      console.log('🚀 Starting PDF parser invocation...');
      console.log('📋 PDF parser params:', { s3Key, documentType, carrierId, documentId });
      console.log('🔗 PDF parser API URL:', `${this.apiBaseUrl}/api/pdf-parser/trigger`);

      const requestBody = {
        s3Key,
        documentType,
        carrierId,
        documentId,
      };
      console.log('📤 PDF parser request body:', requestBody);

      const response = await fetch(`${this.apiBaseUrl}/api/pdf-parser/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 PDF parser response status:', response.status);
      console.log('📥 PDF parser response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ PDF parser invocation failed:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: errorText };
        }
        throw new Error(error.message || 'Failed to start PDF parsing');
      }

      console.log('✅ PDF parser invocation successful');
    } catch (error) {
      console.error("💥 PDF parser invocation failed with error:", error);
      console.error("💥 Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      throw new Error(`Failed to start PDF parsing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download processed CSV via backend endpoint
   */
  static async downloadCSV(csvS3Key: string): Promise<string> {
    try {
      // We can use either direct S3 key download or document ID
      // For now, let's use the S3 download URL endpoint
      const response = await fetch(`${this.apiBaseUrl}/api/s3/download-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ s3Key: csvS3Key }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate download URL');
      }

      const { downloadUrl } = await response.json();

      // Download the actual CSV content
      const csvResponse = await fetch(downloadUrl);
      if (!csvResponse.ok) {
        throw new Error('Failed to download CSV content');
      }

      return await csvResponse.text();
    } catch (error) {
      console.error("Failed to download CSV:", error);
      throw new Error(`Failed to download CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download processed JSON via backend endpoint (for document ID)
   */
  static async downloadProcessedJSON(documentId: number): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/documents/${documentId}/processed-json`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch processed data');
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to download JSON:", error);
      throw new Error(`Failed to fetch processed data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse CSV content into structured data
   */
  static parseCSV(csvContent: string): { headers: string[]; rows: string[][]; totalRows: number } {
    const lines = csvContent.trim().split("\n");
    const headers = lines[0].split(",").map(header => header.trim().replace(/"/g, ""));
    const rows = lines.slice(1).map(line => 
      line.split(",").map(cell => cell.trim().replace(/"/g, ""))
    );

    return {
      headers,
      rows,
      totalRows: rows.length,
    };
  }

  /**
   * Check if processing is complete by checking document status
   */
  static async checkProcessingStatus(documentId: number): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/documents/${documentId}`);
      
      if (!response.ok) {
        throw new Error('Failed to check document status');
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to check processing status:", error);
      throw new Error(`Failed to check document status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
