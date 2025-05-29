import boto3
import json
import csv
import io
import os
import traceback # For detailed error logging
import requests 
import math  # For spatial calculations

# Add AI processing imports
try:
    import openai
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    print("OpenAI not available - table restructuring will be disabled")

textract_client = boto3.client('textract')
s3_client = boto3.client('s3')

# Environment variable for the S3 bucket where processed files (CSV and JSON) will be stored.
OUTPUT_S3_BUCKET = os.environ['OUTPUT_S3_BUCKET']
# Environment variable for the S3 prefix for processed files (e.g., "processed/")
OUTPUT_S3_PREFIX = os.environ.get('OUTPUT_S3_PREFIX', 'processed').strip('/')
# Optional: Environment variable for your application's webhook URL
WEBHOOK_URL = os.environ.get('APPLICATION_WEBHOOK_URL')
# Optional: Environment variable for a shared secret for webhook authentication
WEBHOOK_SECRET = os.environ.get('APPLICATION_WEBHOOK_SECRET')
# Optional: OpenAI API key for table restructuring
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')


# --- Helper Functions --- (These remain unchanged from the previous full version)

def get_textract_results(job_id):
    """Fetches all pages of Textract results (Blocks)."""
    results_blocks = []
    next_token = None
    try:
        while True:
            kwargs = {'JobId': job_id, 'MaxResults': 1000}
            if next_token:
                kwargs['NextToken'] = next_token
            
            response = textract_client.get_document_analysis(**kwargs)
            results_blocks.extend(response.get('Blocks', []))
            
            next_token = response.get('NextToken')
            if not next_token:
                break
        print(f"Successfully fetched {len(results_blocks)} blocks for JobId: {job_id}")
    except Exception as e:
        print(f"Error fetching Textract results for JobId {job_id}: {str(e)}")
        raise 
    return results_blocks

def get_text_and_confidence_from_block(block, blocks_map):
    """
    Extracts text and calculates an aggregated confidence score from a given block,
    resolving child WORD blocks if necessary.
    Returns a tuple: (extracted_text, aggregated_confidence_score)
    """
    text_parts = []
    confidences = []
    
    if block.get('Relationships'):
        for relationship in block['Relationships']:
            if relationship['Type'] == 'CHILD':
                for child_id in relationship['Ids']:
                    child_block = blocks_map.get(child_id)
                    if child_block and child_block['BlockType'] == 'WORD':
                        text_parts.append(child_block['Text'])
                        confidences.append(child_block.get('Confidence', 0))
                    elif child_block and child_block['BlockType'] == 'SELECTION_ELEMENT':
                        status_text = "[X]" if child_block['SelectionStatus'] == 'SELECTED' else "[ ]"
                        text_parts.append(status_text)
                        confidences.append(child_block.get('Confidence', 0))
                        
    full_text = ' '.join(text_parts).strip()
    
    if not full_text and 'Text' in block:
        full_text = block['Text']
        confidences.append(block.get('Confidence', 0)) 

    aggregated_confidence = min(confidences) if confidences else 0.0
    
    return full_text.strip(), aggregated_confidence

