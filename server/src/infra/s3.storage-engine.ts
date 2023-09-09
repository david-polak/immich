import e from 'express';
import { Client, UploadedObjectInfo } from 'minio';
import { StorageEngine } from 'multer';

const S3_BUCKET = process.env.S3_BUCKET || '';
const S3_HOSTNAME = process.env.S3_HOSTNAME || '';
const S3_PORT = parseInt(process.env.S3_PORT || '443');
const S3_USE_SSL = process.env.S3_USE_SSL === 'true';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';

export class S3StorageEngine implements StorageEngine {
  protected client: Client;
  protected bucket: string;

  constructor() {
    this.client = new Client({
      endPoint: S3_HOSTNAME,
      port: S3_PORT,
      useSSL: S3_USE_SSL,
      accessKey: S3_ACCESS_KEY,
      secretKey: S3_SECRET_KEY,
    });
    this.bucket = S3_BUCKET;
  }

  _handleFile(
    req: e.Request,
    file: Express.Multer.File,
    callback: (error?: any, info?: Partial<Express.Multer.File>) => void,
  ): void {
    this.client
      .putObject(this.bucket, file.filename, file.stream)
      .then(() => {
        callback(null, {
          filename: file.filename,
        });
      })
      .catch((error) => callback(error));
  }

  _removeFile(req: e.Request, file: Express.Multer.File, callback: (error: Error | null) => void): void {
    this.client
      .removeObjects(this.bucket, [file.filename])
      .then(() => callback(null))
      .catch((error) => callback(error));
  }
}
