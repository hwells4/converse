import { useState, useEffect } from "react";
import { useDocument, useDocumentCSVData } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, FileText, AlertCircle, CheckCircle, ArrowRight, Upload, Eye, Plus, Trash2 } from "lucide-react";
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
  // Top priority fields
  { value: "name_of_insured", label: "Name of Insured" },
  { value: "policy_number", label: "Policy Number" },
  { value: "commission_amount", label: "Commission Amount" },
  { value: "transaction_type", label: "Transaction Type" },
  
  // Other commonly used fields
  { value: "policy_name", label: "Policy Name" },
  { value: "policy_effective_date", label: "Policy Effective Date" },
  { value: "policy_expiration_date", label: "Policy Expiration Date" },
  { value: "commission_rate", label: "Commission Rate" },
  { value: "policy_premium", label: "Policy Premium" },
  { value: "transaction_effective_date", label: "Transaction/Effective Date" },
  { value: "producer_1", label: "Producer 1" },
  { value: "transaction_amount", label: "Transaction Amount" },
  
  // Additional fields alphabetically
  { value: "admin_fee", label: "Admin Fee" },
  { value: "commission_transaction_name", label: "Commission Transaction Name" },
  { value: "commissionable_premium", label: "Commissionable Premium" },
  { value: "created_by_id", label: "Created By ID" },
  { value: "created_date", label: "Created Date" },
  { value: "crystal_cannon_5_percent", label: "Crystal Cannon 5%" },
  { value: "deleted", label: "Deleted" },
  { value: "difference_eff_trans_dates", label: "Difference Eff/Trans Dates" },
  { value: "house_payable", label: "House Payable" },
  { value: "house_payable_affiliate", label: "House Payable Affiliate" },
  { value: "last_activity_date", label: "Last Activity Date" },
  { value: "last_modified_by_id", label: "Last Modified By ID" },
  { value: "last_modified_date", label: "Last Modified Date" },
  { value: "last_referenced_date", label: "Last Referenced Date" },
  { value: "last_viewed_date", label: "Last Viewed Date" },
  { value: "migration_commission_statement_id", label: "Migration Commission Statement Id" },
  { value: "migration_id", label: "Migration Id" },
  { value: "migration_policy_id", label: "Migration Policy Id" },
  { value: "mvr_charge", label: "MVR Charge" },
  { value: "mvr_fee", label: "MVR Fee" },
  { value: "mvr_share_percent", label: "MVR Share %" },
  { value: "new_opportunity_term", label: "New Opportunity Term" },
  { value: "notes", label: "Notes" },
  { value: "old_policy_identifier", label: "Old Policy Identifier" },
  { value: "old_transaction_number", label: "Old Transaction Number" },
  { value: "policy", label: "Policy" },
  { value: "policy_number_from_import", label: "Policy Number from Import" },
  { value: "policy_period", label: "Policy Period" },
  { value: "policy_type", label: "Policy Type" },
  { value: "prior_opportunity_term", label: "Prior Opportunity Term" },
  { value: "producer_1_old", label: "Producer 1 Old" },
  { value: "producer_1_override", label: "Producer 1 Override" },
  { value: "producer_1_pay", label: "Producer 1 Pay" },
  { value: "producer_1_pay_percent", label: "Producer 1 Pay Percent" },
  { value: "producer_1_payable", label: "Producer 1 Payable" },
  { value: "producer_1_payable_type", label: "Producer 1 Payable Type" },
  { value: "producer_2", label: "Producer 2" },
  { value: "producer_2_old", label: "Producer 2 Old" },
  { value: "producer_2_override", label: "Producer 2 Override" },
  { value: "producer_2_pay_percent", label: "Producer 2 Pay Percent" },
  { value: "producer_2_pay_percent_old", label: "Producer 2 Pay Percent OLD" },
  { value: "producer_2_payable", label: "Producer 2 Payable" },
  { value: "producer_2_payable_old", label: "Producer 2 Payable OLD" },
  { value: "producer_3", label: "Producer 3" },
  { value: "producer_3_override", label: "Producer 3 Override" },
  { value: "producer_3_pay_percent", label: "Producer 3 Pay Percent" },
  { value: "producer_3_payable", label: "Producer 3 Payable" },
  { value: "producer_4", label: "Producer 4" },
  { value: "producer_4_override", label: "Producer 4 Override" },
  { value: "producer_4_pay_percent", label: "Producer 4 Pay Percent" },
  { value: "producer_4_payable", label: "Producer 4 Payable" },
  { value: "record_id", label: "Record ID" },
  { value: "statement_approval_date", label: "Statement Approval Date" },
  { value: "statement_date", label: "Statement Date" },
  { value: "system_modstamp", label: "System Modstamp" },
  { value: "transaction_created_year_month", label: "Transaction Created Year & Month" },
  { value: "unique_id", label: "Unique ID" },
  { value: "update_field", label: "Update Field" },
  { value: "skip", label: "Skip This Column" }
];

