Product Requirements Document: Commission Statement Processor (Version 2)
1. Introduction & Goals
Product Name: Commission Statement Processor (CSP)
Purpose: To enable users to upload PDF commission statements, have the data extracted (leveraging AWS Textract JSON output for confidence scores), review and edit the data, and then upload the corrected, standardized data to Salesforce via an N8N webhook.
Primary Goal: Significantly reduce the manual effort and time required to process commission statements and input data into Salesforce, while improving data accuracy through user review and confidence score highlighting.
Target User: Internal staff responsible for processing commission statements.
2. User Stories
US001 (Upload): As a user, I want to upload a PDF commission statement so that its data can be extracted.
US002 (Carrier ID): As a user, I want to select the insurance carrier associated with the uploaded PDF from a predefined list (initially hardcoded/seeded, potentially searchable later) so that the system can correctly identify the source.
US003 (Parsing): As a system, I want to send the uploaded PDF to a backend service that uses AWS Textract to parse its content, primarily into a JSON format that includes confidence scores for extracted data elements, and secondarily a CSV.
US004 (Data Review): As a user, I want to view the parsed data from the JSON in an editable table format so that I can verify its accuracy.
US005 (PDF Side-by-Side - Deferred): As a user, I want to optionally view the original PDF alongside the editable table so I can easily cross-reference data during review. (Deferred for post-MVP).
US006 (Edit Data): As a user, I want to edit cell values, add new rows, and delete incorrect rows in the review table so that the data is accurate before uploading to Salesforce.
US007 (Header Mapping - MVP): As a user, I want the system to display parsed data with its original headers, and I want to be able to manually rename/correct these column headers in the review table to match a predefined set of "Standard Salesforce Headers".
US008 (Save Mapping - Post-MVP): As a user (or admin), I want the system to (eventually) save successful header mappings for a specific carrier/report type so they can be automatically applied to future uploads. (Post-MVP).
US009 (Confidence Display): As a user, I want cells with low parsing confidence (derived from Textract JSON) to be visually highlighted in the review table so I can pay special attention to them.
US010 (Pre-Upload Summary): As a user, I want to see a final summary/preview of the data after my edits and header corrections (showing "Standard Salesforce Headers") before it's sent to Salesforce, so I can give one last confirmation.
US011 (Salesforce Upload): As a user, I want to click an "Upload to Salesforce" button that sends the confirmed, standardized data (structured as a "Statement" and related "Transactions") to a pre-configured N8N webhook.
US012 (Status Tracking): As a user, I want to see the status of my uploaded documents (e.g., Uploaded, Processing, Review_Pending, Salesforce_Upload_Pending, Completed, Failed).
US013 (Historical View): As a user, I want to view a list of previously uploaded documents and their status, and re-open processed data for viewing (perhaps in a read-only view if already sent to Salesforce).
3. Functional Requirements
3.1. Document Upload & Initial Processing
FR001 (File Input):
UI provides an upload mechanism for PDF files (up to 50MB).
User must select "Carrier" from a predefined list (managed via backend, initially hardcoded/seeded by stakeholder).
FR002 (Backend Upload Handling):
Client requests a presigned S3 URL from the backend.
Backend generates URL; S3 key includes carrier_id and uuid.
Client uploads PDF to S3 via presigned URL.
FR003 (Metadata Creation):
Backend creates a documents record in PostgreSQL with filename, originalName, documentType ("commission"), s3Key, s3Url, fileSize, associated carrierId, and initial status: "uploaded".
FR004 (Textract Invocation & Output):
Backend invokes Textract Lambda with PDF S3 details.
Lambda MUST be updated to output:
Primary: A JSON file to S3 (e.g., processed/<carrier_id>/<uuid>/<filename>.json) containing structured data and confidence scores from Textract.
Secondary: A CSV file to S3 (e.g., processed/<carrier_id>/<uuid>/<filename>.csv).
DB record updated with textractJobId and status: "processing".
FR005 (Lambda Webhook & Payload Definition):
The Textract processing Lambda (upon completion or failure) will call the /api/webhook/document-processed endpoint on the application server.
The webhook payload sent BY THE LAMBDA to the application server MUST be a JSON object with the following structure and fields:
{
  "s3Key": "uploads/carrier_id/uuid/original_filename.pdf", // S3 Key of the ORIGINAL uploaded PDF
  "status": "processed", // or "failed"
  "textractJobId": "textract_job_id_string",
  "jsonS3Key": "processed/carrier_id/uuid/original_filename.json", // S3 Key of the structured JSON output
  "jsonUrl": "https://your-bucket.s3.region.amazonaws.com/processed/carrier_id/uuid/original_filename.json", // Full URL to the JSON
  "csvS3Key": "processed/carrier_id/uuid/original_filename.csv", // S3 Key of the CSV output (can be null if CSV generation failed or was skipped)
  "csvUrl": "https://your-bucket.s3.region.amazonaws.com/processed/carrier_id/uuid/original_filename.csv", // Full URL to the CSV (can be null)
  "errorMessage": null // or "Error message string if status is 'failed'"
}
The application's webhook handler (/api/webhook/document-processed) will:
Use s3Key (original PDF key) to find the corresponding document record in the database.
Update the document record with status, textractJobId, jsonS3Key, jsonUrl, csvS3Key, csvUrl, and processingError.
If status from the webhook is "processed", the document's application status should be updated to "Review_Pending".

