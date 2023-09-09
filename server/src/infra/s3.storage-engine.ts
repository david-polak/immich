import { AuthRequest } from '@app/immich/app.guard';
import { Client } from 'minio';
import { DiskStorageOptions, StorageEngine } from 'multer';

const S3_BUCKET = process.env.S3_BUCKET || '';
const S3_HOSTNAME = process.env.S3_HOSTNAME || '';
const S3_PORT = parseInt(process.env.S3_PORT || '443');
const S3_USE_SSL = process.env.S3_USE_SSL === 'true';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';

type DiskStorageCallback = (error: Error | null, result: string) => void;

export class S3StorageEngine implements StorageEngine {
  protected client: Client;
  protected bucket: string;

  protected destination: (req: AuthRequest, file: Express.Multer.File, callback: DiskStorageCallback) => void;
  protected filename: (req: AuthRequest, file: Express.Multer.File, callback: DiskStorageCallback) => void;

  constructor(options: DiskStorageOptions) {
    if (!options.destination) {
      throw Error('options.destination is not defined');
    }
    if (typeof options.destination === 'string') {
      throw Error('options.destination of type string is not supported');
    }
    if (!options.filename) {
      throw Error('options.filename is not defined');
    }

    this.destination = options.destination;
    this.filename = options.filename;

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
    req: AuthRequest,
    file: Express.Multer.File,
    callback: (error?: any, info?: Partial<Express.Multer.File>) => void,
  ): void {
    this.destination(req, file, (err: any, destination: string) => {
      if (err) {
        return callback(err);
      }
      this.filename(req, file, (err: any, filename: string) => {
        if (err) {
          return callback(err);
        }

        const path = `${destination}/${filename}`;
        this.client
          .putObject(this.bucket, path, file.stream)
          .then(() => {
            console.log('putObject.then', file, file.stream);
            const info: Partial<Express.Multer.File> = {
              filename: filename,
              destination: destination,
              path: path,
            };
            callback(null, info);
          })
          .catch((error) => callback(error));
      });
    });
  }

  _removeFile(req: AuthRequest, file: Express.Multer.File, callback: (error: Error | null) => void): void {
    console.log('_removeFIle');
    this.client
      .removeObjects(this.bucket, [file.filename])
      .then(() => callback(null))
      .catch((error) => callback(error));
  }
}
