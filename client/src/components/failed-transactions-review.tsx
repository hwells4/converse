import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Save, X, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface FailedTransaction {
  type: string;
  error: string;
  insuredName: string | null;
  statementId: string;
  originalData: {
    "Policy Name": string | null;
    "Policy Number": string;
    "Name of Insured": string | null;
    "Transaction Type": string | null;
    "Transaction Amount": string;
    "Commission Statement": string;
  };
  policyNumber: string;
  transactionAmount: string;
  commissionStatementId: string;
}

interface FailedTransactionsReviewProps {
  isOpen: boolean;
  onClose: () => void;
  failedTransactions: FailedTransaction[];
  document: any;
  onResubmit: (correctedTransactions: any[]) => void;
}

export function FailedTransactionsReview({
  isOpen,
  onClose,
  failedTransactions,
  document,
  onResubmit
}: FailedTransactionsReviewProps) {
  const [editingTransactions, setEditingTransactions] = useState<FailedTransaction[]>(
    failedTransactions.map(t => ({ ...t }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFieldChange = (index: number, field: string, value: string) => {
    setEditingTransactions(prev => 
      prev.map((transaction, i) => 
        i === index 
          ? { 
              ...transaction, 
              originalData: { 
                ...transaction.originalData, 
                [field]: value 
              },
              ...(field === "Policy Number" && { policyNumber: value })
            }
          : transaction
      )
    );
  };

  const handleResubmit = async () => {
    setIsSubmitting(true);
    
    try {
      console.log("Resubmitting corrected transactions:", editingTransactions);
      
      // Call the backend endpoint to resubmit failed transactions
      const response = await fetch(`/api/documents/${document.id}/resubmit-failed-transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          correctedTransactions: editingTransactions
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || 'Resubmission failed');
      }
      
      const result = await response.json();
      console.log('Resubmission result:', result);
      
      // Show success toast
      toast({
        title: "Corrections Submitted",
        description: "Processing corrections... The status will update automatically when complete.",
      });
      
      // Immediately close the modal and update the document status
      setIsSubmitting(false);
      onResubmit(editingTransactions);
      onClose();
      
      // Refresh documents data to pick up the processing state immediately
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", document.id] });
      
    } catch (error) {
      console.error('Resubmission error:', error);
      setIsSubmitting(false);
      toast({
        title: "Resubmission Failed",
        description: error instanceof Error ? error.message : "Failed to resubmit transactions. Please try again.",
        variant: "destructive",
      });
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Review Failed Transactions - {document.originalName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-orange-800">
                {failedTransactions.length} transaction(s) failed to upload to Salesforce
              </span>
            </div>
            <p className="text-sm text-orange-700">
              Review and correct the information below, then resubmit to complete the upload process.
            </p>
          </div>

          {/* Spreadsheet-like table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Policy Number *
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name of Insured
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction Type
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {editingTransactions.map((transaction, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-medium">{index + 1}</span>
                      </td>
                      <td className="px-3 py-4 text-sm">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center space-x-2">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <span className="text-red-600 text-xs">Failed</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-sm">{transaction.error}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <Input
                          value={transaction.originalData["Policy Number"] || ""}
                          onChange={(e) => handleFieldChange(index, "Policy Number", e.target.value)}
                          className="w-48 text-sm"
                          placeholder="Enter policy number"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <Input
                          value={transaction.originalData["Name of Insured"] || ""}
                          onChange={(e) => handleFieldChange(index, "Name of Insured", e.target.value)}
                          className="w-40 text-sm"
                          placeholder="Insured name"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <Input
                          value={transaction.originalData["Transaction Type"] || ""}
                          onChange={(e) => handleFieldChange(index, "Transaction Type", e.target.value)}
                          className="w-32 text-sm"
                          placeholder="Transaction type"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <Input
                          value={transaction.originalData["Transaction Amount"] || ""}
                          onChange={(e) => handleFieldChange(index, "Transaction Amount", e.target.value)}
                          className="w-24 text-sm bg-gray-50"
                          placeholder="Amount"
                          readOnly
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button 
              onClick={handleResubmit}
              disabled={isSubmitting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Resubmit to Salesforce
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}