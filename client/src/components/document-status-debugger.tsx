import { useState, useEffect } from "react";
import { useDocuments, useForceRefreshDocuments } from "@/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

export function DocumentStatusDebugger() {
  const { data: documents, isLoading, isFetching, dataUpdatedAt } = useDocuments();
  const forceRefresh = useForceRefreshDocuments();
  const [pollCount, setPollCount] = useState(0);
  
  useEffect(() => {
    if (isFetching) {
      setPollCount(prev => prev + 1);
    }
  }, [isFetching]);
  
  const problemDocuments = documents?.filter(doc => 
    doc.status === "salesforce_upload_pending" || 
    doc.status === "uploading"
  ) || [];
  
  return (
    <Card className="fixed bottom-4 right-4 w-96 shadow-lg border-2 border-red-500 bg-white/95 backdrop-blur z-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>🐛 Status Debugger</span>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => forceRefresh()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            Force Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <strong>Last Update:</strong> {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : 'Never'}
        </div>
        <div>
          <strong>Poll Count:</strong> {pollCount}
        </div>
        <div>
          <strong>Is Fetching:</strong> {isFetching ? '✅ Yes' : '❌ No'}
        </div>
        <div>
          <strong>Total Documents:</strong> {documents?.length || 0}
        </div>
        
        {problemDocuments.length > 0 && (
          <div className="border-t pt-2 mt-2">
            <strong className="text-red-600">Stuck Documents:</strong>
            {problemDocuments.map(doc => (
              <div key={doc.id} className="ml-2 mt-1">
                ID: {doc.id} - Status: {doc.status}
                <br />
                File: {doc.originalName}
              </div>
            ))}
          </div>
        )}
        
        <div className="border-t pt-2 mt-2">
          <Button 
            size="sm" 
            variant="destructive" 
            className="w-full"
            onClick={async () => {
              const response = await fetch('/api/documents/status-check');
              const data = await response.json();
              console.log('📊 Direct API Status Check:', data);
              alert('Check console for direct API status');
            }}
          >
            Check Direct API Status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}