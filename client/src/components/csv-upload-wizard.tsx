import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X, FileText, ArrowRight, ArrowLeft, Check, Table, Edit3, Upload, Eye, Plus, Trash2 } from "lucide-react";
import { CommissionStatementConfirmation } from "./commission-statement-confirmation";
import { CommissionStatement, N8NWebhookPayload } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  documentId?: number;
  onComplete: (finalData: any) => void;
}

interface FieldMapping {
  [headerIndex: number]: string; // Maps to Salesforce field name
}

// Salesforce fields for commission statements - ordered by priority
const SALESFORCE_FIELDS = [
  // Top priority fields
  { value: "name_of_insured", label: "Name of Insured" },
  { value: "policy_number", label: "Policy Number", required: true },
  { value: "commission_amount", label: "Commission Amount", required: true },
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

// Required fields that must be mapped
const REQUIRED_FIELDS = ["policy_number", "commission_amount"];

export function CSVUploadWizard({ 
  isOpen, 
  onClose, 
  parsedData, 
  fileName, 
  carrierId,
  documentId,
  onComplete 
}: CSVUploadWizardProps) {
  const { toast } = useToast();

  // Format commission amounts with commas and two decimal places
  const formatCommissionAmount = (value: string): string => {
    if (!value || value === '') return '';
    
    // Clean the value - remove $ signs, commas, etc.
    const cleanValue = String(value)
      .replace(/[$,\s]/g, '')
      .replace(/[()]/g, '-'); // Handle negative values in parentheses
    
    const amount = parseFloat(cleanValue);
    if (isNaN(amount)) return value; // Return original if not a number
    
    // Format with commas and two decimal places
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  const [currentStep, setCurrentStep] = useState<'preview' | 'mapping' | 'edit' | 'confirmation'>(parsedData ? 'preview' : 'preview');
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(-1); // Default to "headers are correct"
  const [headers, setHeaders] = useState<string[]>(parsedData?.headers || []);
  const [dataRows, setDataRows] = useState<string[][]>(parsedData?.rows || []);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [editableData, setEditableData] = useState<any[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Cache key for localStorage
  const cacheKey = `csv-wizard-${fileName}-${carrierId}`;
  const cacheTimestampKey = `${cacheKey}-timestamp`;

  // Initialize data when parsedData changes
  useEffect(() => {
    if (parsedData) {
      setHeaders(parsedData.headers);
      setDataRows(parsedData.rows);
      // Always default to "headers are correct" (-1) regardless of detected header row
      setSelectedHeaderRow(-1);
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

  // Initialize auto-mapping when moving to mapping step (excluding commission amount)
  useEffect(() => {
    if (currentStep === 'mapping' && headers.length > 0 && Object.keys(fieldMapping).length === 0) {
      const autoMapping: FieldMapping = {};
      headers.forEach((header, index) => {
        const suggestion = getSuggestedMapping(header);
        // Don't auto-select commission amount to prevent accidental selection
        if (suggestion && suggestion !== 'commission_amount') {
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
    // Show the confirmation modal instead of directly completing
    setShowConfirmation(true);
  };

  const handleConfirmationSubmit = async (statement: CommissionStatement) => {
    try {
      // First, upload the processed CSV data to S3
      const csvUploadResponse = await apiRequest("POST", "/api/s3/upload-processed-csv", {
        csvData: editableData,
        fileName,
        carrierId,
        documentId: documentId || 0
      });

      const csvUploadResult = await csvUploadResponse.json();
      
      if (!csvUploadResult.success) {
        throw new Error(csvUploadResult.message || "Failed to upload CSV to S3");
      }

      // Extract mapped field headers for N8N reference
      const mappedHeaders = Object.entries(fieldMapping)
        .filter(([_, salesforceField]) => salesforceField !== 'skip')
        .map(([headerIndex, salesforceField]) => {
          const fieldLabel = SALESFORCE_FIELDS.find(f => f.value === salesforceField)?.label;
          return fieldLabel || salesforceField;
        });

      // Prepare the N8N webhook payload with S3 reference
      const payload: N8NWebhookPayload = {
        statement,
        transactions: {
          csvS3Key: csvUploadResult.csvS3Key,
          csvUrl: csvUploadResult.csvUrl,
          headers: mappedHeaders
        },
        transactionCount: editableData.length,
        documentId: documentId || 0,
        fileName
      };

      // Send to N8N webhook
      const n8nResponse = await apiRequest("POST", "/api/n8n/salesforce-upload", payload);
      const n8nResult = await n8nResponse.json();
      
      console.log("N8N webhook response:", n8nResult);

      toast({
        title: "Upload Successful", 
        description: `Commission statement and ${editableData.length} transactions sent to Salesforce. CSV uploaded to S3: ${csvUploadResult.csvS3Key}`,
      });

      clearCache(); // Clear cache on successful completion
      setShowConfirmation(false);
      onComplete({
        mapping: fieldMapping,
        data: editableData,
        fileName,
        carrierId,
        statement
      });
    } catch (error) {
      console.error("Failed to upload to Salesforce:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to send data to Salesforce. Please try again.",
        variant: "destructive",
      });
    }
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

  const getRequiredFieldsStatus = () => {
    const mappedFields = Object.values(fieldMapping);
    const missingRequired = REQUIRED_FIELDS.filter(required => !mappedFields.includes(required));
    return {
      allRequiredMapped: missingRequired.length === 0,
      missingFields: missingRequired
    };
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
                        {dataRows.slice(0, 20).map((row, index) => (
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
                <div className="overflow-auto" style={{ height: 'calc(100vh - 400px)' }}>
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
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Quick mapping suggestions - compressed */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mx-4 mt-4 mb-3 flex-shrink-0">
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

              {/* Main mapping interface - fills remaining space */}
              <div className="flex-1 mx-4 mb-4 border rounded-lg overflow-hidden bg-white flex flex-col">
                <div className="bg-gray-50 px-6 py-3 border-b flex items-center space-x-2 flex-shrink-0">
                  <Table className="h-5 w-5" />
                  <span className="font-semibold text-gray-900">Column Mapping</span>
                </div>
                <div className="bg-gray-50 px-6 py-3 border-b flex-shrink-0">
                  <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-700">
                    <div>Your Column</div>
                    <div>Sample Data</div>
                    <div>Maps To</div>
                    <div>Status</div>
                  </div>
                </div>
                <ScrollArea className="flex-1 min-h-0">
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
                            <SearchableSelect
                              options={[
                                { value: "none", label: "Skip this column" },
                                ...SALESFORCE_FIELDS.filter(field => {
                                  // Allow "skip" and fields that aren't already mapped by other columns
                                  const usedFields = Object.values(fieldMapping).filter(val => val && val !== 'none');
                                  return field.value === 'skip' || !usedFields.includes(field.value) || fieldMapping[index] === field.value;
                                })
                              ]}
                              value={fieldMapping[index] || "none"}
                              onValueChange={(value) => handleMappingChange(index, value)}
                              placeholder="Select field..."
                            />
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
                </div>
              </div>
            </div>
          )}

          {currentStep === 'edit' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header with add row button */}
              <div className="bg-gray-50 px-6 py-3 border-b flex items-center justify-between mx-4 mt-4 rounded-t-lg flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <Edit3 className="h-5 w-5" />
                  <span className="font-semibold text-gray-900">Data Review & Edit</span>
                  <span className="text-sm text-gray-600">({editableData.length} rows)</span>
                </div>
                <Button onClick={addNewRow} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Row
                </Button>
              </div>

              {/* Main editing interface - fills remaining space */}
              <div className="flex-1 mx-4 mb-4 border border-t-0 rounded-b-lg overflow-hidden bg-white">
                <ScrollArea className="h-full">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 w-16 border-r">Actions</th>
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
                          <td className="px-4 py-2 border-r">
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
                            const isCommissionAmount = field === 'commission_amount';
                            const displayValue = isCommissionAmount ? formatCommissionAmount(row[fieldLabel] || '') : (row[fieldLabel] || '');
                            
                            return (
                              <td key={cellIndex} className="px-4 py-2 border-r">
                                <Input
                                  value={displayValue}
                                  onChange={(e) => handleCellEdit(rowIndex, fieldLabel, e.target.value)}
                                  className={`border-0 bg-transparent p-1 text-sm focus:bg-white focus:border ${
                                    isCommissionAmount ? 'text-right font-mono' : ''
                                  }`}
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="text-sm">
              {currentStep === 'preview' && (
                <span className="text-gray-600">{dataRows.length} rows detected</span>
              )}
              {currentStep === 'mapping' && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">{getMappedFieldsCount()} fields mapped</span>
                  {!getRequiredFieldsStatus().allRequiredMapped && (
                    <span className="text-red-600 text-xs bg-red-50 px-2 py-1 rounded">
                      Missing required: {getRequiredFieldsStatus().missingFields.map(field => 
                        SALESFORCE_FIELDS.find(f => f.value === field)?.label
                      ).join(', ')}
                    </span>
                  )}
                </div>
              )}
              {currentStep === 'edit' && (
                <span className="text-gray-600">{editableData.length} rows ready</span>
              )}
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
                  disabled={currentStep === 'mapping' && !getRequiredFieldsStatus().allRequiredMapped}
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
                  Review & Confirm Upload
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Commission Statement Confirmation Modal */}
      <CommissionStatementConfirmation
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onBack={() => setShowConfirmation(false)}
        carrierId={carrierId}
        fileName={fileName}
        documentId={documentId || 0}
        mappedTransactions={editableData}
        onConfirm={handleConfirmationSubmit}
      />
    </Dialog>
  );
}