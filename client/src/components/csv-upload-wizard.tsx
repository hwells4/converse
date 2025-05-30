import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  
  // Cache key for localStorage
  const cacheKey = `csv-wizard-${fileName}-${carrierId}`;
  const cacheTimestampKey = `${cacheKey}-timestamp`;

  // Initialize data when parsedData changes
  useEffect(() => {
    if (parsedData) {
      setHeaders(parsedData.headers);
      setDataRows(parsedData.rows);
      setSelectedHeaderRow(parsedData.detectedHeaderRow);
    }
  }, [parsedData]);

  // Load cached data on component mount
  useEffect(() => {
    const loadCachedData = () => {
      try {
        const cachedTimestamp = localStorage.getItem(cacheTimestampKey);
        if (cachedTimestamp) {
          const cacheAge = Date.now() - parseInt(cachedTimestamp);
          const fiveMinutes = 5 * 60 * 1000;
          
          if (cacheAge < fiveMinutes) {
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
              const parsed = JSON.parse(cachedData);
              if (parsed.editableData && parsed.fieldMapping) {
                setEditableData(parsed.editableData);
                setFieldMapping(parsed.fieldMapping);
                if (parsed.currentStep) {
                  setCurrentStep(parsed.currentStep);
                }
              }
            }
          } else {
            // Cache expired, clear it
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimestampKey);
          }
        }
      } catch (error) {
        console.error('Error loading cached data:', error);
      }
    };

    if (fileName && carrierId) {
      loadCachedData();
    }
  }, [fileName, carrierId, cacheKey, cacheTimestampKey]);

  // Save data to cache whenever it changes
  useEffect(() => {
    if (editableData.length > 0 || Object.keys(fieldMapping).length > 0) {
      try {
        const dataToCache = {
          editableData,
          fieldMapping,
          currentStep,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
        localStorage.setItem(cacheTimestampKey, Date.now().toString());
      } catch (error) {
        console.error('Error saving to cache:', error);
      }
    }
  }, [editableData, fieldMapping, currentStep, cacheKey, cacheTimestampKey]);

  // Clear cache on component unmount or completion
  const clearCache = () => {
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(cacheTimestampKey);
  };

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
    if (newHeaderRow === -1) {
      // Headers are already correct, keep the current headers
      setHeaders(parsedData?.headers || headers);
    } else if (dataRows[newHeaderRow]) {
      setHeaders(dataRows[newHeaderRow]);
    }
  };

  const handleMappingChange = (headerIndex: number, salesforceField: string) => {
    setFieldMapping(prev => {
      const updated = { ...prev };
      if (salesforceField === 'none') {
        delete updated[headerIndex];
      } else {
        updated[headerIndex] = salesforceField;
      }
      return updated;
    });
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
    clearCache(); // Clear cache on successful completion
    onComplete({
      mapping: fieldMapping,
      data: editableData,
      fileName,
      carrierId
    });
  };

  // Handle modal close with cache cleanup option
  const handleClose = () => {
    // Only clear cache if user hasn't made significant progress
    if (currentStep === 'preview' || Object.keys(fieldMapping).length === 0) {
      clearCache();
    }
    onClose();
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl h-[90vh] overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>CSV Upload Wizard</DialogDescription>
        </DialogHeader>
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
            <div className="flex items-center space-x-3">
              {(currentStep === 'mapping' || currentStep === 'edit') && Object.keys(fieldMapping).length > 0 && (
                <div className="flex items-center space-x-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                  <Check className="h-3 w-3" />
                  <span>Progress saved</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress Steps - Clickable */}
          <div className="flex items-center space-x-4 mt-6">
            <button 
              onClick={() => setCurrentStep('preview')}
              className={`flex items-center space-x-2 transition-colors hover:opacity-80 ${
                currentStep === 'preview' ? 'text-blue-600' : 
                (currentStep === 'mapping' || currentStep === 'edit') ? 'text-green-600' : 
                'text-gray-400'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                currentStep === 'preview' ? 'bg-blue-100 border-2 border-blue-600' : 
                (currentStep === 'mapping' || currentStep === 'edit') ? 'bg-green-100 border-2 border-green-600' : 
                'bg-gray-100 border-2 border-gray-300'
              }`}>
                {(currentStep === 'mapping' || currentStep === 'edit') ? <Check className="h-4 w-4" /> : <span className="text-sm font-medium">1</span>}
              </div>
              <span className="font-medium">Preview</span>
            </button>
            <ArrowRight className="h-4 w-4 text-gray-400" />
            <button 
              onClick={() => setCurrentStep('mapping')}
              className={`flex items-center space-x-2 transition-colors hover:opacity-80 ${
                currentStep === 'mapping' ? 'text-blue-600' : 
                currentStep === 'edit' ? 'text-green-600' : 
                'text-gray-400'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                currentStep === 'mapping' ? 'bg-blue-100 border-2 border-blue-600' : 
                currentStep === 'edit' ? 'bg-green-100 border-2 border-green-600' : 
                'bg-gray-100 border-2 border-gray-300'
              }`}>
                {currentStep === 'edit' ? <Check className="h-4 w-4" /> : <span className="text-sm font-medium">2</span>}
              </div>
              <span className="font-medium">Mapping</span>
            </button>
            <ArrowRight className="h-4 w-4 text-gray-400" />
            <button 
              onClick={() => currentStep !== 'preview' && setCurrentStep('edit')}
              disabled={currentStep === 'preview'}
              className={`flex items-center space-x-2 transition-colors ${
                currentStep === 'preview' ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80'
              } ${currentStep === 'edit' ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                currentStep === 'edit' ? 'bg-blue-100 border-2 border-blue-600' : 'bg-gray-100 border-2 border-gray-300'
              }`}>
                <span className="text-sm font-medium">3</span>
              </div>
              <span className="font-medium">Edit & Review</span>
            </button>
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {currentStep === 'preview' && (
            <div className="p-4 flex-1 flex flex-col space-y-4">
              {/* Clear Explanation */}
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <h3 className="font-semibold text-blue-900 mb-2">What are we doing here?</h3>
                <p className="text-blue-800 text-sm leading-relaxed mb-3">
                  We need to check your data and make sure we can read it correctly. Look at the table below to see if it looks right. 
                  If the column names (like "Policy Number" or "Customer Name") are not in the first row, you can pick which row has the correct column names.
                </p>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-blue-900">Which row has your column names?</span>
                    <Select value={selectedHeaderRow.toString()} onValueChange={(value) => handleHeaderRowChange(parseInt(value))}>
                      <SelectTrigger className="w-48 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="-1">Headers are already correct</SelectItem>
                        {dataRows.slice(0, 5).map((row, index) => (
                          <SelectItem key={index} value={index.toString()}>
                            Row {index + 1}: {row.slice(0, 2).map(cell => cell.length > 15 ? cell.substring(0, 15) + '...' : cell).join(', ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    size="sm"
                    variant="outline" 
                    onClick={() => setCurrentStep('mapping')}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    This looks good, continue →
                  </Button>
                </div>
              </div>

              {/* Data Preview - Expanded */}
              <div className="flex-1 border rounded-lg overflow-hidden bg-white">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 flex items-center">
                      <Eye className="h-4 w-4 mr-2" />
                      Your Data Preview
                    </h3>
                    <span className="text-sm text-gray-600">
                      Showing 20 of {dataRows.length - selectedHeaderRow - 1} total rows
                    </span>
                  </div>
                </div>
                <ScrollArea className="flex-1" style={{ height: 'calc(100vh - 400px)' }}>
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className={selectedHeaderRow === -1 ? 'bg-blue-100 border-2 border-blue-400' : ''}>
                        {headers.map((header, index) => (
                          <th key={index} className={`px-4 py-3 text-left text-sm font-medium border-r ${
                            selectedHeaderRow === -1 ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            {header || `Column ${index + 1}`}
                            {selectedHeaderRow === -1 && (
                              <span className="ml-2 text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">HEADER</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Show the selected header row if it's not -1 */}
                      {selectedHeaderRow >= 0 && (
                        <tr className="bg-blue-100 border-2 border-blue-400">
                          {dataRows[selectedHeaderRow]?.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-3 text-sm text-blue-900 border-r font-medium">
                              <div className="max-w-[150px] truncate flex items-center" title={cell}>
                                {cell}
                                <span className="ml-2 text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">HEADER</span>
                              </div>
                            </td>
                          ))}
                        </tr>
                      )}
                      {/* Show data rows starting after the selected header row */}
                      {dataRows.slice(selectedHeaderRow + 1, selectedHeaderRow + 21).map((row, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-3 text-sm text-gray-900 border-r">
                              <div className="max-w-[150px] truncate" title={cell}>
                                {cell}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </div>
          )}

          {currentStep === 'mapping' && (
            <div className="p-4 flex-1 flex flex-col space-y-3">
              {/* Quick mapping suggestions - compressed */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-800">Smart Auto-Mapping Applied</span>
                    <Badge variant="outline" className="bg-white text-green-700 border-green-300">
                      {getMappedFieldsCount()} of {headers.length} mapped
                    </Badge>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      const autoMapping: FieldMapping = {};
                      headers.forEach((header, index) => {
                        const suggestion = getSuggestedMapping(header);
                        if (suggestion) {
                          autoMapping[index] = suggestion;
                        }
                      });
                      setFieldMapping(autoMapping);
                    }}
                    className="text-green-700 border-green-300 hover:bg-green-100"
                  >
                    Re-run Auto Mapping
                  </Button>
                </div>
              </div>

              {/* Main mapping interface */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Table className="h-5 w-5" />
                    <span>Column Mapping</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Table-style mapping view */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-6 py-3 border-b">
                        <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-700">
                          <div>Your Column</div>
                          <div>Sample Data</div>
                          <div>Maps To</div>
                          <div>Status</div>
                        </div>
                      </div>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-0">
                          {headers.map((header, index) => (
                            <div key={index} className="px-6 py-4 border-b border-gray-100 hover:bg-gray-50">
                              <div className="grid grid-cols-4 gap-4 items-center">
                                {/* Column name */}
                                <div className="font-medium text-gray-900">
                                  {header || `Column ${index + 1}`}
                                </div>
                                
                                {/* Sample data */}
                                <div className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded text-center">
                                  {dataRows[selectedHeaderRow + 1]?.[index] || 'No data'}
                                </div>
                                
                                {/* Mapping dropdown */}
                                <div>
                                  <Select 
                                    value={fieldMapping[index] || "none"} 
                                    onValueChange={(value) => handleMappingChange(index, value)}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select field..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">
                                        <span className="text-gray-500">Skip this column</span>
                                      </SelectItem>
                                      {SALESFORCE_FIELDS.map((field) => (
                                        <SelectItem key={field.value} value={field.value}>
                                          {field.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {/* Status indicator */}
                                <div className="flex items-center">
                                  {fieldMapping[index] && fieldMapping[index] !== 'none' ? (
                                    <div className="flex items-center space-x-2 text-green-600">
                                      <Check className="h-4 w-4" />
                                      <span className="text-sm">Mapped</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-2 text-gray-400">
                                      <span className="w-4 h-4 border-2 border-gray-300 rounded-full"></span>
                                      <span className="text-sm">Unmapped</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>


                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 'edit' && (
            <div className="p-4 flex-1 flex flex-col space-y-3">
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
                    <ScrollArea className="h-[300px]">
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
              
              <Button variant="outline" onClick={handleClose}>
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