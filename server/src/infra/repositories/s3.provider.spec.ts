import { IStorageRepository } from '@app/domain';
import { S3Provider } from '@app/infra/repositories/s3.provider';
import { Client, UploadedObjectInfo } from 'minio';

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

    it('creates a directory 2', async () => {
      await provider.mkdir('test/empty/');
      await provider.mkdir('test/notempty/');
      // await provider.mkdir("create/2/directory/")
    });
  });

  describe(provider.readdir.name, () => {
    it('reads dir', async () => {
      let data = await provider.readdir('create/');
      console.log(data);
    });
  });

  describe(provider.unlink.name, () => {
    it('removes a single file', async () => {
      await provider.unlink('create/setup');
    });
  });

  describe(provider.unlinkDir.name, () => {
    it('removes an empty directory', async () => {
      await provider.unlinkDir('test/notempty/');
      console.log('here');
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

  describe(provider.mkdir.name, () => {
    it('creates a directory', () => {});

    it('creates a directory 2', async () => {});
  });

  describe(provider.readdir.name, () => {
    it('reads dir', async () => {});
  });

  describe(provider.unlink.name, () => {
    it('removes a single file', async () => {});
  });

  describe(provider.unlinkDir.name, () => {
    it('removes an empty directory', async () => {});
  });
});
