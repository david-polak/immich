import { DiskUsage, ImmichReadStream, ImmichZipStream, IStorageRepository } from '@app/domain';
import { BucketItem, BucketStream, Client, CopyConditions, UploadedObjectInfo } from 'minio';
import { Readable } from 'stream';

const S3_BUCKET = process.env.S3_BUCKET || '';
const S3_HOSTNAME = process.env.S3_HOSTNAME || '';
const S3_PORT = parseInt(process.env.S3_PORT || '443');
const S3_USE_SSL = process.env.S3_USE_SSL === 'true';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';

export class S3Provider implements IStorageRepository {
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

  async checkDiskUsage(folder: string): Promise<DiskUsage> {
    return Promise.resolve({
      available: 1000,
      free: 1000,
      total: 1000,
    });
  }

  async checkFileExists(filepath: string, mode?: number): Promise<boolean> {
    return Promise.resolve(false);
  }

  async createReadStream(filepath: string, mimeType?: string | null): Promise<ImmichReadStream> {
    return Promise.resolve({
      stream: new Readable(),
    });
  }

  createZipStream(): ImmichZipStream {
    return {
      stream: new Readable(),
      addFile: () => {},
      finalize: () => {
        return Promise.resolve();
      },
    };
  }

  async mkdir(filepath: string): Promise<void> {
    const objectName = filepath.endsWith('/') ? filepath : `${filepath}/`;
    await this.client.putObject(this.bucket, objectName, '', 0);
  }

  async moveFile(source: string, target: string): Promise<void> {
    // bucket prefix is required for the source
    const prefixedSource = `${this.bucket}/${source}`;

    if (await this.checkFileExists(target)) {
      throw new Error(`Can not move ${source} to ${target}. ${target} already exists`);
    }

    return new Promise((resolve, reject) => {
      this.client
        .copyObject(this.bucket, target, prefixedSource, new CopyConditions())
        .then(() => {
          this.unlink(source)
            .then(() => resolve())
            .catch(reject);
        })
        .catch(reject);
    });
  }

  async readdir(folder: string): Promise<string[]> {
    const prefix = folder.endsWith('/') ? folder : `${folder}/`;
    const prefixLength = prefix.length;
    return new Promise<string[]>((resolve, reject) => {
      const data: string[] = [];
      const stream: BucketStream<BucketItem> = this.client.listObjectsV2(this.bucket, prefix, false);
      stream.on('error', reject);
      stream.on('end', () => resolve(data));
      stream.on('data', (item) => {
        if (!item.name) {
          return;
        }
        if (item.name === prefix) {
          return;
        }
        data.push(item.name.substring(prefixLength));
      });
    });
  }

  async removeEmptyDirs(folder: string): Promise<void> {
    return Promise.resolve(undefined);
  }

  async unlink(filepath: string): Promise<void> {
    return this.client.removeObjects(this.bucket, [filepath]);
  }

  async unlinkDir(folder: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    const prefix = folder.endsWith('/') ? folder : `${folder}/`;
    return new Promise<void>((resolve, reject) => {
      const data: string[] = [];
      const stream: BucketStream<BucketItem> = this.client.listObjectsV2(this.bucket, prefix, true);
      stream.on('error', reject);
      stream.on('data', (item) => {
        if (!item.name) {
          return;
        }
        data.push(item.name);
      });
      stream.on('end', () => {
        this.client.removeObjects(this.bucket, data).then(resolve).catch(reject);
      });
    });
  }
}