def parse_tables_to_csv_data(blocks, blocks_map):
    """Parses TABLE blocks from Textract JSON into a list of CSV rows."""
    tables = [block for block in blocks if block['BlockType'] == 'TABLE']
    all_csv_rows = []

    if not tables:
        print("No tables found in the document. Attempting to extract LINEs for CSV.")
        lines = [b for b in blocks if b['BlockType'] == 'LINE']
        if lines:
            all_csv_rows.append(["Detected Lines (No Table Structure Found)"])
            for line_block in lines:
                text, _ = get_text_and_confidence_from_block(line_block, blocks_map)
                all_csv_rows.append([text])
        return all_csv_rows

    print(f"Found {len(tables)} table(s) for CSV generation.")
    for table_num, table in enumerate(tables):
        page_number = table.get('Page', 'Unknown')
        if all_csv_rows: 
            all_csv_rows.append([]) 
            all_csv_rows.append([f"--- Table {table_num + 1} (Page {page_number}) ---"])

        # Try spatial reconstruction first (Task 17 implementation)
        spatial_table = reconstruct_table_structure_spatially(table, blocks_map)
        
        if spatial_table:
            print(f"Using spatial reconstruction for CSV Table {table_num + 1}")
            # Convert spatial table to CSV rows
            for spatial_row in spatial_table['rows']:
                csv_row = []
                for cell in spatial_row['cells']:
                    csv_row.append(cell['text'])
                all_csv_rows.append(csv_row)
            print(f"Processed {len(spatial_table['rows'])} rows for spatially reconstructed CSV Table {table_num + 1}.")
            continue
        
        # Fall back to original method if spatial reconstruction fails
        print(f"Spatial reconstruction failed for CSV Table {table_num + 1}, using original method")
        
        table_cells_map = {} 
        max_row, max_col = 0, 0
        
        cell_blocks_in_table = []
        if 'Relationships' in table:
            for relationship in table['Relationships']:
                if relationship['Type'] == 'CHILD':
                    for G_id in relationship['Ids']: 
                        G_block = blocks_map.get(G_id)
                        if G_block and G_block['BlockType'] == 'CELL':
                            cell_blocks_in_table.append(G_block)
                        elif G_block and G_block['BlockType'] == 'MERGED_CELL':
                            if G_block.get('Relationships'):
                                for merged_rel in G_block['Relationships']:
                                    if merged_rel['Type'] == 'CHILD':
                                        for m_cell_id in merged_rel['Ids']:
                                            m_cell = blocks_map.get(m_cell_id)
                                            if m_cell and m_cell['BlockType'] == 'CELL':
                                                cell_blocks_in_table.append(m_cell)
        
        if not cell_blocks_in_table:
            print(f"Table {table_num + 1} on page {page_number} has no cell blocks. Skipping for CSV.")
            continue

        for cell_block in cell_blocks_in_table:
            row_idx = cell_block['RowIndex']
            col_idx = cell_block['ColumnIndex']
            row_span = cell_block.get('RowSpan', 1)
            col_span = cell_block.get('ColumnSpan', 1)
            
            cell_text, _ = get_text_and_confidence_from_block(cell_block, blocks_map)
                            
            for r_offset in range(row_span):
                for c_offset in range(col_span):
                    current_r, current_c = row_idx + r_offset, col_idx + c_offset
                    if r_offset == 0 and c_offset == 0:
                         table_cells_map[(current_r, current_c)] = cell_text
                    else: 
                         table_cells_map[(current_r, current_c)] = table_cells_map.get((current_r, current_c), "")
            
            max_row = max(max_row, row_idx + row_span - 1)
            max_col = max(max_col, col_idx + col_span - 1)
        
        if not table_cells_map:
            print(f"No cell data extracted for Table {table_num + 1} on page {page_number} for CSV.")
            continue

        current_table_rows = []
        for r in range(1, max_row + 1):
            row_data = [table_cells_map.get((r, c), "") for c in range(1, max_col + 1)]
            current_table_rows.append(row_data)
        
        all_csv_rows.extend(current_table_rows)
        print(f"Processed {len(current_table_rows)} rows for CSV Table {table_num + 1}.")
        
    return all_csv_rows

