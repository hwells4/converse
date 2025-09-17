export function parseCSVLine(line: string): string[] {
  if (!line || typeof line !== 'string') {
    return [];
  }
  
  // Limit line length to prevent memory issues
  if (line.length > 50000) {
    throw new Error(`CSV line too long: ${line.length} characters (max 50000)`);
  }
  
  const result = [];
  let current = '';
  let inQuotes = false;
  let quoteCount = 0;
  
  try {
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        quoteCount++;
        // Handle escaped quotes (double quotes)
        if (i + 1 < line.length && line[i + 1] === '"' && inQuotes) {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Check for unclosed quotes
    if (inQuotes) {
      console.warn(`CSV line has unclosed quotes, attempting to parse anyway: ${line.substring(0, 100)}...`);
    }
    
    result.push(current.trim());
    
    // Limit field count to prevent memory issues
    if (result.length > 1000) {
      throw new Error(`CSV line has too many fields: ${result.length} (max 1000)`);
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing CSV line:', error);
    throw new Error(`Failed to parse CSV line: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function parseCSVContent(csvContent: string) {
  if (!csvContent || typeof csvContent !== 'string') {
    throw new Error('CSV content must be a non-empty string');
  }
  
  // Limit total content size to prevent memory issues
  if (csvContent.length > 10 * 1024 * 1024) { // 10MB limit
    throw new Error(`CSV content too large: ${csvContent.length} bytes (max 10MB)`);
  }
  
  try {
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }
    
    // Limit number of lines to prevent memory issues
    if (lines.length > 50000) {
      throw new Error(`CSV has too many lines: ${lines.length} (max 50000)`);
    }
    
    const headers = parseCSVLine(lines[0]);
    
    if (headers.length === 0) {
      throw new Error('CSV header row is empty or invalid');
    }
    
    const rows = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        
        // Warn if row has different number of columns than header
        if (values.length !== headers.length) {
          console.warn(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}`);
        }
        
        const row = values.map(value => ({
          value: value.replace(/^"|"$/g, ''), // Remove surrounding quotes
          confidence: 100 // CSV doesn't have confidence scores
        }));
        
        rows.push(row);
      } catch (error) {
        const errorMsg = `Error parsing row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push({ row: i + 1, error: errorMsg });
        
        // Continue parsing other rows but track errors
        // Add empty row to maintain structure
        rows.push(headers.map(() => ({ value: '', confidence: 0 })));
      }
    }
    
    // If too many errors, fail completely
    if (errors.length > lines.length * 0.1) { // More than 10% errors
      throw new Error(`Too many parsing errors (${errors.length}/${lines.length}). CSV may be malformed.`);
    }
    
    return { 
      headers, 
      rows,
      parseErrors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    console.error('Error parsing CSV content:', error);
    throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}