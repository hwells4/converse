import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCarrier } from "@/hooks/use-carriers";
import { CommissionStatement, N8NWebhookPayload } from "@shared/schema";
import { DollarSign, Calendar, FileText, Users, ArrowLeft, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CommissionStatementConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  carrierId: number;
  fileName: string;
  documentId: number;
  mappedTransactions: Array<Record<string, any>>;
  onConfirm: (statement: CommissionStatement) => void;
}

export function CommissionStatementConfirmation({
  isOpen,
  onClose,
  onBack,
  carrierId,
  fileName,
  documentId,
  mappedTransactions,
  onConfirm
}: CommissionStatementConfirmationProps) {
  const { toast } = useToast();
  const { data: carrier } = useCarrier(carrierId);
  
  // Calculate total commission amount from mapped transactions
  const calculateStatementAmount = () => {
    return mappedTransactions.reduce((total, transaction) => {
      const commissionField = Object.keys(transaction).find(key => 
        key.toLowerCase().includes('commission') && 
        transaction[key] && 
        !isNaN(parseFloat(transaction[key]))
      );
      
      if (commissionField) {
        const amount = parseFloat(transaction[commissionField]);
        return total + (isNaN(amount) ? 0 : amount);
      }
      return total;
    }, 0);
  };

  const [statementData, setStatementData] = useState<CommissionStatement>({
    carrierId,
    carrierName: carrier?.name || "",
    statementAmount: calculateStatementAmount(),
    statementNotes: "",
    statementDate: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!statementData.statementAmount || statementData.statementAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Statement amount must be greater than zero.",
        variant: "destructive"
      });
      return;
    }

    if (!statementData.statementDate) {
      toast({
        title: "Invalid Date",
        description: "Please select a statement date.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(statementData);
    } catch (error) {
      console.error("Error submitting statement:", error);
      toast({
        title: "Submission Error",
        description: "Failed to submit commission statement. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const transactionCount = mappedTransactions.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Commission Statement Confirmation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Card */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                Statement Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Document:</span>
                  <p className="text-gray-900">{fileName}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Transactions:</span>
                  <p className="text-gray-900 flex items-center gap-2">
                    {transactionCount}
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {transactionCount === 1 ? 'transaction' : 'transactions'}
                    </Badge>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statement Details Form */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Statement Details</h3>
            
            {/* Carrier (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="carrier"
                  value={`${carrier?.name || 'Loading...'}`}
                  disabled
                  className="bg-gray-50"
                />
                <Badge variant="outline" className="text-xs">
                  ID: {carrierId}
                </Badge>
              </div>
            </div>

            {/* Statement Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Statement Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={statementData.statementAmount}
                  onChange={(e) => setStatementData(prev => ({
                    ...prev,
                    statementAmount: parseFloat(e.target.value) || 0
                  }))}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500">
                Auto-calculated from commission amounts. You can adjust if needed.
              </p>
            </div>

            {/* Statement Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Statement Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="date"
                  type="date"
                  value={statementData.statementDate}
                  onChange={(e) => setStatementData(prev => ({
                    ...prev,
                    statementDate: e.target.value
                  }))}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Statement Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Statement Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes about this commission statement..."
                value={statementData.statementNotes || ""}
                onChange={(e) => setStatementData(prev => ({
                  ...prev,
                  statementNotes: e.target.value
                }))}
                rows={3}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={onBack}
              disabled={isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Mapping
            </Button>
            
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending to Salesforce...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Confirm & Send to Salesforce
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}