def parse_blocks_to_structured_json(blocks, blocks_map, original_s3_key, job_id):
    """
    Parses Textract blocks into a structured JSON format including tables,
    key-value pairs, and raw lines, with confidence scores.
    """
    output_json = {
        "originalS3Key": original_s3_key,
        "processingJobId": job_id,
        "documentMetadata": {}, 
        "tables": [],
        "keyValuePairs": [], 
        "rawLines": [] 
    }

    pages = [block for block in blocks if block['BlockType'] == 'PAGE']
    output_json["documentMetadata"]["pageCount"] = len(pages)
    
    table_blocks = [block for block in blocks if block['BlockType'] == 'TABLE']
    print(f"Found {len(table_blocks)} table(s) for JSON generation.")

    for table_block in table_blocks:
        # First, try spatial reconstruction (Task 17 implementation)
        spatial_table = reconstruct_table_structure_spatially(table_block, blocks_map)
        
        if spatial_table:
            print(f"Using spatial reconstruction for table {table_block['Id']}")
            # Convert spatial table format to match existing JSON structure
            table_data = {
                "tableId": table_block['Id'],
                "pageNumber": table_block.get('Page'),
                "confidence": table_block.get('Confidence'), 
                "rowCount": spatial_table['row_count'], 
                "columnCount": spatial_table['column_count'], 
                "spatiallyReconstructed": True,
                "rows": []
            }
            
            # Convert spatial table rows to match existing format
            for spatial_row in spatial_table['rows']:
                converted_row = {
                    "rowIndex": spatial_row['row_index'],
                    "cells": []
                }
                
                for cell in spatial_row['cells']:
                    converted_cell = {
                        "cellId": f"spatial_{table_block['Id']}_{spatial_row['row_index']}_{cell['column_index']}",
                        "rowIndex": spatial_row['row_index'],
                        "columnIndex": cell['column_index'],
                        "rowSpan": 1,
                        "columnSpan": 1,
                        "text": cell['text'],
                        "confidence": cell['confidence'],
                        "geometry": None,  # Spatial reconstruction doesn't preserve original geometry
                        "spatiallyReconstructed": True
                    }
                    converted_row["cells"].append(converted_cell)
                
                table_data["rows"].append(converted_row)
            
            output_json["tables"].append(table_data)
            print(f"Added spatially reconstructed table with {table_data['rowCount']} rows and {table_data['columnCount']} columns")
            
        else:
            print(f"Spatial reconstruction failed for table {table_block['Id']}, falling back to original method")
            # Fall back to original table parsing method
            table_data = {
                "tableId": table_block['Id'],
                "pageNumber": table_block.get('Page'),
                "confidence": table_block.get('Confidence'), 
                "rowCount": 0, 
                "columnCount": 0, 
                "spatiallyReconstructed": False,
                "rows": []
            }
            
            cells_in_current_table = []
            if 'Relationships' in table_block:
                for relationship in table_block['Relationships']:
                    if relationship['Type'] == 'CHILD': 
                        for G_id in relationship['Ids']:
                            G_block = blocks_map.get(G_id)
                            if G_block and G_block['BlockType'] == 'CELL':
                                cells_in_current_table.append(G_block)
                            elif G_block and G_block['BlockType'] == 'MERGED_CELL':
                                 if G_block.get('Relationships'):
                                    for merged_rel in G_block['Relationships']:
                                        if merged_rel['Type'] == 'CHILD':
                                            for m_cell_id in merged_rel['Ids']:
                                                m_cell = blocks_map.get(m_cell_id)
                                                if m_cell and m_cell['BlockType'] == 'CELL':
                                                    cells_in_current_table.append(m_cell)
            
            if not cells_in_current_table:
                print(f"Table {table_block['Id']} has no cell blocks. Skipping for JSON.")
                continue

            parsed_cells_map = {}
            max_r, max_c = 0, 0

            for cell_block in cells_in_current_table:
                text, confidence = get_text_and_confidence_from_block(cell_block, blocks_map)
                cell_info = {
                    "cellId": cell_block['Id'],
                    "rowIndex": cell_block['RowIndex'],
                    "columnIndex": cell_block['ColumnIndex'],
                    "rowSpan": cell_block.get('RowSpan', 1),
                    "columnSpan": cell_block.get('ColumnSpan', 1),
                    "text": text,
                    "confidence": round(confidence, 2) if confidence is not None else None,
                    "geometry": cell_block.get('Geometry'),
                    "spatiallyReconstructed": False
                }
                parsed_cells_map[(cell_info["rowIndex"], cell_info["columnIndex"])] = cell_info
                max_r = max(max_r, cell_info["rowIndex"] + cell_info["rowSpan"] - 1)
                max_c = max(max_c, cell_info["columnIndex"] + cell_info["columnSpan"] - 1)

            table_data["rowCount"] = max_r
            table_data["columnCount"] = max_c

            temp_rows_dict = {} 
            for (r_idx, c_idx), cell_detail in sorted(parsed_cells_map.items()):
                if r_idx not in temp_rows_dict:
                    temp_rows_dict[r_idx] = []
                temp_rows_dict[r_idx].append(cell_detail)

            for r_idx in sorted(temp_rows_dict.keys()):
                sorted_cells = sorted(temp_rows_dict[r_idx], key=lambda c: c['columnIndex'])
                table_data["rows"].append({
                    "rowIndex": r_idx,
                    "cells": sorted_cells
                })
            
            output_json["tables"].append(table_data)

    # Apply AI restructuring to tables if available
    if output_json["tables"] and AI_AVAILABLE and OPENAI_API_KEY:
        print("Applying AI table restructuring...")
        for i, table in enumerate(output_json["tables"]):
            print(f"Restructuring table {i + 1}...")
            restructured_table = smart_table_restructure(table)
            output_json["tables"][i] = restructured_table
        print("AI table restructuring completed")
    else:
        print("AI table restructuring skipped (not available or no API key)")

    key_value_blocks = [block for block in blocks if block['BlockType'] == 'KEY_VALUE_SET']
    print(f"Found {len(key_value_blocks)} KEY_VALUE_SET blocks for JSON.")
    keys = [kv for kv in key_value_blocks if 'KEY' in kv.get('EntityTypes', [])]
    
    for key_block in keys:
        key_text, key_confidence = get_text_and_confidence_from_block(key_block, blocks_map)
        value_text, value_confidence = "", 0.0
        
        if key_block.get('Relationships'):
            for rel in key_block['Relationships']:
                if rel['Type'] == 'VALUE':
                    for value_id in rel['Ids']:
                        value_block = blocks_map.get(value_id)
                        if value_block:
                            v_text, v_conf = get_text_and_confidence_from_block(value_block, blocks_map)
                            value_text += v_text + " " 
                            value_confidence = max(value_confidence, v_conf) 
                    break 

        output_json["keyValuePairs"].append({
            "key": key_text.strip(),
            "keyConfidence": round(key_confidence, 2),
            "value": value_text.strip(),
            "valueConfidence": round(value_confidence, 2),
            "keyGeometry": key_block.get('Geometry'),
            "pageNumber": key_block.get('Page')
        })

    line_blocks = [block for block in blocks if block['BlockType'] == 'LINE']
    print(f"Found {len(line_blocks)} LINE blocks for JSON.")
    for line_block in line_blocks:
        text, confidence = get_text_and_confidence_from_block(line_block, blocks_map)
        output_json["rawLines"].append({
            "lineId": line_block['Id'],
            "text": text,
            "confidence": round(confidence, 2),
            "geometry": line_block.get('Geometry'),
            "pageNumber": line_block.get('Page')
        })
        
    return output_json

