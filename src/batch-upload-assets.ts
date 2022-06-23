import { getOctokit } from "@actions/github";
import * as core from "@actions/core";
import * as glob from "@actions/glob";
import { promises as fs } from "fs";
import * as path from "path";

const getFiles = async (pattern: string) => {
  try {
    const globber = await glob.create(pattern);
    const results = await globber.glob();
    core.info(`✓ glob returned ${results.length} files`);
    return results;
  } catch (error) {
    core.error(error as Error);
    core.setFailed(`✗ failed to glob with pattern: \`${pattern}\``);
    return [];
  }
};

const fileList = (files: string[]) =>
  ["### Batch Upload Files", ...files.map((file) => `- \`${file}\``)].join(
    "\n"
  );

const getUploadParameters = (url: string) => {
  const matches = url.match(
    /https:\/\/uploads.github.com\/repos\/(?<owner>.+?)\/(?<repo>.+?)\/releases\/(?<releaseId>\d+)/i
  );

  const { owner, repo, releaseId } = matches?.groups ?? {};
  const release_id = Number(releaseId);
  const parameters = [
    `owner="${matches}"`,
    `repo="${repo}"`,
    `release_id="${release_id}"`,
  ].join(", ");

  if (owner && repo && release_id) {
    core.info(`✓ uploading with parameters: ${parameters}`);
    return { owner, repo, release_id };
  }

  core.setFailed(`✗ missing required parameters: ${parameters}`);
  return null;
};

const uploadAsset = (
  github: ReturnType<typeof getOctokit>,
  parameters: NonNullable<ReturnType<typeof getUploadParameters>>
) => {
  return async (filepath: string) => {
    const name = path.basename(filepath);
    try {
      const buffer = await fs.readFile(filepath);
      await github.rest.repos.uploadReleaseAsset({
        ...parameters,
        data: buffer.toString(),
        name,
      });
      core.info(`✓ uploaded file: \`${filepath}\``);
    } catch (error) {
      core.error(error as Error);
      core.setFailed(`✗ failed to upload file: \`${filepath}\``);
    }
  };
};

(async () => {
  const token = core.getInput("token");
  const url = core.getInput("upload_url");
  const filePath = core.getInput("file_path");

  const files = await getFiles(filePath);
  core.exportVariable("GITHUB_STEP_SUMMARY", fileList(files));

  const github = getOctokit(token);
  const parameters = getUploadParameters(url);
  if (parameters) {
    await Promise.all(files.map(uploadAsset(github, parameters)));
  }
})();
