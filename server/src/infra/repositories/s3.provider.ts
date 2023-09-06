import { DiskUsage, ImmichReadStream, ImmichZipStream, IStorageRepository } from '@app/domain';
import { Client, UploadedObjectInfo } from 'minio';
import { Readable } from "stream";

const S3_BUCKET = process.env.S3_BUCKET || "";
const S3_HOSTNAME = process.env.S3_HOSTNAME || "";
const S3_PORT = parseInt(process.env.S3_PORT || "443");
const S3_USE_SSL = process.env.S3_USE_SSL === 'true';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || "";

export class S3Provider implements IStorageRepository {
  protected client: Client;
  protected bucket: string;

  constructor() {
    this.client = new Client({
      endPoint: S3_HOSTNAME,
      port: S3_PORT,
      useSSL: S3_USE_SSL,
      accessKey: S3_ACCESS_KEY,
      secretKey: S3_SECRET_KEY
    })
    this.bucket = S3_BUCKET;
  }

  checkDiskUsage(folder: string): Promise<DiskUsage> {
    return Promise.resolve({
        available: 1000,
        free: 1000,
        total: 1000,
    });
  }

  checkFileExists(filepath: string, mode?: number): Promise<boolean> {
    return Promise.resolve(false);
  }

  createReadStream(filepath: string, mimeType?: string | null): Promise<ImmichReadStream> {
    return Promise.resolve({
      stream: new Readable()
    });
  }

  createZipStream(): ImmichZipStream {
    return {
      stream: new Readable(),
      addFile: () => {},
      finalize: () => { return Promise.resolve()}
    };
  }

  async mkdir(filepath: string): Promise<void> {
    await this.client.putObject(this.bucket, filepath, "", 0)
  }

  moveFile(source: string, target: string): Promise<void> {
    return Promise.resolve(undefined);
  }

  readdir(folder: string): Promise<string[]> {
    return Promise.resolve([]);
  }

  removeEmptyDirs(folder: string): Promise<void> {
    return Promise.resolve(undefined);
  }

  unlink(filepath: string): Promise<void> {
    return Promise.resolve(undefined);
  }

  unlinkDir(folder: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    return Promise.resolve(undefined);
  }

}
