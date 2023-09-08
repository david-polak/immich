import { FilesystemProvider } from '@app/infra/repositories/filesystem.provider';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
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

  const createDirectory = async (dir: string): Promise<string | void> => {
    return fs.mkdir(dir, { recursive: true });
  };

  const createFile = async (filepath: string, content: string | undefined = undefined): Promise<void> => {
    let data: Buffer;
    if (content) {
      data = Buffer.from(content);
    } else {
      data = Buffer.from(v4());
    }
    return fs.writeFile(filepath, data);
  };

  const validateStream = async (expected: string, stream: Readable): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
      let data: Buffer = new Buffer('');
      stream.on('data', (chunk: Buffer) => {
        data = Buffer.concat([data, chunk]);
      });
      stream.on('end', () => {
        resolve(data.toString() === expected);
      });
      stream.on('error', reject);
    });
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

    it('rejects on non-existent file', async () => {
      const path = join(baseDir, v4());
      await expect(provider.unlink(path)).rejects.toThrow();
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

  describe(provider.moveFile.name, () => {
    it('moves files', async () => {
      const fileA = join(baseDir, v4());
      const fileB = join(baseDir, v4());
      await createFile(fileA);
      await expect(fileExists(fileA)).resolves.toBe(true);

      await provider.moveFile(fileA, fileB);
      await expect(fileExists(fileA)).resolves.toBe(false);
      await expect(fileExists(fileB)).resolves.toBe(true);
    });

    it('throws on existing file', async () => {
      const fileA = join(baseDir, v4());
      const fileB = join(baseDir, v4());
      await createFile(fileA);
      await createFile(fileB);
      await expect(fileExists(fileA)).resolves.toBe(true);
      await expect(fileExists(fileB)).resolves.toBe(true);

      await expect(provider.moveFile(fileA, fileB)).rejects.toThrow();
      await expect(fileExists(fileA)).resolves.toBe(true);
      await expect(fileExists(fileB)).resolves.toBe(true);
    });
  });

  describe(provider.checkFileExists.name, () => {
    it('returns true when file exists', async () => {
      const file = join(baseDir, v4());
      await createFile(file);
      await expect(fileExists(file)).resolves.toBe(true);
      await expect(provider.checkFileExists(file)).resolves.toBe(true);
    });

    it('returns false when file does not exist', async () => {
      const file = join(baseDir, v4());
      await expect(fileExists(file)).resolves.toBe(false);
      await expect(provider.checkFileExists(file)).resolves.toBe(false);
    });
  });

  describe(provider.createReadStream.name, () => {
    it('returns readable stream', async () => {
      const file = join(baseDir, v4());
      const content = v4();
      await createFile(file, content);
      await expect(fileExists(file)).resolves.toBe(true);
      const stream = await provider.createReadStream(file);
      await expect(validateStream(content, stream.stream)).resolves.toBe(true);
    });

    it('returns correct length', async () => {
      const file = join(baseDir, v4());
      const content = v4();
      await createFile(file, content);
      await expect(fileExists(file)).resolves.toBe(true);
      const stream = await provider.createReadStream(file);
      expect(stream.length).toEqual(content.length);
    });
  });
});
