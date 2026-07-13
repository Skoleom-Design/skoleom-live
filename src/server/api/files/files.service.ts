import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const LOCAL_BASE_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;

@Injectable()
export class FilesService {
  private s3: S3Client | null = null;
  private bucket: string;

  constructor() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3 = new S3Client({
        region: process.env.AWS_REGION || 'eu-west-3',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    }
    this.bucket = process.env.S3_BUCKET_NAME || 'skoleom-live';
  }

  async getUploadUrl(
    folder: 'posts' | 'capsules' | 'avatars',
    mimeType: string,
    extension: string,
  ): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
    const key = `${folder}/${uuidv4()}.${extension}`;

    if (!this.s3) {
      return {
        uploadUrl: `${LOCAL_BASE_URL}/api/files/local-upload/${key}`,
        fileUrl: `${LOCAL_BASE_URL}/uploads/${key}`,
        key,
      };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    const fileUrl = `https://${process.env.S3_BUCKET_DOMAIN}/${key}`;

    return { uploadUrl, fileUrl, key };
  }

  saveLocalFile(key: string, data: Buffer): void {
    const dest = path.join(UPLOADS_DIR, key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.s3) {
      const dest = path.join(UPLOADS_DIR, key);
      fs.rmSync(dest, { force: true });
      return;
    }
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