def smart_table_restructure(table_data):
    """
    Uses AI to analyze and restructure table data to handle multi-row headers
    and misaligned data. Only processes the table structure, not the entire JSON.
    """
    if not AI_AVAILABLE or not OPENAI_API_KEY:
        print("AI restructuring not available - returning original table data")
        return table_data
    
    try:
        # Configure OpenAI
        openai.api_key = OPENAI_API_KEY
        
        # Extract just the table structure for analysis (first 10 rows max)
        sample_rows = table_data.get('rows', [])[:10]
        
        # Create a simplified representation for AI analysis
        analysis_data = []
        for row in sample_rows:
            row_texts = []
            for cell in row.get('cells', []):
                row_texts.append(cell.get('text', ''))
            analysis_data.append(row_texts)
        
        # Create the AI prompt
        prompt = f"""
Analyze this table structure extracted from a document. The table appears to have multi-row headers that need to be consolidated.

Table data (first 10 rows):
{json.dumps(analysis_data, indent=2)}

Please:
1. Identify which rows contain header information
2. Consolidate multi-row headers into a single header row
3. Determine the correct column alignment for data rows
4. Return a JSON response with:
   - "header_row_indices": [list of row numbers that contain headers]
   - "consolidated_headers": [list of final column headers]
   - "data_start_row": index where actual data begins
   - "column_mapping": mapping of original columns to new structure

Respond only with valid JSON.
"""

        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a data structure analyst. Respond only with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.1
        )
        
        ai_analysis = json.loads(response.choices[0].message.content)
        print(f"AI Analysis: {ai_analysis}")
        
        # Apply the AI recommendations to restructure the table
        header_indices = ai_analysis.get('header_row_indices', [0])
        consolidated_headers = ai_analysis.get('consolidated_headers', [])
        data_start_row = ai_analysis.get('data_start_row', 1)
        
        if consolidated_headers and data_start_row < len(table_data.get('rows', [])):
            # Create new restructured table
            restructured_table = {
                **table_data,  # Preserve all original metadata
                'restructured': True,
                'original_row_count': len(table_data.get('rows', [])),
                'ai_analysis': ai_analysis
            }
            
            # Create new rows with proper structure
            new_rows = []
            
            # Add the consolidated header row
            header_row = {
                'rowIndex': 1,
                'cells': []
            }
            
            for i, header_text in enumerate(consolidated_headers):
                header_row['cells'].append({
                    'cellId': f'header_{i}',
                    'rowIndex': 1,
                    'columnIndex': i + 1,
                    'rowSpan': 1,
                    'columnSpan': 1,
                    'text': header_text,
                    'confidence': 100,  # High confidence for AI-generated headers
                    'geometry': None
                })
            
            new_rows.append(header_row)
            
            # Add data rows starting from the identified data start row
            original_rows = table_data.get('rows', [])
            for row_idx, original_row in enumerate(original_rows[data_start_row:], start=2):
                new_row = {
                    'rowIndex': row_idx,
                    'cells': []
                }
                
                # Align cells with new header structure
                original_cells = original_row.get('cells', [])
                for col_idx, header in enumerate(consolidated_headers):
                    if col_idx < len(original_cells):
                        cell = original_cells[col_idx].copy()
                        cell['rowIndex'] = row_idx
                        cell['columnIndex'] = col_idx + 1
                        new_row['cells'].append(cell)
                    else:
                        # Add empty cell if data is missing
                        new_row['cells'].append({
                            'cellId': f'empty_{row_idx}_{col_idx}',
                            'rowIndex': row_idx,
                            'columnIndex': col_idx + 1,
                            'rowSpan': 1,
                            'columnSpan': 1,
                            'text': '',
                            'confidence': 0,
                            'geometry': None
                        })
                
                new_rows.append(new_row)
            
            restructured_table['rows'] = new_rows
            restructured_table['rowCount'] = len(new_rows)
            restructured_table['columnCount'] = len(consolidated_headers)
            
            print(f"Successfully restructured table: {len(new_rows)} rows, {len(consolidated_headers)} columns")
            return restructured_table
        
        else:
            print("AI analysis did not provide sufficient restructuring information")
            return table_data
            
    except Exception as e:
        print(f"Error in AI table restructuring: {str(e)}")
        traceback.print_exc()
        return table_data  # Return original data if AI processing fails

