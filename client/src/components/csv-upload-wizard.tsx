import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X, FileText, ArrowRight, ArrowLeft, Check, Table, Edit3, Upload, Eye, Plus, Trash2 } from "lucide-react";

interface CSVUploadWizardProps {
  isOpen: boolean;
  onClose: () => void;
  parsedData: {
    headers: string[];
    rows: string[][];
    detectedHeaderRow: number;
  };
  fileName: string;
  carrierId: number;
  onComplete: (finalData: any) => void;
}

interface FieldMapping {
  [headerIndex: number]: string; // Maps to Salesforce field name
}

// Salesforce fields for commission statements
const SALESFORCE_FIELDS = [
  { value: "policy_number", label: "Policy Number" },
  { value: "insured_name", label: "Insured Name" },
  { value: "agent_name", label: "Agent Name" },
  { value: "commission_amount", label: "Commission Amount" },
  { value: "premium_amount", label: "Premium Amount" },
  { value: "effective_date", label: "Effective Date" },
  { value: "expiration_date", label: "Expiration Date" },
  { value: "line_of_business", label: "Line of Business" },
  { value: "carrier_name", label: "Carrier Name" },
  { value: "producer_code", label: "Producer Code" },
  { value: "commission_rate", label: "Commission Rate" },
  { value: "transaction_type", label: "Transaction Type" },
  { value: "payment_date", label: "Payment Date" },
  { value: "agency_name", label: "Agency Name" },
  { value: "customer_id", label: "Customer ID" },
  { value: "skip", label: "Skip This Column" }
];

