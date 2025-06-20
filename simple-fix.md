# Simple Fix for Document Status Updates

Instead of webhook complexity, add a direct API call in the frontend that:

1. After submitting corrections to n8n
2. Immediately call a new endpoint: `/api/documents/{id}/mark-processing`
3. That endpoint updates the document to show "processing corrections"
4. Frontend polls every 2 seconds to check if corrections are done
5. When done, update status to "completed" or "completed_with_errors"

This bypasses the webhook entirely and gives immediate feedback.

Would you like me to implement this direct approach?