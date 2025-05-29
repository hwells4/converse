import { useState, useEffect } from "react";
import { useDocument, useDocumentProcessedCSVData } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, FileText, AlertCircle, CheckCircle, ArrowRight, Upload, Eye } from "lucide-react";
import { format } from "date-fns";

interface FieldMappingModalProps {
  documentId: number;
  onClose: () => void;
}

interface ExtractedColumn {
  index: number;
  name: string;
  sampleValues: string[];
}

interface FieldMapping {
  [extractedColumnIndex: number]: string; // Maps to Salesforce field name
}

// Predefined Salesforce fields for commission documents
const SALESFORCE_FIELDS = [
  { value: "policy_number", label: "Policy Number" },
  { value: "insured_name", label: "Insured Name" },
  { value: "effective_date", label: "Effective Date" },
  { value: "expiration_date", label: "Expiration Date" },
  { value: "premium_amount", label: "Premium Amount" },
  { value: "commission_amount", label: "Commission Amount" },
  { value: "commission_rate", label: "Commission Rate" },
  { value: "transaction_type", label: "Transaction Type" },
  { value: "product_type", label: "Product Type" },
  { value: "agency_code", label: "Agency Code" },
  { value: "carrier_name", label: "Carrier Name" },
  { value: "transaction_date", label: "Transaction Date" },
  { value: "skip", label: "Skip This Column" }
];

