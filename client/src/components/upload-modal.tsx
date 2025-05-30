import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useUpload } from "@/hooks/use-upload";
import { useDocuments } from "@/hooks/use-documents";
import { useCarriers } from "@/hooks/use-carriers";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X, Check, AlertCircle, Calendar, Building2 } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: "commission" | "renewal" | null;
  onOpenCSVWizard?: (parsedData: any, fileName: string, carrierId: number) => void;
}

interface ParsedSpreadsheetData {
  headers: string[];
  rows: string[][];
  detectedHeaderRow: number;
}

export function UploadModal({ isOpen, onClose, documentType, onOpenCSVWizard }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState("");
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>("");
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateDocument, setDuplicateDocument] = useState<any>(null);
  const [fileType, setFileType] = useState<'pdf' | 'csv' | 'xlsx' | null>(null);
  const { uploadState, uploadFile, resetUpload } = useUpload();
  const { data: documents } = useDocuments();
  const { data: carriers, isLoading: carriersLoading } = useCarriers();
  const { toast } = useToast();

  // Show "Coming Soon" message for renewal reports
  if (documentType === "renewal") {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-6 w-6 text-green-600" />
              Renewal Reports
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon!</h3>
            <p className="text-gray-600 text-sm mb-6">
              Currently, we only support commission statements. Renewal report processing will be available in a future update.
            </p>
            <Button onClick={onClose} className="w-full">
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const sanitizeFileName = (fileName: string): string => {
    // Remove file extension
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    // Replace spaces and special characters with underscores
    return nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  };

  const generateFileName = (originalName: string, customName?: string): string => {
    const today = format(new Date(), "yyyy-MM-dd");
    const sanitizedOriginal = sanitizeFileName(originalName);
    const sanitizedCustom = customName ? sanitizeFileName(customName) : "";
    
    if (sanitizedCustom) {
      return `${today}_${sanitizedCustom}_${sanitizedOriginal}`;
    }
    return `${today}_${sanitizedOriginal}`;
  };

  const detectFileType = (file: File): 'pdf' | 'csv' | 'xlsx' | null => {
    if (file.type === "application/pdf") return 'pdf';
    if (file.type === "text/csv" || file.name.toLowerCase().endsWith('.csv')) return 'csv';
    if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
        file.name.toLowerCase().endsWith('.xlsx')) return 'xlsx';
    return null;
  };

  const detectHeaderRow = (rows: string[][]): number => {
    // Simple heuristic: look for the first row with mostly non-empty, string values
    // that seem like headers (no numbers, reasonable length)
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      if (row.length === 0) continue;
      
      const nonEmptyCount = row.filter(cell => cell && cell.trim()).length;
      const stringCount = row.filter(cell => 
        cell && cell.trim() && isNaN(Number(cell)) && cell.length > 1 && cell.length < 50
      ).length;
      
      // If most cells are non-empty strings that look like headers
      if (nonEmptyCount >= 3 && stringCount / nonEmptyCount >= 0.7) {
        return i;
      }
    }
    return 0; // Default to first row
  };

  const parseSpreadsheetFile = async (file: File): Promise<ParsedSpreadsheetData> => {
    return new Promise((resolve, reject) => {
      if (file.name.toLowerCase().endsWith('.csv')) {
        Papa.parse(file, {
          complete: (results) => {
            const rows = results.data as string[][];
            const detectedHeaderRow = detectHeaderRow(rows);
            const headers = rows[detectedHeaderRow] || [];
            const dataRows = rows.slice(detectedHeaderRow + 1).filter(row => 
              row.some(cell => cell && cell.trim())
            );
            
            resolve({
              headers,
              rows: dataRows,
              detectedHeaderRow
            });
          },
          error: (error) => reject(error)
        });
      } else if (file.name.toLowerCase().endsWith('.xlsx')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            const rows = jsonData as string[][];
            
            const detectedHeaderRow = detectHeaderRow(rows);
            const headers = rows[detectedHeaderRow] || [];
            const dataRows = rows.slice(detectedHeaderRow + 1).filter(row => 
              row.some(cell => cell && cell.toString().trim())
            );
            
            resolve({
              headers: headers.map(h => h?.toString() || ''),
              rows: dataRows.map(row => row.map(cell => cell?.toString() || '')),
              detectedHeaderRow
            });
          } catch (error) {
            reject(error);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Unsupported file type'));
      }
    });
  };

  const checkForDuplicates = (file: File) => {
    if (!documents) return false;
    
    const generatedName = generateFileName(file.name, customFileName);
    const duplicate = documents.find(doc => 
      doc.filename.includes(sanitizeFileName(file.name)) || 
      doc.originalName === file.name
    );
    
    if (duplicate) {
      setDuplicateDocument(duplicate);
      return true;
    }
    return false;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const detectedFileType = detectFileType(file);
      
      // Validate file type
      if (!detectedFileType) {
        toast({
          title: "Unsupported File Type",
          description: "Please upload a PDF, CSV, or XLSX file.",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 50MB.",
          variant: "destructive",
        });
        return;
      }

      setFileType(detectedFileType);
      setSelectedFile(file);

      // Check for duplicates
      if (checkForDuplicates(file)) {
        setShowDuplicateWarning(true);
      }
    }
  }, [documents, customFileName, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!selectedCarrierId) {
      toast({
        title: "Carrier Required",
        description: "You must select a carrier before uploading a document.",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedFile && documentType && selectedCarrierId) {
      const finalFileName = generateFileName(selectedFile.name, customFileName);
      
      // All files (PDF, CSV, XLSX) now go through S3 upload
      const uploadResult = await uploadFile(selectedFile, documentType, parseInt(selectedCarrierId), finalFileName);
      
      // For CSV/XLSX files, if upload was successful, open field mapping immediately
      if ((fileType === 'csv' || fileType === 'xlsx') && uploadResult && onOpenCSVWizard) {
        // Parse the file for field mapping
        try {
          const parsed = await parseSpreadsheetFile(selectedFile);
          
          // Close the upload modal first
          handleClose();
          
          // Open CSV wizard through callback
          onOpenCSVWizard(parsed, finalFileName, parseInt(selectedCarrierId));
        } catch (error) {
          toast({
            title: "File Parse Error",
            description: "Unable to parse the spreadsheet file. Please check the file format.",
            variant: "destructive",
          });
        }
      }
    }
  };

  const handleDuplicateConfirm = async () => {
    setShowDuplicateWarning(false);
    if (selectedFile && documentType && selectedCarrierId) {
      const finalFileName = generateFileName(selectedFile.name, customFileName);
      await uploadFile(selectedFile, documentType, parseInt(selectedCarrierId), finalFileName);
    }
  };

  const handleDuplicateCancel = () => {
    setShowDuplicateWarning(false);
    setSelectedFile(null);
    setDuplicateDocument(null);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setCustomFileName("");
    setSelectedCarrierId("");
    setShowDuplicateWarning(false);
    setDuplicateDocument(null);
    setFileType(null);
    resetUpload();
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getDocumentTypeLabel = () => {
    return documentType === "commission" ? "Commission Statement" : "Renewal Report";
  };

  const canUpload = selectedFile && documentType && selectedCarrierId && !uploadState.isUploading && !uploadState.isProcessing;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Upload Document
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Upload your {getDocumentTypeLabel()} file (PDF, CSV, or XLSX)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Carrier Selection */}
          <div className="space-y-2">
            <Label htmlFor="carrier" className="text-sm font-medium text-gray-700">
              Insurance Carrier *
            </Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Select value={selectedCarrierId} onValueChange={setSelectedCarrierId}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="Select insurance carrier" />
                </SelectTrigger>
                <SelectContent>
                  {carriersLoading ? (
                    <SelectItem value="" disabled>Loading carriers...</SelectItem>
                  ) : (
                    carriers?.map((carrier) => (
                      <SelectItem key={carrier.id} value={carrier.id.toString()}>
                        {carrier.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500">
              Select the insurance carrier associated with this document
            </p>
          </div>

          {/* Custom File Name Input */}
          <div className="space-y-2">
            <Label htmlFor="customFileName" className="text-sm font-medium text-gray-700">
              Custom File Name (Optional)
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="customFileName"
                type="text"
                placeholder="e.g., client_abc_january_commission"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-gray-500">
              Files will be named: {format(new Date(), "yyyy-MM-dd")}_{customFileName ? sanitizeFileName(customFileName) + "_" : ""}{selectedFile ? sanitizeFileName(selectedFile.name) : "filename"}
            </p>
          </div>

          {/* Upload Area */}
          {!selectedFile && (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                ${isDragActive 
                  ? "border-blue-500 bg-blue-50" 
                  : "border-gray-300 bg-gray-50 hover:border-blue-500 hover:bg-blue-50"
                }
              `}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Drop your file here
              </h4>
              <p className="text-gray-600 mb-4">or click to browse and select a file</p>
              <div className="text-sm text-gray-500">
                <p>Supported formats: PDF, CSV, XLSX</p>
                <p>Maximum file size: 50MB</p>
              </div>
            </div>
          )}

          {/* File Preview */}
          {selectedFile && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">{formatFileSize(selectedFile.size)} • {fileType?.toUpperCase()}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploadState.isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Uploading to S3...</span>
                <span className="text-sm text-gray-600">{Math.round(uploadState.progress)}%</span>
              </div>
              <Progress value={uploadState.progress} className="h-2" />
            </div>
          )}

          {/* Processing Status */}
          {(uploadState.isProcessing || uploadState.progress === 100) && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-sm">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </div>
                <span className="text-gray-700">File uploaded to S3 bucket</span>
              </div>
              
              <div className="flex items-center space-x-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  uploadState.isProcessing 
                    ? "border-2 border-blue-500" 
                    : "bg-green-500"
                }`}>
                  {uploadState.isProcessing ? (
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  ) : (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <span className="text-gray-700">
                  {uploadState.isProcessing ? "Starting Textract analysis..." : "Textract analysis complete"}
                </span>
              </div>

              <div className="flex items-center space-x-3 text-sm">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  uploadState.isProcessing 
                    ? "border-2 border-gray-300" 
                    : "border-2 border-blue-500"
                }`}>
                  {!uploadState.isProcessing && (
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  )}
                </div>
                <span className="text-gray-700">
                  {uploadState.isProcessing ? "Waiting for processing..." : "Processing documents..."}
                </span>
              </div>
            </div>
          )}

          {/* Upload Error */}
          {uploadState.error && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-900">Upload Failed</p>
                  <p className="text-sm text-red-700">{uploadState.error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={!canUpload}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {uploadState.isUploading ? "Uploading..." : "Upload Document"}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Duplicate Warning Dialog */}
      <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span>Potential Duplicate File</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {duplicateDocument && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-yellow-600" />
                    <div>
                      <p className="font-medium text-yellow-900">{duplicateDocument.originalName}</p>
                      <p className="text-sm text-yellow-700">
                        Uploaded on {format(new Date(duplicateDocument.uploadedAt), "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-sm">
                Are you sure you want to upload this file? This will create a new record and may result in duplicate processing.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDuplicateCancel}>
              Cancel Upload
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDuplicateConfirm}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Upload Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}