export function FieldMappingModal({ documentId, onClose }: FieldMappingModalProps) {
  const { data: document, isLoading: documentLoading } = useDocument(documentId);
  const { data: csvData, isLoading: csvLoading, error: csvError } = useDocumentCSVData(documentId);
  const [extractedColumns, setExtractedColumns] = useState<ExtractedColumn[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [editablePreviewData, setEditablePreviewData] = useState<any[]>([]);
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

  // Generate preview data based on current mapping (show ALL rows, not just 5)
  useEffect(() => {
    if (csvData && csvData.rows && Object.keys(fieldMapping).length > 0) {
      const mappedData = csvData.rows.map((row: any) => {
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
      setEditablePreviewData(mappedData); // Initialize editable data
    }
  }, [fieldMapping, csvData]);

  // Handle cell editing in preview
  const handleCellEdit = (rowIndex: number, fieldName: string, newValue: string) => {
    setEditablePreviewData(prev => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [fieldName]: newValue };
      return updated;
    });
  };

  // Handle adding a new row
  const handleAddRow = () => {
    const newRow: any = {};
    // Initialize with empty values for all mapped fields
    Object.values(fieldMapping).forEach((salesforceField) => {
      if (salesforceField !== 'skip') {
        const fieldLabel = SALESFORCE_FIELDS.find(f => f.value === salesforceField)?.label || salesforceField;
        newRow[fieldLabel] = '';
      }
    });
    
    setEditablePreviewData(prev => [...prev, newRow]);
  };

  // Handle removing a row
  const handleRemoveRow = (rowIndex: number) => {
    setEditablePreviewData(prev => prev.filter((_, index) => index !== rowIndex));
  };

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

  const handleUploadToSalesforce = () => {
    // TODO: Convert editablePreviewData to CSV format and upload
    console.log('Uploading edited data to Salesforce:', editablePreviewData);
    
    // This will eventually:
    // 1. Convert editablePreviewData to CSV format
    // 2. Send the CSV data to the backend for Salesforce upload
    // 3. Update document status to 'uploaded'
    
    onClose();
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
                              <SearchableSelect
                                options={SALESFORCE_FIELDS.filter(field => {
                                  // Allow fields that aren't already mapped by other columns
                                  const usedFields = Object.values(fieldMapping).filter(val => val && val !== 'skip');
                                  return field.value === 'skip' || !usedFields.includes(field.value) || fieldMapping[column.index] === field.value;
                                })}
                                value={fieldMapping[column.index] || ''}
                                onValueChange={(value) => handleFieldMappingChange(column.index, value)}
                                placeholder="Choose field..."
                                className={fieldMapping[column.index] && fieldMapping[column.index] !== 'skip'
                                  ? 'border-green-300 bg-white'
                                  : 'border-gray-300'}
                              />
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
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        Review and edit your data below. All {editablePreviewData.length} rows will be uploaded to Salesforce.
                      </p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>• Click any cell to edit • Add missing rows • Remove unnecessary data • All changes auto-save</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-6">
                  {editablePreviewData.length > 0 ? (
                    <div className="space-y-4">
                      {/* Summary Stats */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-blue-900">Data Summary</h4>
                            <p className="text-sm text-blue-700">
                              {editablePreviewData.length} rows • {Object.keys(editablePreviewData[0]).length} mapped fields
                            </p>
                          </div>
                          <div className="text-sm text-blue-600">
                            Scroll down to see all data
                          </div>
                        </div>
                      </div>

                      {/* Editable Table */}
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-12">
                                Row
                              </th>
                              {Object.keys(editablePreviewData[0]).map((fieldName) => (
                                <th key={fieldName} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 min-w-[150px]">
                                  {fieldName}
                                </th>
                              ))}
                              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 w-8">
                                
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {editablePreviewData.map((row, rowIndex) => (
                              <tr key={rowIndex} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-xs text-gray-500 border-r border-gray-200 bg-gray-50">
                                  {rowIndex + 1}
                                </td>
                                {Object.entries(row).map(([fieldName, value]: [string, any]) => (
                                  <td key={fieldName} className="px-1 py-1 border-r border-gray-100">
                                    <input
                                      type="text"
                                      value={value || ''}
                                      onChange={(e) => handleCellEdit(rowIndex, fieldName, e.target.value)}
                                      className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 rounded"
                                      placeholder="Enter value..."
                                    />
                                  </td>
                                ))}
                                <td className="px-1 py-1 text-center border-r-0">
                                  <Button
                                    onClick={() => handleRemoveRow(rowIndex)}
                                    size="sm"
                                    variant="ghost"
                                    className="h-4 w-4 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                    title="Delete this row"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Add Row Button */}
                      <div className="flex justify-center pt-2">
                        <Button
                          onClick={handleAddRow}
                          variant="outline"
                          size="sm"
                          className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Row
                        </Button>
                      </div>
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
                <span>Showing all {editablePreviewData.length} rows • Click any cell to edit</span>
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
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleUploadToSalesforce}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Send to Salesforce
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