# Add new spatial reconstruction function after the existing helper functions
def reconstruct_table_structure_spatially(table_block, blocks_map):
    """
    Implements spatial coordinate-based reconstruction to properly align 
    Textract-extracted table data using geometry coordinates.
    
    Returns a spatially reconstructed table with proper row/column alignment.
    """
    try:
        print(f"Starting spatial reconstruction for table {table_block['Id']}")
        
        # Extract all WORD blocks that belong to this table
        word_blocks = []
        
        def extract_words_from_cell(cell_block):
            """Recursively extract WORD blocks from a CELL block"""
            words = []
            if 'Relationships' in cell_block:
                for relationship in cell_block['Relationships']:
                    if relationship['Type'] == 'CHILD':
                        for child_id in relationship['Ids']:
                            child_block = blocks_map.get(child_id)
                            if child_block:
                                if child_block['BlockType'] == 'WORD':
                                    words.append(child_block)
                                elif child_block['BlockType'] == 'LINE':
                                    # Extract words from LINE blocks
                                    words.extend(extract_words_from_cell(child_block))
            return words
        
        # Get all cells in this table
        table_cells = []
        if 'Relationships' in table_block:
            for relationship in table_block['Relationships']:
                if relationship['Type'] == 'CHILD':
                    for cell_id in relationship['Ids']:
                        cell_block = blocks_map.get(cell_id)
                        if cell_block and cell_block['BlockType'] == 'CELL':
                            table_cells.append(cell_block)
                            # Extract words from this cell
                            cell_words = extract_words_from_cell(cell_block)
                            for word in cell_words:
                                word['parent_cell'] = cell_block
                            word_blocks.extend(cell_words)
        
        if not word_blocks:
            print(f"No WORD blocks found for table {table_block['Id']}")
            return None
        
        print(f"Found {len(word_blocks)} WORD blocks for spatial reconstruction")
        
        # Extract spatial coordinates for each word
        spatial_words = []
        for word_block in word_blocks:
            if 'Geometry' in word_block and 'BoundingBox' in word_block['Geometry']:
                bbox = word_block['Geometry']['BoundingBox']
                
                # Validate bounding box data
                if not all(isinstance(bbox.get(key), (int, float)) for key in ['Left', 'Top', 'Width', 'Height']):
                    print(f"Invalid bounding box data for word {word_block['Id']}, skipping")
                    continue
                
                spatial_word = {
                    'id': word_block['Id'],
                    'text': word_block.get('Text', ''),
                    'confidence': word_block.get('Confidence', 0),
                    'left': bbox['Left'],
                    'top': bbox['Top'],
                    'width': bbox['Width'],
                    'height': bbox['Height'],
                    'right': bbox['Left'] + bbox['Width'],
                    'bottom': bbox['Top'] + bbox['Height'],
                    'center_x': bbox['Left'] + bbox['Width'] / 2,
                    'center_y': bbox['Top'] + bbox['Height'] / 2,
                    'parent_cell': word_block.get('parent_cell')
                }
                spatial_words.append(spatial_word)
        
        if not spatial_words:
            print(f"No valid spatial coordinates found for table {table_block['Id']}")
            return None
        
        # Sort words by Y-coordinate (top to bottom) to identify rows
        spatial_words.sort(key=lambda w: w['top'])
        
        # Adaptive row tolerance based on document characteristics
        # Calculate average word height to determine appropriate tolerance
        avg_word_height = sum(w['height'] for w in spatial_words) / len(spatial_words)
        row_tolerance = max(0.005, min(0.02, avg_word_height * 0.5))  # Adaptive tolerance
        
        print(f"Using adaptive row tolerance: {row_tolerance:.4f} (avg word height: {avg_word_height:.4f})")
        
        # Group words into rows based on Y-coordinate proximity
        rows = []
        current_row = []
        
        for word in spatial_words:
            if not current_row:
                current_row = [word]
            else:
                # Check if this word belongs to the current row
                current_row_avg_y = sum(w['center_y'] for w in current_row) / len(current_row)
                if abs(word['center_y'] - current_row_avg_y) <= row_tolerance:
                    current_row.append(word)
                else:
                    # Start a new row
                    if current_row:
                        rows.append(current_row)
                    current_row = [word]
        
        # Add the last row
        if current_row:
            rows.append(current_row)
        
        print(f"Grouped words into {len(rows)} rows")
        
        # Validate minimum table structure
        if len(rows) < 1:
            print(f"Insufficient rows ({len(rows)}) for table reconstruction")
            return None
        
        # Sort words within each row by X-coordinate (left to right)
        for row in rows:
            row.sort(key=lambda w: w['left'])
        
        # Determine column boundaries by analyzing X-coordinates across all rows
        all_x_positions = []
        for row in rows:
            for word in row:
                all_x_positions.extend([word['left'], word['right']])
        
        # Remove duplicates and sort
        unique_x_positions = sorted(set(all_x_positions))
        
        # Adaptive boundary tolerance based on document width
        doc_width = max(unique_x_positions) - min(unique_x_positions) if unique_x_positions else 1.0
        boundary_tolerance = max(0.01, min(0.03, doc_width * 0.02))  # Adaptive tolerance
        
        print(f"Using adaptive boundary tolerance: {boundary_tolerance:.4f} (doc width: {doc_width:.4f})")
        
        # Group similar X positions to determine column boundaries
        column_boundaries = []
        
        for x_pos in unique_x_positions:
            # Check if this position is close to an existing boundary
            merged = False
            for i, boundary in enumerate(column_boundaries):
                if abs(x_pos - boundary) <= boundary_tolerance:
                    # Merge with existing boundary (take average)
                    column_boundaries[i] = (boundary + x_pos) / 2
                    merged = True
                    break
            
            if not merged:
                column_boundaries.append(x_pos)
        
        column_boundaries.sort()
        print(f"Detected {len(column_boundaries)} column boundaries")
        
        # Validate minimum column structure
        if len(column_boundaries) < 2:
            print(f"Insufficient column boundaries ({len(column_boundaries)}) for table reconstruction")
            return None
        
        # Create column ranges
        column_ranges = []
        for i in range(len(column_boundaries) - 1):
            column_ranges.append({
                'start': column_boundaries[i],
                'end': column_boundaries[i + 1],
                'center': (column_boundaries[i] + column_boundaries[i + 1]) / 2
            })
        
        # Assign words to columns based on their position
        def get_column_index(word):
            word_center = word['center_x']
            for i, col_range in enumerate(column_ranges):
                if col_range['start'] <= word_center <= col_range['end']:
                    return i
            # If not in any range, find the closest column
            closest_col = 0
            min_distance = float('inf')
            for i, col_range in enumerate(column_ranges):
                distance = min(abs(word_center - col_range['start']), abs(word_center - col_range['end']))
                if distance < min_distance:
                    min_distance = distance
                    closest_col = i
            return closest_col
        
        # Build the spatially reconstructed table
        reconstructed_table = {
            'table_id': table_block['Id'],
            'page_number': table_block.get('Page'),
            'spatial_reconstruction': True,
            'reconstruction_metadata': {
                'word_count': len(spatial_words),
                'row_tolerance': row_tolerance,
                'boundary_tolerance': boundary_tolerance,
                'avg_word_height': avg_word_height,
                'doc_width': doc_width
            },
            'row_count': len(rows),
            'column_count': len(column_ranges),
            'rows': []
        }
        
        for row_idx, row_words in enumerate(rows):
            # Create a grid for this row
            row_cells = [''] * len(column_ranges)
            row_confidences = [0.0] * len(column_ranges)
            
            # Group words by column
            column_words = {}
            for word in row_words:
                col_idx = get_column_index(word)
                if col_idx not in column_words:
                    column_words[col_idx] = []
                column_words[col_idx].append(word)
            
            # Combine words in each column
            for col_idx, words in column_words.items():
                if col_idx < len(row_cells):
                    # Sort words in column by X position for proper text order
                    words.sort(key=lambda w: w['left'])
                    combined_text = ' '.join(word['text'] for word in words)
                    avg_confidence = sum(word['confidence'] for word in words) / len(words)
                    
                    row_cells[col_idx] = combined_text.strip()
                    row_confidences[col_idx] = round(avg_confidence, 2)
            
            reconstructed_table['rows'].append({
                'row_index': row_idx + 1,
                'cells': [
                    {
                        'column_index': col_idx + 1,
                        'text': cell_text,
                        'confidence': row_confidences[col_idx]
                    }
                    for col_idx, cell_text in enumerate(row_cells)
                ]
            })
        
        print(f"Spatial reconstruction complete: {len(rows)} rows x {len(column_ranges)} columns")
        return reconstructed_table
        
    except Exception as e:
        print(f"Error during spatial reconstruction for table {table_block.get('Id', 'unknown')}: {str(e)}")
        traceback.print_exc()
        return None

