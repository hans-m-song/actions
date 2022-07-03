import * as core from "@actions/core";
import {
  ECRPUBLICClient,
  paginateDescribeImages,
  BatchDeleteImageCommand,
  BatchDeleteImageCommandOutput,
} from "@aws-sdk/client-ecr-public";

const serialiseResult = (response: BatchDeleteImageCommandOutput) =>
  [
    "### Batch deleted images",
    ...(response.imageIds?.map(
      (image) => `✓ ${image.imageDigest}:${image.imageTag}`
    ) ?? []),
    ...(response.failures?.map(
      (image) =>
        `✗ ${image.imageId?.imageDigest}:${image.imageId?.imageTag} - ${image.failureCode}: ${image.failureReason}`
    ) ?? []),
  ].join("\n");

(async () => {
  const region = core.getInput("aws-region");
  const accessKeyId = core.getInput("aws-access-key-id");
  const secretAccessKey = core.getInput("aws-secret-access-key");
  const repositoryName = core.getInput("repository-name");

  const client = new ECRPUBLICClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const paginator = paginateDescribeImages(
    { client },
    { repositoryName: repositoryName }
  );

  const images = [];
  for await (const page of paginator) {
    if (page.imageDetails) {
      images.push(...page.imageDetails);
    }
  }

  console.log(JSON.stringify(images));
  core.info(`✓ fetched images: ${images.length}`);

  const dangling = images.filter(
    (image) => !image.imageTags || image.imageTags.length < 1
  );

  if (dangling.length < 1) {
    core.info(`✓ no images to remove`);
    return;
  }

  core.info(`attempting to remove: ${dangling.length} of ${images.length}`);

  const response = await client.send(
    new BatchDeleteImageCommand({ repositoryName, imageIds: dangling })
  );

  core.exportVariable("GITHUB_STEP_SUMMARY", serialiseResult(response));

  if (response.failures && response.failures.length > 0) {
    core.setFailed(`✗ failures encountered deleting images`);
  }
})();
