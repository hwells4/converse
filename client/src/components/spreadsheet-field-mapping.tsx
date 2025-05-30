import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, MapPin, Table, ArrowRight } from "lucide-react";

interface SpreadsheetFieldMappingProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  sampleData: string[][];
  fileName: string;
  carrierId: number;
  onProceedToSalesforce: (mapping: FieldMapping) => void;
}

interface FieldMapping {
  [spreadsheetHeaderIndex: number]: string; // Maps to Salesforce field name
}

// Common Salesforce fields for commission statements
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
];

export function SpreadsheetFieldMapping({ 
  isOpen, 
  onClose, 
  headers, 
  sampleData, 
  fileName, 
  carrierId,
  onProceedToSalesforce 
}: SpreadsheetFieldMappingProps) {
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-suggest mappings based on header names
  const getSuggestedMapping = (header: string): string | null => {
    const lowerHeader = header.toLowerCase().trim();
    
    // Simple matching logic - can be enhanced
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

  // Initialize auto-mapping when component loads
  const initializeAutoMapping = () => {
    const autoMapping: FieldMapping = {};
    headers.forEach((header, index) => {
      const suggestion = getSuggestedMapping(header);
      if (suggestion) {
        autoMapping[index] = suggestion;
      }
    });
    setFieldMapping(autoMapping);
  };

  // Initialize auto-mapping on first render
  useState(() => {
    if (isOpen && headers.length > 0) {
      initializeAutoMapping();
    }
  });

  const handleMappingChange = (headerIndex: number, salesforceField: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [headerIndex]: salesforceField
    }));
  };

  const handleProceed = async () => {
    setIsProcessing(true);
    try {
      await onProceedToSalesforce(fieldMapping);
    } catch (error) {
      console.error('Error proceeding to Salesforce:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getMappedFieldsCount = () => {
    return Object.keys(fieldMapping).length;
  };

  const getUsedSalesforceFields = () => {
    return Object.values(fieldMapping);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <span>Field Mapping</span>
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Map your spreadsheet columns to Salesforce fields for {fileName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Table className="h-4 w-4" />
                  <span>Mapping Progress</span>
                </span>
                <Badge variant="outline">
                  {getMappedFieldsCount()} of {headers.length} mapped
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                {headers.length} columns detected in your spreadsheet. Map them to corresponding Salesforce fields.
              </div>
            </CardContent>
          </Card>

          {/* Field Mapping Section */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Spreadsheet Columns */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spreadsheet Columns</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {headers.map((header, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-gray-700">
                            {header || `Column ${index + 1}`}
                          </Label>
                          {fieldMapping[index] && (
                            <Check className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        
                        <Select 
                          value={fieldMapping[index] || ""} 
                          onValueChange={(value) => handleMappingChange(index, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Salesforce field..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No mapping</SelectItem>
                            {SALESFORCE_FIELDS.filter(field => 
                              !getUsedSalesforceFields().includes(field.value) || 
                              fieldMapping[index] === field.value
                            ).map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Sample data preview */}
                        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                          Sample: {sampleData[0]?.[index] || 'No data'}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Right: Mapping Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Salesforce Mapping</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {Object.entries(fieldMapping).map(([headerIndex, salesforceField]) => {
                      const header = headers[parseInt(headerIndex)];
                      const salesforceFieldLabel = SALESFORCE_FIELDS.find(f => f.value === salesforceField)?.label;
                      
                      return (
                        <div key={headerIndex} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center space-x-2 text-sm">
                            <span className="font-medium text-gray-900">{header}</span>
                            <ArrowRight className="h-3 w-3 text-gray-400" />
                            <span className="text-blue-700">{salesforceFieldLabel}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Sample: {sampleData[0]?.[parseInt(headerIndex)] || 'No data'}
                          </div>
                        </div>
                      );
                    })}
                    
                    {getMappedFieldsCount() === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No mappings configured yet</p>
                        <p className="text-xs">Select Salesforce fields for your columns</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            {getMappedFieldsCount() > 0 ? (
              <span className="text-green-600 font-medium">
                ✓ {getMappedFieldsCount()} fields mapped
              </span>
            ) : (
              <span>Map at least one field to proceed</span>
            )}
          </div>
          
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleProceed}
              disabled={getMappedFieldsCount() === 0 || isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? "Processing..." : "Upload to Salesforce"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}