3.2. Data Review & Editing Interface
FR006 (Document List & Navigation):
RecentDocuments component shows documents with status "Review_Pending".
Clicking navigates to a new "Review" page.
FR007 (Review Page - Data Display):
Page fetches and displays data from the S3 JSON file in an editable table.
Cells with confidence scores (from JSON) below a configurable threshold (e.g., 90%) MUST be visually highlighted (e.g., distinct background color).
FR008 (Column Header Standardization - MVP):
The review table will initially display columns with headers as parsed from the PDF/JSON.
Users MUST be able to manually edit/rename these column headers in the UI to match the "Standard Salesforce Headers".
The list of "Standard Salesforce Headers" is pending stakeholder input (see Section 7).
FR009 (Data Editing Capabilities):
Users must be able to: Edit cell values, add new empty rows, delete selected rows.
FR010 (Saving Edits - Optional MVP):
(Optional for MVP, can be client-side state only) A "Save Draft" could persist interim edits to the backend, updating document status to "Review_InProgress".
FR011 (Pre-Upload Confirmation):
"Proceed to Upload" button leads to a confirmation screen.
Displays a read-only summary of data with Standard Salesforce Headers applied, structured into "Statement" details and a list of "Transactions".
User confirms or goes back to edit.
3.3. Salesforce Upload (via N8N)
FR012 (Trigger N8N Webhook):
Upon confirmation, client sends final data (with Standard Salesforce Headers and structured as Statement/Transactions) to a backend API endpoint.
Backend API POSTs this data to the N8N webhook.
Payload structure for N8N is pending stakeholder input (see Section 7). It will involve:
Data to create a single "Statement" record (linked to carrier, date, etc.).
Data to create multiple "Transaction" records, each linked to the ID of the newly created Statement.
Document status in DB changes to "Salesforce_Upload_Pending".
FR013 (N8N/Salesforce Status Update):
N8N workflow (ideally) calls back to /api/webhook/salesforce-status with success/failure.
Webhook updates DB status to "Completed" or "Salesforce_Upload_Failed" (with error).
If callback is not feasible for MVP, UI assumes success after N8N call, with manual reconciliation.
3.4. System & Configuration
FR014 (Standard Headers & Structure Definition - PENDING STAKEHOLDER):
The "Standard Salesforce Headers" and the detailed structure for the "Statement" and "Transaction" objects for N8N payload MUST BE DEFINED BY STAKEHOLDER. This definition will drive backend transformation and N8N payload generation.
FR015 (Carrier Management - MVP):
Backend manages a predefined list of carriers (Name, ID). Stakeholder to provide initial list or it will be hardcoded.
Stored in carriers table in PostgreSQL.
4. Non-Functional Requirements
NFR001 (Security): Backend AWS operations, secure presigned URLs, secure webhooks.
NFR002 (Usability): Intuitive UI, clear error messages, effective highlighting of low-confidence data.
NFR003 (Performance): Editable table handles hundreds of rows smoothly. Acceptable S3/Lambda processing.
NFR004 (Accuracy): Textract JSON confidence scores are primary tool for guiding user review.
NFR005 (Scalability): Replit backend/DB, S3/Lambda scalability.
NFR006 (Maintainability): Adherence to codebase patterns and shared schemas.
5. Technical Considerations & Stack Alignment
As previously outlined (Node/Express/Drizzle, React/Vite/Shadcn, S3, Lambda, N8N).
Prioritize using Textract JSON output for data and confidence.
6. Assumptions
Backend AWS credentials configured.
N8N webhook URL provided.
Initial carrier list provided or hardcoding accepted for MVP.
Single user model acceptable for MVP.
7. Open Questions / Items for Stakeholder Clarification
CRITICAL PENDING INPUT:
Data Structure for Salesforce/N8N:
What are the exact "Standard Salesforce Headers" for the transaction line items?
What fields are required for the parent "Statement" object in Salesforce (e.g., Carrier, Statement Date, Total Commission, etc.)?
How are "Transactions" linked to the "Statement" in Salesforce (e.g., Statement ID)?
(AI TASKMASTER: Create a placeholder task: "Stakeholder to provide detailed Salesforce 'Statement' and 'Transaction' object structures, including all fields and standard headers for transactions. This is required before implementing FR012 and FR014.")
N8N Webhook Callback:
Reconfirm feasibility of N8N calling /api/webhook/salesforce-status and its expected payload.
Initial Carrier List:
Please provide the initial list of carriers to be hardcoded/seeded.
8. Out of Scope for MVP (Potential Future Enhancements)
Salesforce OAuth for dynamic carrier list pulling.
Advanced/AI-driven header mapping.
User-defined and saved header mappings per carrier.
Integration of a second PDF parsing service for comparison.
PDF side-by-side view in review UI.
Full-text search, advanced analytics, direct Salesforce API integration.