export function CSVUploadWizard({ 
  isOpen, 
  onClose, 
  parsedData, 
  fileName, 
  carrierId,
  onComplete 
}: CSVUploadWizardProps) {
  const [currentStep, setCurrentStep] = useState<'preview' | 'mapping' | 'edit'>(parsedData ? 'preview' : 'preview');
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(parsedData?.detectedHeaderRow || 0);
  const [headers, setHeaders] = useState<string[]>(parsedData?.headers || []);
  const [dataRows, setDataRows] = useState<string[][]>(parsedData?.rows || []);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [editableData, setEditableData] = useState<any[]>([]);

  // Initialize data when parsedData changes
  useEffect(() => {
    if (parsedData) {
      setHeaders(parsedData.headers);
      setDataRows(parsedData.rows);
      setSelectedHeaderRow(parsedData.detectedHeaderRow);
    }
  }, [parsedData]);

  // Auto-suggest mappings based on header names
  const getSuggestedMapping = (header: string): string | null => {
    const lowerHeader = header.toLowerCase().trim();
    
    if (lowerHeader.includes('policy') && lowerHeader.includes('number')) return 'policy_number';
    if (lowerHeader.includes('insured') && lowerHeader.includes('name')) return 'insured_name';
    if (lowerHeader.includes('agent') && lowerHeader.includes('name')) return 'agent_name';
    if (lowerHeader.includes('commission') && lowerHeader.includes('amount')) return 'commission_amount';
    if (lowerHeader.includes('premium') && lowerHeader.includes('amount')) return 'premium_amount';
    if (lowerHeader.includes('effective') && lowerHeader.includes('date')) return 'effective_date';
    if (lowerHeader.includes('expiration') && lowerHeader.includes('date')) return 'expiration_date';
    if (lowerHeader.includes('line') && lowerHeader.includes('business')) return 'line_of_business';
    if (lowerHeader.includes('carrier') && lowerHeader.includes('name')) return 'carrier_name';
    if (lowerHeader.includes('producer') && lowerHeader.includes('code')) return 'producer_code';
    if (lowerHeader.includes('commission') && lowerHeader.includes('rate')) return 'commission_rate';
    if (lowerHeader.includes('transaction') && lowerHeader.includes('type')) return 'transaction_type';
    if (lowerHeader.includes('payment') && lowerHeader.includes('date')) return 'payment_date';
    if (lowerHeader.includes('agency') && lowerHeader.includes('name')) return 'agency_name';
    if (lowerHeader.includes('customer') && lowerHeader.includes('id')) return 'customer_id';
    
    return null;
  };

  // Initialize auto-mapping when moving to mapping step
  useEffect(() => {
    if (currentStep === 'mapping' && headers.length > 0 && Object.keys(fieldMapping).length === 0) {
      const autoMapping: FieldMapping = {};
      headers.forEach((header, index) => {
        const suggestion = getSuggestedMapping(header);
        if (suggestion) {
          autoMapping[index] = suggestion;
        }
      });
      setFieldMapping(autoMapping);
    }
  }, [currentStep, headers]);

  // Generate editable data when moving to edit step
  useEffect(() => {
    if (currentStep === 'edit' && Object.keys(fieldMapping).length > 0) {
      const mappedData = dataRows.slice(selectedHeaderRow + 1).map((row, rowIndex) => {
        const mappedRow: any = { _originalIndex: rowIndex };
        Object.entries(fieldMapping).forEach(([columnIndex, salesforceField]) => {
          if (salesforceField !== 'skip') {
            const fieldLabel = SALESFORCE_FIELDS.find(f => f.value === salesforceField)?.label || salesforceField;
            mappedRow[fieldLabel] = row[parseInt(columnIndex)] || '';
          }
        });
        return mappedRow;
      });
      setEditableData(mappedData);
    }
  }, [currentStep, fieldMapping, dataRows, selectedHeaderRow]);

  const handleHeaderRowChange = (newHeaderRow: number) => {
    setSelectedHeaderRow(newHeaderRow);
    if (dataRows[newHeaderRow]) {
      setHeaders(dataRows[newHeaderRow]);
    }
  };

  const handleMappingChange = (headerIndex: number, salesforceField: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [headerIndex]: salesforceField
    }));
  };

  const handleCellEdit = (rowIndex: number, fieldName: string, newValue: string) => {
    setEditableData(prev => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [fieldName]: newValue };
      return updated;
    });
  };

  const addNewRow = () => {
    const newRow: any = { _originalIndex: -1 };
    Object.values(fieldMapping).forEach(salesforceField => {
      if (salesforceField !== 'skip') {
        const fieldLabel = SALESFORCE_FIELDS.find(f => f.value === salesforceField)?.label || salesforceField;
        newRow[fieldLabel] = '';
      }
    });
    setEditableData(prev => [...prev, newRow]);
  };

  const deleteRow = (rowIndex: number) => {
    setEditableData(prev => prev.filter((_, index) => index !== rowIndex));
  };

  const handleNext = () => {
    if (currentStep === 'preview') {
      setCurrentStep('mapping');
    } else if (currentStep === 'mapping') {
      setCurrentStep('edit');
    }
  };

  const handleBack = () => {
    if (currentStep === 'mapping') {
      setCurrentStep('preview');
    } else if (currentStep === 'edit') {
      setCurrentStep('mapping');
    }
  };

  const handleComplete = () => {
    onComplete({
      mapping: fieldMapping,
      data: editableData,
      fileName,
      carrierId
    });
  };

  const getMappedFieldsCount = () => {
    return Object.values(fieldMapping).filter(field => field !== 'skip').length;
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'preview': return 'Preview & Header Selection';
      case 'mapping': return 'Column Mapping';
      case 'edit': return 'Data Review & Edit';
      default: return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden p-0">
        {/* Full-screen header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{getStepTitle()}</h1>
                <p className="text-gray-600 text-sm">{fileName}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center space-x-4 mt-6">
            <div className={`flex items-center space-x-2 ${currentStep === 'preview' ? 'text-blue-600' : (currentStep === 'mapping' || currentStep === 'edit') ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === 'preview' ? 'bg-blue-100 border-2 border-blue-600' : 
                (currentStep === 'mapping' || currentStep === 'edit') ? 'bg-green-100 border-2 border-green-600' : 
                'bg-gray-100 border-2 border-gray-300'
              }`}>
                {(currentStep === 'mapping' || currentStep === 'edit') ? <Check className="h-4 w-4" /> : <span className="text-sm font-medium">1</span>}
              </div>
              <span className="font-medium">Preview</span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400" />
            <div className={`flex items-center space-x-2 ${currentStep === 'mapping' ? 'text-blue-600' : currentStep === 'edit' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === 'mapping' ? 'bg-blue-100 border-2 border-blue-600' : 
                currentStep === 'edit' ? 'bg-green-100 border-2 border-green-600' : 
                'bg-gray-100 border-2 border-gray-300'
              }`}>
                {currentStep === 'edit' ? <Check className="h-4 w-4" /> : <span className="text-sm font-medium">2</span>}
              </div>
              <span className="font-medium">Mapping</span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400" />
            <div className={`flex items-center space-x-2 ${currentStep === 'edit' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === 'edit' ? 'bg-blue-100 border-2 border-blue-600' : 'bg-gray-100 border-2 border-gray-300'
              }`}>
                <span className="text-sm font-medium">3</span>
              </div>
              <span className="font-medium">Edit & Review</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-hidden">
          {currentStep === 'preview' && (
            <div className="p-8 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Eye className="h-5 w-5" />
                    <span>Data Preview</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <label className="text-sm font-medium">Header Row:</label>
                      <Select value={selectedHeaderRow.toString()} onValueChange={(value) => handleHeaderRowChange(parseInt(value))}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dataRows.slice(0, 5).map((row, index) => (
                            <SelectItem key={index} value={index.toString()}>
                              Row {index + 1}: {row.slice(0, 3).join(', ')}...
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <ScrollArea className="h-96">
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              {headers.map((header, index) => (
                                <th key={index} className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-r">
                                  {header || `Column ${index + 1}`}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dataRows.slice(selectedHeaderRow + 1, selectedHeaderRow + 11).map((row, rowIndex) => (
                              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                {row.map((cell, cellIndex) => (
                                  <td key={cellIndex} className="px-4 py-3 text-sm text-gray-900 border-r">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollArea>
                    </div>
                    <p className="text-sm text-gray-600">
                      Showing first 10 data rows. Total rows: {dataRows.length - selectedHeaderRow - 1}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 'mapping' && (
            <div className="p-8 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <Table className="h-5 w-5" />
                      <span>Column Mapping</span>
                    </span>
                    <Badge variant="outline">
                      {getMappedFieldsCount()} of {headers.length} mapped
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="font-medium text-gray-900">Spreadsheet Columns</h3>
                      <ScrollArea className="h-96">
                        <div className="space-y-4">
                          {headers.map((header, index) => (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">
                                  {header || `Column ${index + 1}`}
                                </span>
                                {fieldMapping[index] && fieldMapping[index] !== 'skip' && (
                                  <Check className="h-4 w-4 text-green-600" />
                                )}
                              </div>
                              
                              <Select 
                                value={fieldMapping[index] || ""} 
                                onValueChange={(value) => handleMappingChange(index, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select field..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">No mapping</SelectItem>
                                  {SALESFORCE_FIELDS.map((field) => (
                                    <SelectItem key={field.value} value={field.value}>
                                      {field.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                Sample: {dataRows[selectedHeaderRow + 1]?.[index] || 'No data'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-medium text-gray-900">Field Mapping Preview</h3>
                      <ScrollArea className="h-96">
                        <div className="space-y-3">
                          {Object.entries(fieldMapping).filter(([_, field]) => field !== 'skip' && field !== '').map(([headerIndex, salesforceField]) => {
                            const header = headers[parseInt(headerIndex)];
                            const fieldLabel = SALESFORCE_FIELDS.find(f => f.value === salesforceField)?.label;
                            
                            return (
                              <div key={headerIndex} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center space-x-2 text-sm">
                                  <span className="font-medium text-gray-900">{header}</span>
                                  <ArrowRight className="h-3 w-3 text-gray-400" />
                                  <span className="text-blue-700">{fieldLabel}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Sample: {dataRows[selectedHeaderRow + 1]?.[parseInt(headerIndex)] || 'No data'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 'edit' && (
            <div className="p-8 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <Edit3 className="h-5 w-5" />
                      <span>Data Review & Edit</span>
                    </span>
                    <Button onClick={addNewRow} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Row
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <ScrollArea className="h-96">
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 w-16">Actions</th>
                            {Object.values(fieldMapping).filter(field => field !== 'skip').map((field, index) => {
                              const fieldLabel = SALESFORCE_FIELDS.find(f => f.value === field)?.label || field;
                              return (
                                <th key={index} className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-r min-w-32">
                                  {fieldLabel}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {editableData.map((row, rowIndex) => (
                            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-2">
                                <Button 
                                  onClick={() => deleteRow(rowIndex)} 
                                  size="sm" 
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </td>
                              {Object.values(fieldMapping).filter(field => field !== 'skip').map((field, cellIndex) => {
                                const fieldLabel = SALESFORCE_FIELDS.find(f => f.value === field)?.label || field;
                                return (
                                  <td key={cellIndex} className="px-4 py-2 border-r">
                                    <Input
                                      value={row[fieldLabel] || ''}
                                      onChange={(e) => handleCellEdit(rowIndex, fieldLabel, e.target.value)}
                                      className="border-0 bg-transparent p-1 text-sm"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                  <p className="text-sm text-gray-600 mt-4">
                    {editableData.length} rows ready for upload
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {currentStep === 'preview' && `${dataRows.length} rows detected`}
              {currentStep === 'mapping' && `${getMappedFieldsCount()} fields mapped`}
              {currentStep === 'edit' && `${editableData.length} rows ready`}
            </div>
            
            <div className="flex space-x-3">
              {currentStep !== 'preview' && (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              
              {currentStep !== 'edit' ? (
                <Button 
                  onClick={handleNext}
                  disabled={currentStep === 'mapping' && getMappedFieldsCount() === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button 
                  onClick={handleComplete}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload to Salesforce
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}