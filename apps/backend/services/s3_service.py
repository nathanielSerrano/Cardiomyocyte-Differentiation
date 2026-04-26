"""
This module provides a service for interacting with Amazon S3, allowing for uploading and downloading files. 
It uses the `boto3` library to interface with AWS S3 and includes error handling to manage potential issues during file operations.
"""
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config  # <-- 1. Import this!
import logging

class S3Service:
    def __init__(self, bucket_name):
        self.bucket_name = bucket_name
        self.s3_client = boto3.client(
            's3',
            region_name="us-east-2", # Ensure your region is correct
            config=Config(signature_version='s3v4')           # <-- THE MAGIC FIX
        )
    
    def upload_file(self, file_path, s3_key):
        """
        Uploads a file to an S3 bucket.
        :param file_path: Local path to the file to be uploaded
        :param s3_key: The key (path) in the S3 bucket where the file will be stored
        :return: True if file was uploaded, else False
        """
        try:
            # s3_key = "users/{user_id}/uploads/{filename}"  # Example key structure
            self.s3_client.upload_file(file_path, self.bucket_name, s3_key)
            logging.info(f"File '{file_path}' uploaded to S3 bucket '{self.bucket_name}' with key '{s3_key}'")
            return True
        except ClientError as e:
            logging.error(e)
            return False
    
    def download_file(self, s3_key, file_path):
        """
        Downloads a file from an S3 bucket.
        :param s3_key: The key (path) in the S3 bucket where the file is stored
        :param file_path: Local path where the downloaded file will be saved
        :return: True if file was downloaded, else False
        """
        try:
            self.s3_client.download_file(self.bucket_name, s3_key, file_path)
            logging.info(f"File with key '{s3_key}' downloaded from S3 bucket '{self.bucket_name}' to '{file_path}'")
            return True
        except ClientError as e:
            logging.error(e)
            return False
        
    def generate_presigned_upload_url(self, s3_key, expiration=3600):
        """
        Generates a pre-signed URL for uploading a file to S3.
        :param s3_key: The key (path) in the S3 bucket where the file will be stored
        :param expiration: Time in seconds for the pre-signed URL to remain valid
        :return: Pre-signed URL as a string, or None if error occurs
        """
        try:
            response = self.s3_client.generate_presigned_url('put_object',
                                                             Params={'Bucket': self.bucket_name, 'Key': s3_key},
                                                             ExpiresIn=expiration)
            logging.info(f"Generated pre-signed URL for key '{s3_key}' in bucket '{self.bucket_name}'")
            return response
        except ClientError as e:
            logging.error(e)
            return None
        
    def generate_presigned_download_url(self, s3_key: str, expiration=3600):
        """Generates a presigned URL to share/read an S3 object"""
        try:
            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': s3_key},
                ExpiresIn=expiration
            )
        except ClientError as e:
            print(e)
            return None
        return response