import { DiskUsage, ImmichReadStream, ImmichZipStream, IStorageRepository } from '@app/domain';
import archiver from 'archiver';
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

  /**
   * Disk Usage is not supported on S3, defaulting to 1TiB.
   *
   * TODO: Update web to hide disk usage when S3 is enabled.
   */
  async checkDiskUsage(folder: string): Promise<DiskUsage> {
    return Promise.resolve({
      available: 1099511627776,
      free: 1099511627776,
      total: 1099511627776,
    });
  }

  async checkFileExists(filepath: string, mode?: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.client
        .statObject(this.bucket, filepath)
        .then(() => resolve(true))
        .catch(() => resolve(false));
    });
  }

  async createReadStream(filepath: string, mimeType?: string | null): Promise<ImmichReadStream> {
    const stat = await this.client.statObject(this.bucket, filepath);
    return new Promise<ImmichReadStream>((resolve, reject) => {
      this.client
        .getObject(this.bucket, filepath)
        .then((stream) =>
          resolve({
            stream: stream,
            length: stat.size,
            type: mimeType || undefined,
          }),
        )
        .catch(reject);
    });
  }

  async createZipStream(): Promise<ImmichZipStream> {
    const archive = archiver('zip', { store: true });
    const promises: Promise<void>[] = [];

    const addFile = (input: string, filename: string) => {
      promises.push(
        new Promise<void>((resolve, reject) => {
          this.client
            .getObject(this.bucket, input)
            .then((stream) => {
              archive.append(stream, { name: filename });
              resolve();
            })
            .catch(reject);
        }),
      );
    };

    const finalize = async (): Promise<void> => {
      await Promise.all(promises);
      await archive.finalize();
    };

    return Promise.resolve({ stream: archive, addFile, finalize });
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
    // TODO: ---------------------------------------------------------------------
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