# --- REWRITTEN Main Lambda Handler ---

def lambda_handler(event, context):
    print(f"Received SNS event: {json.dumps(event)}")
    
    job_id = None
    original_s3_object_key = None
    sns_status = None # Renamed to avoid conflict with webhook_payload status

    try:
        message = json.loads(event['Records'][0]['Sns']['Message'])
        job_id = message['JobId']
        sns_status = message['Status'] # Status from SNS message
        
        # Prioritize the actual S3ObjectName from DocumentLocation over JobTag
        # since JobTag might be malformed or truncated
        original_s3_object_key = None
        if 'DocumentLocation' in message and 'S3ObjectName' in message['DocumentLocation']:
            original_s3_object_key = message['DocumentLocation']['S3ObjectName']
            print(f"Using S3ObjectName from DocumentLocation: {original_s3_object_key}")
        elif message.get('JobTag'):
            original_s3_object_key = message.get('JobTag')
            print(f"Fallback to JobTag: {original_s3_object_key}")
        
        if not original_s3_object_key:
            # This case should be rare if JobTag is always set by the calling service
            original_s3_object_key = f"unknown_source_file_for_job_{job_id}"
            print(f"Warning: Original S3 key not found in JobTag or DocumentLocation. Using fallback: {original_s3_object_key}")

    except (KeyError, IndexError, TypeError) as e:
        error_msg = f"Error parsing SNS message: {str(e)}. Event: {json.dumps(event)}"
        print(error_msg)
        # Cannot reliably form a webhook payload if basic info is missing
        return {'statusCode': 400, 'body': json.dumps({'error': 'Invalid SNS message format'})}

    print(f"Textract JobId: {job_id}, SNS Status: {sns_status}, OriginalS3Key: {original_s3_object_key}")

    # Initialize webhook payload structure
    webhook_payload = {
        "s3Key": original_s3_object_key,
        "textractJobId": job_id,
        "status": None, # This will be 'processed' or 'failed' based on outcome
        "jsonS3Key": None,
        "jsonUrl": None,
        "csvS3Key": None,
        "csvUrl": None,
    }

    if sns_status != 'SUCCEEDED':
        error_msg_from_sns = message.get('StatusMessage', 'Textract job failed (reason not specified in SNS).')
        print(f"Textract job {job_id} did not succeed per SNS. Status: {sns_status}. Error: {error_msg_from_sns}")
        
        webhook_payload["status"] = "failed"
        webhook_payload["errorMessage"] = error_msg_from_sns
        
        _send_webhook(webhook_payload) # Call a helper to send webhook
        print(f"Prepared FAILED webhook payload (SNS status): {json.dumps(webhook_payload)}")
        # Return 200 so SNS doesn't retry for a definitive Textract job failure
        return {'statusCode': 200, 'body': json.dumps(webhook_payload)} 

    try:
        blocks = get_textract_results(job_id)
        if not blocks:
            no_content_msg = f"No blocks returned from Textract for job {job_id}"
            print(no_content_msg)
            webhook_payload["status"] = "failed" # Or a different status like "empty_content"
            webhook_payload["errorMessage"] = no_content_msg
            
            _send_webhook(webhook_payload)
            print(f"Prepared FAILED webhook payload (no blocks): {json.dumps(webhook_payload)}")
            return {'statusCode': 200, 'body': json.dumps(webhook_payload)}

        blocks_map = {block['Id']: block for block in blocks}

        # Derive base_name and sub_path for output files
        # Keep the original S3 key format intact for webhook payload
        file_name_part = os.path.basename(original_s3_object_key)
        base_name = os.path.splitext(file_name_part)[0]
        
        # For output files, create a cleaner structure by removing "uploads/" prefix
        # Example: "uploads/carrier-1/uuid123/document.pdf" -> "carrier-1/uuid123/document"
        clean_s3_key = original_s3_object_key
        if clean_s3_key.startswith('uploads/'):
            clean_s3_key = clean_s3_key[8:]  # Remove "uploads/" prefix (8 characters)
        
        # Remove the file extension from the cleaned key
        base_s3_key_without_extension = os.path.splitext(clean_s3_key)[0]
        
        print(f"DEBUG: Original S3 key: {original_s3_object_key}")
        print(f"DEBUG: Cleaned S3 key (no uploads/): {clean_s3_key}")
        print(f"DEBUG: Base S3 key without extension: {base_s3_key_without_extension}")
        print(f"DEBUG: OUTPUT_S3_PREFIX: {OUTPUT_S3_PREFIX}")

        # ---- Generate CSV ----
        csv_s3_key_val = None
        csv_data_rows = parse_tables_to_csv_data(blocks, blocks_map)
        if csv_data_rows:
            csv_buffer = io.StringIO()
            writer = csv.writer(csv_buffer)
            writer.writerows(csv_data_rows)
            csv_content = csv_buffer.getvalue()
            csv_buffer.close()
            
            # Use the processed/ prefix with the cleaned key structure
            csv_s3_key_val = f"{OUTPUT_S3_PREFIX}/{base_s3_key_without_extension}.csv"

            s3_client.put_object(Bucket=OUTPUT_S3_BUCKET, Key=csv_s3_key_val, Body=csv_content, ContentType='text/csv')
            print(f"CSV saved to s3://{OUTPUT_S3_BUCKET}/{csv_s3_key_val}")
            webhook_payload["csvS3Key"] = csv_s3_key_val
            webhook_payload["csvUrl"] = f"https://{OUTPUT_S3_BUCKET}.s3.amazonaws.com/{csv_s3_key_val}"
        else:
            print(f"No CSV data generated for job {job_id}.")

        # ---- Generate Structured JSON ----
        json_s3_key_val = None
        structured_json_data = parse_blocks_to_structured_json(blocks, blocks_map, original_s3_object_key, job_id)
        json_content = json.dumps(structured_json_data, indent=2)
        
        # Use the processed/ prefix with the cleaned key structure
        json_s3_key_val = f"{OUTPUT_S3_PREFIX}/{base_s3_key_without_extension}.json"

        s3_client.put_object(Bucket=OUTPUT_S3_BUCKET, Key=json_s3_key_val, Body=json_content, ContentType='application/json')
        print(f"Structured JSON saved to s3://{OUTPUT_S3_BUCKET}/{json_s3_key_val}")
        webhook_payload["jsonS3Key"] = json_s3_key_val
        webhook_payload["jsonUrl"] = f"https://{OUTPUT_S3_BUCKET}.s3.amazonaws.com/{json_s3_key_val}"

        # Final success status for webhook
        webhook_payload["status"] = "processed"
        
        _send_webhook(webhook_payload)
        print(f"Prepared SUCCEEDED webhook payload: {json.dumps(webhook_payload)}")
        # The Lambda's return body is for AWS, the webhook_payload is for your app
        return {
            'statusCode': 200,
            'body': json.dumps(webhook_payload) # Return the webhook payload for easier debugging/logging from Lambda invoke
        }

    except Exception as e:
        processing_error_msg = f"Error during Lambda processing for job {job_id}: {str(e)}"
        print(processing_error_msg)
        traceback.print_exc()
        
        webhook_payload["status"] = "failed"
        webhook_payload["errorMessage"] = processing_error_msg
        
        _send_webhook(webhook_payload)
        print(f"Prepared FAILED webhook payload (processing exception): {json.dumps(webhook_payload)}")
        # Return 500 for internal Lambda errors, distinct from Textract job failures handled as 200
        return {
            'statusCode': 500, 
            'body': json.dumps(webhook_payload)
        }

# Optional helper function to actually send the webhook
def _send_webhook(payload):
    print(">>>> DEBUG: ENTERED _send_webhook function <<<<")
    if not WEBHOOK_URL:
        print("WEBHOOK_URL not configured. Skipping webhook call.")
        return

    # Remove null values from payload to avoid validation issues
    clean_payload = {k: v for k, v in payload.items() if v is not None}
    
    headers = {'Content-Type': 'application/json'}
    if WEBHOOK_SECRET:
        headers['x-webhook-secret'] = WEBHOOK_SECRET
    
    try:
        response = requests.post(WEBHOOK_URL, json=clean_payload, headers=headers, timeout=10)
        response.raise_for_status() # Raises an HTTPError for bad responses (4XX or 5XX)
        print(f"Webhook sent successfully to {WEBHOOK_URL}. Status: {response.status_code}")
        print(f"Clean payload sent: {json.dumps(clean_payload)}")
    except requests.exceptions.RequestException as e:
        print(f"Error sending webhook to {WEBHOOK_URL}: {str(e)}")
        print(f"Payload that failed: {json.dumps(clean_payload)}")
        # Try to get more details about the error
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_details = e.response.text
                print(f"Server response: {error_details}")
            except:
                print("Could not read server response details")