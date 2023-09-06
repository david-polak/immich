import { IStorageRepository } from "@app/domain";
import { Client, UploadedObjectInfo } from 'minio';
import { S3Provider } from "@app/infra/repositories/s3.provider";

class S3ProviderMock extends S3Provider implements IStorageRepository {
  mockClient(fn: any) {
    fn(this.client)
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
  afterEach(() => {})

  describe(provider.mkdir.name, () => {

    it('creates a directory', () => {
      provider.mockClient((client: Client) => {
        jest.spyOn(client, 'putObject').mockReturnValue(
          Promise.resolve({ etag: "dsdgsdg", versionId: null } as UploadedObjectInfo))
      })
      provider.mkdir("create/1/directory/")
    })

    it('creates a directory 2', () => {
      provider.mkdir("create/2/directory/")
    })

  })

  describe(provider.readdir.name, () => {
    it('reads dir', async () => {
      let data = await provider.readdir("create/")
      console.log(data)
    })
  })


})
