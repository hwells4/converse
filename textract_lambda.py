import boto3
import os
import json
import urllib.parse

# TASK 17 IMPLEMENTATION NOTE:
# This lambda (textract_lambda.py) STARTS Textract jobs when files are uploaded to S3.
# The spatial reconstruction implementation for Task 17 is in lambda.py (result processor).
# 
# Architecture:
# 1. File uploaded to S3 -> triggers this lambda -> starts Textract job
# 2. Textract job completes -> SNS notification -> triggers lambda.py 
# 3. lambda.py processes results with spatial reconstruction (Task 17)
#
# The spatial coordinate-based reconstruction happens in lambda.py in the function:
# reconstruct_table_structure_spatially()

textract_client = boto3.client('textract', region_name='us-east-2') # Keep explicit region

SNS_TOPIC_ARN = os.environ['SNS_TOPIC_ARN']
TEXTRACT_ROLE_ARN = os.environ['TEXTRACT_ROLE_ARN']

def lambda_handler(event, context):
    print(f"Received event: {json.dumps(event)}")

    bucket_name = event.get('bucket')
    object_key = event.get('key')

    if not bucket_name or not object_key:
        print("Error: 'bucket' and 'key' must be provided in the event.")
        return {
            'statusCode': 400,
            'body': json.dumps({'error': "'bucket' and 'key' must be provided in the event."})
        }

    print(f"Processing S3 object: s3://{bucket_name}/{object_key}")

    if not object_key.lower().endswith('.pdf'):
        print(f"Object {object_key} is not a PDF. Assuming PDF for Textract.")

    job_tag = object_key.replace('/', '--')[:64]

    # For verification, you can keep these debug prints for one more run
    notification_channel_params = {
        'SNSTopicArn': SNS_TOPIC_ARN,
        'RoleArn': TEXTRACT_ROLE_ARN
    }
    document_location_params = {
        'S3Object': {
            'Bucket': bucket_name,
            'Name': object_key
        }
    }
    print(f"DEBUG: SNS_TOPIC_ARN from env: '{SNS_TOPIC_ARN}'")
    print(f"DEBUG: TEXTRACT_ROLE_ARN from env: '{TEXTRACT_ROLE_ARN}'")
    print(f"DEBUG: Constructed NotificationChannel: {json.dumps(notification_channel_params)}")
    print(f"DEBUG: Constructed DocumentLocation: {json.dumps(document_location_params)}")

    try:
        response = textract_client.start_document_analysis(
            DocumentLocation=document_location_params,
            FeatureTypes=['TABLES', 'FORMS'],
            NotificationChannel=notification_channel_params, # RE-ENABLED
            JobTag=job_tag
        )
        job_id = response['JobId']
        print(f"Started Textract job with ID: {job_id} for S3 object: s3://{bucket_name}/{object_key}")
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Textract job started successfully.',
                'jobId': job_id,
                'bucket': bucket_name,
                'key': object_key
            })
        }
    except Exception as e:
        print(f"Error starting Textract job for {object_key}: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': f"Error starting Textract job: {str(e)}"})
        }