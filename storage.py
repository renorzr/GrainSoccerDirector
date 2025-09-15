import dotenv
dotenv.load_dotenv()

import os
import alibabacloud_oss_v2 as oss

cfg = oss.config.load_default()
cfg.credentials_provider = oss.credentials.EnvironmentVariableCredentialsProvider()
cfg.region = os.getenv('OSS_REGION')

client = oss.Client(cfg)
bucket = os.getenv('OSS_BUCKET')
url_expiration = os.getenv('OSS_URL_EXPIRATION', 12 * 3600)

def list_objects(prefix: str = ''):
    paginator = client.list_objects_v2_paginator()
    objects = []
    for page in paginator.iter_page(oss.ListObjectsV2Request(
            bucket=bucket,
            prefix=prefix
        )
    ):
        if hasattr(page, 'contents') and page.contents:
            for o in page.contents:
                objects.append(o)
    return objects

def get_object_url(key: str):
    return client.presign(oss.GetObjectRequest(bucket=bucket, key=key, content_type='application/octet-stream'), ExpiresIn=url_expiration).url

def get_upload_url(key: str):
    return client.presign(oss.PutObjectRequest(bucket=bucket, key=key, content_type='application/octet-stream'), ExpiresIn=url_expiration).url

def delete_object(key: str):
    return client.delete_object(bucket=bucket, key=key)
