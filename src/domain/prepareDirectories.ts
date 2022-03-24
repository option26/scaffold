/* eslint-disable no-bitwise */

import path from 'path';
import fs from 'fs/promises';
import { constants as FsConstants } from 'fs';
import { v4 as uuid } from 'uuid';
import git from 'simple-git';

/**
 * Runs at the start of the process to parse, prepare and validate the source and target directories.
 *
 * Regarding the source directory, it will first check wether the path points to a local file or to a git repository.
 * If it is a git repository, it will clone the repo to a temporary folder. If it is a local path, it will resolve it
 * to an absolute path. In any case, the resulting source directory is validated (check if it exists and is readable).
 *
 * Regarding the source directory, it will first resolve the path to an absolute path. It will then check if the directory
 * exists and is writable. Finally, it will check if the directory is empty and abort if it is not to prevent file loss.
 *
 * @param sourceArg User input for the source path
 * @param targetArg User input for the target path
 * @returns { sourceDir, targetDir, deleteSourceDir } Absolute source and target dirs and a flag wether the sourceDir should be deleted on exit
 */
async function prepareDirectories(sourceArg: string, targetArg: string) {
  let sourceDir: string;

  let deleteSourceDir: boolean = false;

  // Determine if we need to clone a git repo
  if (sourceArg.startsWith('https://')) {
    // Clone to temporary directory if path is a git repo
    const tmpDir = `/tmp/${uuid()}`;
    console.info(`Downloading template code from ${sourceArg} to ${tmpDir}`);

    try {
      await git().clone(sourceArg, tmpDir);
      sourceDir = tmpDir;
    } catch (err) {
      console.error('An error occurred while downloading the template:', err);
      process.exit(1);
    }

    deleteSourceDir = true;
  } else {
    // Resolve path if it is a relative path
    sourceDir = path.resolve(process.cwd(), sourceArg);
  }

  // Check if final source directory is valid
  try {
    await fs.access(sourceDir, FsConstants.F_OK | FsConstants.R_OK);
  } catch (err) {
    console.error(
      'Unable to open source directory @',
      sourceDir,
      '(Does the directory exist?)',
    );
    process.exit(1);
  }

  // Check if target directory is valid
  const targetDir = path.resolve(process.cwd(), targetArg);

  try {
    await fs.access(targetDir, FsConstants.F_OK | FsConstants.W_OK);
  } catch (err) {
    console.error(
      'Unable to open target directory @',
      targetDir,
      '(Does the directory exist?)',
    );
    process.exit(1);
  }

  const targetDirFileCount = await fs.readdir(targetDir).then((f) => f.length);
  if (targetDirFileCount > 0) {
    console.error('Target directory is not empty! Aborting...');
    process.exit();
  }

  return {
    sourceDir,
    targetDir,
    deleteSourceDir,
  };
}

export default prepareDirectories;