export function FieldMappingModal({ documentId, onClose }: FieldMappingModalProps) {
  const { data: document, isLoading: documentLoading } = useDocument(documentId);
  const { data: csvData, isLoading: csvLoading, error: csvError } = useDocumentProcessedCSVData(documentId);
  const [extractedColumns, setExtractedColumns] = useState<ExtractedColumn[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState<'mapping' | 'preview'>('mapping');

  // Process CSV data to extract columns and sample values
  useEffect(() => {
    if (csvData && csvData.headers && csvData.rows) {
      const columns: ExtractedColumn[] = csvData.headers.map((header: string, index: number) => {
        // Get first 3 non-empty sample values for this column
        const sampleValues = csvData.rows
          .slice(0, 10) // Look at first 10 rows
          .map((row: any) => row[index]?.value || '')
          .filter((value: string) => value.trim() !== '')
          .slice(0, 3);

        return {
          index,
          name: header || `Column ${index + 1}`,
          sampleValues
        };
      });

      setExtractedColumns(columns);
      
      // Auto-suggest mappings based on column names
      const autoMapping: FieldMapping = {};
      columns.forEach(column => {
        const lowercaseName = column.name.toLowerCase();
        if (lowercaseName.includes('policy') && lowercaseName.includes('number')) {
          autoMapping[column.index] = 'policy_number';
        } else if (lowercaseName.includes('insured') || lowercaseName.includes('name')) {
          autoMapping[column.index] = 'insured_name';
        } else if (lowercaseName.includes('premium')) {
          autoMapping[column.index] = 'premium_amount';
        } else if (lowercaseName.includes('commission')) {
          autoMapping[column.index] = 'commission_amount';
        } else if (lowercaseName.includes('effective') || lowercaseName.includes('start')) {
          autoMapping[column.index] = 'effective_date';
        } else if (lowercaseName.includes('expir') || lowercaseName.includes('end')) {
          autoMapping[column.index] = 'expiration_date';
        }
      });
      setFieldMapping(autoMapping);
    }
  }, [csvData]);

  // Generate preview data based on current mapping
  useEffect(() => {
    if (csvData && csvData.rows && Object.keys(fieldMapping).length > 0) {
      const mappedData = csvData.rows.slice(0, 5).map((row: any) => {
        const mappedRow: any = {};
        Object.entries(fieldMapping).forEach(([columnIndex, salesforceField]) => {
          if (salesforceField !== 'skip') {
            const fieldLabel = SALESFORCE_FIELDS.find(f => f.value === salesforceField)?.label || salesforceField;
            mappedRow[fieldLabel] = row[parseInt(columnIndex)]?.value || '';
          }
        });
        return mappedRow;
      });
      setPreviewData(mappedData);
    }
  }, [fieldMapping, csvData]);

  const handleFieldMappingChange = (columnIndex: number, salesforceField: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [columnIndex]: salesforceField
    }));
  };

  const handleContinueToPreview = () => {
    setCurrentStep('preview');
  };

  const handleBackToMapping = () => {
    setCurrentStep('mapping');
  };

  const mappedFieldsCount = Object.values(fieldMapping).filter(field => field !== 'skip').length;
  const totalColumns = extractedColumns.length;

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
              <h2 className="text-2xl font-bold text-gray-900">
                {currentStep === 'mapping' ? 'Map Document Fields' : 'Preview Mapped Data'}
              </h2>
              {document && (
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>{document.originalName}</span>
                  <span>•</span>
                  <span className="capitalize">{document.documentType}</span>
                  <span>•</span>
                  <Badge className="bg-blue-100 text-blue-800 text-xs">
                    {mappedFieldsCount} of {totalColumns} fields mapped
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {documentLoading || csvLoading ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : csvError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Not Available</h3>
                <p className="text-gray-600">Could not load document data for field mapping.</p>
              </div>
            </div>
          ) : currentStep === 'mapping' ? (
            /* Field Mapping Step */
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-gray-200 bg-blue-50">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">1</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Map Your Document Fields</h3>
                    <p className="text-sm text-gray-600">
                      Review the extracted columns below and map them to the correct Salesforce fields. 
                      We've suggested mappings based on column names - feel free to adjust or skip any columns you don't need.
                    </p>
                  </div>
                </div>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-4">
                  {extractedColumns.map((column) => (
                    <Card key={column.index} className={`overflow-hidden transition-all ${
                      fieldMapping[column.index] && fieldMapping[column.index] !== 'skip' 
                        ? 'border-green-200 bg-green-50' 
                        : fieldMapping[column.index] === 'skip'
                        ? 'border-gray-200 bg-gray-50 opacity-60'
                        : 'border-blue-200 bg-blue-50'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-medium text-gray-900">
                                {column.name || `Column ${column.index + 1}`}
                              </h4>
                              {fieldMapping[column.index] && fieldMapping[column.index] !== 'skip' && (
                                <Badge className="bg-green-100 text-green-800 text-xs">Mapped</Badge>
                              )}
                              {fieldMapping[column.index] === 'skip' && (
                                <Badge className="bg-gray-100 text-gray-600 text-xs">Skipped</Badge>
                              )}
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-gray-500 mb-1">Sample data from your document:</p>
                              <div className="flex flex-wrap gap-1">
                                {column.sampleValues.length > 0 ? column.sampleValues.map((value, idx) => (
                                  <div key={idx} className="text-sm text-gray-700 bg-white border px-2 py-1 rounded max-w-xs truncate" title={value}>
                                    {value}
                                  </div>
                                )) : (
                                  <div className="text-sm text-gray-400 italic">No sample data available</div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                            <div className="min-w-[200px]">
                              <Select
                                value={fieldMapping[column.index] || ''}
                                onValueChange={(value) => handleFieldMappingChange(column.index, value)}
                              >
                                <SelectTrigger className={`w-full ${
                                  fieldMapping[column.index] && fieldMapping[column.index] !== 'skip'
                                    ? 'border-green-300 bg-white'
                                    : 'border-gray-300'
                                }`}>
                                  <SelectValue placeholder="Choose field..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">
                                    <span className="text-gray-500">Select a field...</span>
                                  </SelectItem>
                                  {SALESFORCE_FIELDS.map((field) => (
                                    <SelectItem key={field.value} value={field.value}>
                                      {field.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            /* Preview Step */
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-gray-200 bg-green-50">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-sm">2</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Review & Edit Your Data</h3>
                    <p className="text-sm text-gray-600">
                      Double-check the data below and feel free to adjust anything that looks incorrect. 
                      This preview shows the first 5 rows - the same structure will be applied to all {csvData?.rows?.length || 0} rows when uploaded to Salesforce.
                    </p>
                  </div>
                </div>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-6">
                  {previewData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(previewData[0]).map((fieldName) => (
                              <th key={fieldName} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                {fieldName}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {previewData.map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-gray-50">
                              {Object.values(row).map((value: any, colIndex) => (
                                <td key={colIndex} className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                                  {value}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data to Preview</h3>
                      <p className="text-gray-600">Please map at least one field to see the preview.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {currentStep === 'mapping' ? (
                <span>{mappedFieldsCount} of {totalColumns} fields mapped</span>
              ) : (
                <span>Preview showing first 5 rows of {csvData?.rows?.length || 0} total rows</span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              {currentStep === 'mapping' ? (
                <Button 
                  onClick={handleContinueToPreview}
                  disabled={mappedFieldsCount === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Data
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleBackToMapping}>
                    Back to Mapping
                  </Button>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload to Salesforce
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}