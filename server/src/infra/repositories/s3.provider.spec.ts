import { IStorageRepository } from '@app/domain';
import { S3Provider } from '@app/infra/repositories/s3.provider';
import { uuidStub } from '@test';
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

  const base = new Date(Date.now()).toISOString();

  beforeAll(async () => {
    // create a base test directory
    await client.putObject(S3_BUCKET, `${base}/`, '', 0);
  });

  afterAll(async () => {
    // remove all objects form the base test directory
    const objects: string[] = [];
    await new Promise<string[]>((resolve, reject) => {
      const stream = client.listObjectsV2(S3_BUCKET, `${base}/`, true);
      stream.on('data', (item) => item.name && objects.push(item.name));
      stream.on('end', () => client.removeObjects(S3_BUCKET, objects));
      stream.on('error', reject);
    });
  });

  const objectExists = async (object: string): Promise<boolean> => {
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

  const putObject = async (
    objectName: string,
    file: boolean = false,
    contents: string | undefined = undefined,
  ): Promise<UploadedObjectInfo> => {
    if (file) {
      let data: Buffer;
      if (contents) {
        data = Buffer.from(contents);
      } else {
        data = Buffer.from(v4());
      }
      return client.putObject(S3_BUCKET, objectName, data);
    } else {
      return client.putObject(S3_BUCKET, objectName, '', 0);
    }
  };

  describe(provider.mkdir.name, () => {
    it('creates a single directory', async () => {
      const dir = `${base}/${v4()}/`;
      await provider.mkdir(dir);
      await expect(objectExists(dir)).resolves.toBe(true);
    });

    it('creates nested directories', async () => {
      const dir = `${base}/${v4()}/${v4()}/${v4()}/${v4()}/`;
      await provider.mkdir(dir);
      await expect(objectExists(dir)).resolves.toBe(true);
    });

    it('handles missing trailing slash', async () => {
      const dir = `${base}/${v4()}`;
      await provider.mkdir(dir);
      await expect(objectExists(`${dir}/`)).resolves.toBe(true);
    });
  });

  describe(provider.readdir.name, () => {
    it('reads directory', async () => {
      const dir = `${base}/${v4()}/`;
      const fileA = v4();
      const fileB = v4();
      await putObject(dir);
      await putObject(`${dir}${fileA}`, true);
      await putObject(`${dir}${fileB}`, true);
      const expected = [fileA, fileB].sort();
      await expect(provider.readdir(dir)).resolves.toEqual(expected);
    });

    it('handles missing backslash', async () => {
      const dir = `${base}/${v4()}`;
      const fileA = v4();
      const fileB = v4();
      await putObject(dir);
      await putObject(`${dir}/${fileA}`, true);
      await putObject(`${dir}/${fileB}`, true);
      const expected = [fileA, fileB].sort();
      await expect(provider.readdir(dir)).resolves.toEqual(expected);
    });
  });

  describe(provider.unlink.name, () => {
    it('removes a file', async () => {
      const file = v4();
      const path = `${base}/${file}`;
      await putObject(path, true);
      await expect(objectExists(path)).resolves.toBe(true);
      await provider.unlink(path);
      await expect(objectExists(path)).resolves.toBe(false);
    });
  });

  describe(provider.unlinkDir.name, () => {
    it('removes an empty directory', async () => {});
  });
});
