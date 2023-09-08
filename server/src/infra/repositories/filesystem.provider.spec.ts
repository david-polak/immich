import { FilesystemProvider } from '@app/infra/repositories/filesystem.provider';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 } from 'uuid';

describe(`${FilesystemProvider.name}`, () => {
  const baseDir = join(tmpdir(), new Date(Date.now()).toISOString());
  const provider = new FilesystemProvider();

  beforeAll(async () => {
    await fs.mkdir(baseDir);
  });

  afterAll(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  const dirExists = async (dir: string): Promise<boolean> => {
    try {
      const stats = await fs.stat(dir);
      return Promise.resolve(stats.isDirectory());
    } catch (e) {
      return Promise.resolve(false);
    }
  };

  const fileExists = async (filepath: string): Promise<boolean> => {
    try {
      const stats = await fs.stat(filepath);
      return Promise.resolve(stats.isFile());
    } catch (e) {
      return Promise.resolve(false);
    }
  };

  const createFile = async (filepath: string, contents: string | undefined = undefined): Promise<void> => {
    let data: Buffer;
    if (contents) {
      data = Buffer.from(contents);
    } else {
      data = Buffer.from(v4());
    }
    return fs.writeFile(filepath, data);
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
  });

  describe(provider.readdir.name, () => {
    it('reads directory', async () => {
      const dir = join(baseDir, v4());
      const fileA = v4();
      const fileB = v4();
      await fs.mkdir(dir);
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
});
