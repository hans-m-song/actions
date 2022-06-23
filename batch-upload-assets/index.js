const { getOctokit } = require("@actions/github");
const core = require("@actions/core");
const glob = require("@actions/glob");
const { promises: fs } = require("fs");
const path = require("path");

(async () => {
  const token = core.getInput("token");
  const url = core.getInput("upload_url");
  const filePath = core.getInput("file_path");

  const files = await getFiles(filePath);
  core.exportVariable("GITHUB_STEP_SUMMARY", fileList(files));

  const github = getOctokit(token);
  await Promise.all(files.map(uploadAsset(github, url)));
})();

const getFiles = async (pattern) => {
  try {
    const globber = await glob.create(pattern);
    const results = await globber.glob();
    core.info(`✓ glob returned ${reults.length} files`);
    return results;
  } catch (error) {
    core.error(error);
    core.setFailed(`✗ failed to glob with pattern: \`${pattern}\``);
    return [];
  }
};

const fileList = (files) => [
  "### Batch Upload Files", 
  ...files.map((file) => `- \`${file}\``),
].join("\n")

const uploadAsset = async (github, url) => (filepath) => {
  const name = path.basename(filepath);
  try {
    const file = await fs.readFile(filepath)
    await github.rest.repos.uploadReleaseAsset({url, name, file});
    core.info(`✓ uploaded file: \`${filepath}\``);
  } catch (error) {
    core.error(error);
    core.setFailed(`✗ failed to upload file: \`${filepath}\``);
  }
}
