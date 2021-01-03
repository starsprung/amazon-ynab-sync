import { readFile, writeFile } from 'fs/promises';
import makeDir from 'make-dir';
import mockdate from 'mockdate';
import { normalize } from 'path';
import { mocked } from 'ts-jest/utils';
import { makeCacheDir, readCache, writeCache } from './cache';

jest.mock('fs/promises');
jest.mock('make-dir');
jest.mock('./config');

describe('cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockdate.set('2021-01-31');
  });

  afterEach(() => {
    mockdate.reset();
  });

  describe('makeCacheDir', () => {
    it('should create the cache directory at the configured path', async () => {
      await makeCacheDir();

      expect(mocked(makeDir)).toBeCalledWith(normalize('/path/to/cache/'));
    });
  });

  describe('readCache', () => {
    it('should return null if file is not found', async () => {
      mocked(readFile).mockRejectedValueOnce({ code: 'ENOENT' });

      const result = await readCache(['test', 'abc']);

      expect(mocked(readFile)).toBeCalledWith(
        normalize(
          '/path/to/cache/e681dcffa482964ddbaaf5bc5aafaa3f055cc5eb5c8a5d389ace0ca8659c766f.cache',
        ),
        { encoding: 'utf-8' },
      );
      expect(result).toEqual(null);
    });

    it('should throw on non-ENOENT errors', async () => {
      mocked(readFile).mockRejectedValueOnce(new Error('something bad happened'));
      await expect(readCache(['test', 'abc'])).rejects.toThrow('something bad happened');
    });

    it('should return stored value if one exists', async () => {
      mocked(readFile).mockResolvedValueOnce(
        '{ "value": { "somevalue": 123 }, "time": 1609550806034 }',
      );

      const result = await readCache('qwerty');
      expect(mocked(readFile)).toBeCalledWith(
        normalize(
          '/path/to/cache/65e84be33532fb784c48129675f9eff3a682b27168c0ea744b2cf58ee02337c5.cache',
        ),
        { encoding: 'utf-8' },
      );
      expect(result).toEqual({ somevalue: 123 });
    });

    it('should return stored value if younger than maxAge', async () => {
      mocked(readFile).mockResolvedValueOnce(
        '{ "value": { "test": "asdf" }, "time": 1611964800000 }',
      );

      const result = await readCache('qwerty', 24 * 60 * 60 * 1000);
      expect(result).toEqual({ test: 'asdf' });
    });

    it('should not return stored value if older than maxAge', async () => {
      mocked(readFile).mockResolvedValueOnce(
        '{ "value": { "test": "asdf" }, "time": 1611964799999 }',
      );

      const result = await readCache('qwerty', 24 * 60 * 60 * 1000);
      expect(result).toEqual(null);
    });
  });

  describe('writeCache', () => {
    it('should write value to file', async () => {
      await writeCache('zxcv', 1234);

      expect(mocked(writeFile)).toBeCalledWith(
        normalize(
          '/path/to/cache/7020e57625b6a6695ffd51ed494fbfc56c699eaceca4e77bf7ea590c7ebf3879.cache',
        ),
        JSON.stringify({ value: 1234, time: 1612051200000 }, null, 2),
        { encoding: 'utf-8' },
      );
    });
  });
});
