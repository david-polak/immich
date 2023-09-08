import { IStorageRepository } from '@app/domain';
import { S3Provider } from '@app/infra/repositories/s3.provider';
import { uuidStub } from '@test';
import fs from 'fs/promises';
import { BucketItem, BucketStream, Client, UploadedObjectInfo } from 'minio';
import { v4 } from 'uuid';

class S3ProviderMock extends S3Provider implements IStorageRepository {
  setRemote(client: Client, bucket: string) {
    this.client = client;
    this.bucket = bucket;
  }
  mockClient(fn: any) {
    fn(this.client);
  }
  getClient(): Client {
    return this.client;
  }
}

describe(S3Provider.name, () => {
  let provider: S3ProviderMock = new S3ProviderMock();
  beforeEach(() => {
    provider = new S3ProviderMock();
  });
  afterEach(() => {});

  describe(provider.mkdir.name, () => {
    it('creates a directory', () => {
      provider.mockClient((client: Client) => {
        jest
          .spyOn(client, 'putObject')
          .mockReturnValue(Promise.resolve({ etag: 'dsdgsdg', versionId: null } as UploadedObjectInfo));
      });
      provider.mkdir('create/1/directory/');
    });
  });
});

describe(`${S3Provider.name} functional tests`, () => {
  const S3_BUCKET = process.env.S3_BUCKET || '';
  const S3_HOSTNAME = process.env.S3_HOSTNAME || '';
  const S3_PORT = parseInt(process.env.S3_PORT || '443');
  const S3_USE_SSL = process.env.S3_USE_SSL === 'true';
  const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
  const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';
  const client: Client = new Client({
    endPoint: S3_HOSTNAME,
    port: S3_PORT,
    useSSL: S3_USE_SSL,
    accessKey: S3_ACCESS_KEY,
    secretKey: S3_SECRET_KEY,
  });

  const provider: S3ProviderMock = new S3ProviderMock();
  provider.setRemote(client, S3_BUCKET);

  const join = (...paths: string[]) => {
    return paths.join('/');
  };

  const baseDir = new Date(Date.now()).toISOString();

  beforeAll(async () => {
    // create a base test directory
    await client.putObject(S3_BUCKET, `${baseDir}/`, '', 0);
  });

  afterAll(async () => {
    // remove all objects form the base test directory
    const objects: string[] = [];
    await new Promise<string[]>((resolve, reject) => {
      const stream = client.listObjectsV2(S3_BUCKET, `${baseDir}/`, true);
      stream.on('data', (item) => item.name && objects.push(item.name));
      stream.on('end', () => client.removeObjects(S3_BUCKET, objects));
      stream.on('error', reject);
    });
  });

  const dirExists = async (dir: string): Promise<boolean> => {
    const prefix = dir.endsWith('/') ? dir : `${dir}/`;
    return new Promise<boolean>((resolve, reject) => {
      let dirFound = false;
      const stream = client.listObjectsV2(S3_BUCKET, prefix, false);
      stream.on('error', reject);
      stream.on('end', () => resolve(dirFound));
      stream.on('data', (item: any) => {
        if (item.name === prefix) {
          dirFound = true;
        }
      });
    });
  };

  const fileExists = async (object: string): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
      let objectFound = false;
      const stream = client.listObjectsV2(S3_BUCKET, object, false);
      stream.on('error', reject);
      stream.on('end', () => resolve(objectFound));
      stream.on('data', (item: any) => {
        if (item.name == object) {
          objectFound = true;
        }
      });
    });
  };

  const createDirectory = async (dir: string): Promise<UploadedObjectInfo> => {
    return client.putObject(S3_BUCKET, dir, '', 0);
  };

  const createFile = async (
    filepath: string,
    contents: string | undefined = undefined,
  ): Promise<UploadedObjectInfo> => {
    let data: Buffer;
    if (contents) {
      data = Buffer.from(contents);
    } else {
      data = Buffer.from(v4());
    }
    return client.putObject(S3_BUCKET, filepath, data);
  };

  describe(provider.mkdir.name, () => {
    it('creates a single directory', async () => {
      const dir = join(baseDir, v4());
      await provider.mkdir(dir);
      await expect(dirExists(dir)).resolves.toBe(true);
    });

    it('creates nested directories', async () => {
      const dir = join(baseDir, v4(), v4(), v4(), v4(), v4());
      await provider.mkdir(dir);
      await expect(dirExists(dir)).resolves.toBe(true);
    });

    it('handles missing trailing slash', async () => {
      const dir = join(baseDir, v4());
      await provider.mkdir(dir);
      await expect(dirExists(dir)).resolves.toBe(true);
    });
  });

  describe(provider.readdir.name, () => {
    it('reads directory', async () => {
      const dir = join(baseDir, v4());
      const fileA = v4();
      const fileB = v4();
      await createDirectory(dir);
      await createFile(join(dir, fileA));
      await createFile(join(dir, fileB));
      const expected = [fileA, fileB].sort();
      await expect(provider.readdir(dir)).resolves.toEqual(expected);
    });
  });

  describe(provider.unlink.name, () => {
    it('removes a file', async () => {
      const file = v4();
      const path = join(baseDir, file);
      await createFile(path);
      await expect(fileExists(path)).resolves.toBe(true);
      await provider.unlink(path);
      await expect(fileExists(path)).resolves.toBe(false);
    });
  });

  describe(provider.unlinkDir.name, () => {
    it('removes an empty directory', async () => {
      const dir = join(baseDir, v4());
      await createDirectory(dir);
      await expect(dirExists(dir)).resolves.toBe(true);
      await provider.unlinkDir(dir, { recursive: true });
      await expect(dirExists(dir)).resolves.toBe(false);
    });

    it('removes a directory', async () => {
      const dir = join(baseDir, v4());
      const file = join(dir, v4());
      await createDirectory(dir);
      await createFile(file);
      await expect(dirExists(dir)).resolves.toBe(true);
      await expect(fileExists(file)).resolves.toBe(true);

      await provider.unlinkDir(dir, { recursive: true });
      await expect(dirExists(dir)).resolves.toBe(false);
      await expect(fileExists(file)).resolves.toBe(false);
    });

    it('removes nested directories', async () => {
      const dirA = join(baseDir, v4());
      const dirB = join(dirA, v4());
      const file = join(dirB, v4());
      await createDirectory(dirA);
      await createDirectory(dirB);
      await createFile(file);
      await expect(dirExists(dirA)).resolves.toBe(true);
      await expect(dirExists(dirB)).resolves.toBe(true);
      await expect(fileExists(file)).resolves.toBe(true);

      await provider.unlinkDir(dirA, { recursive: true });
      await expect(dirExists(dirA)).resolves.toBe(false);
      await expect(dirExists(dirB)).resolves.toBe(false);
      await expect(fileExists(file)).resolves.toBe(false);
    });
  });
});
