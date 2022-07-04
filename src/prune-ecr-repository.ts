import * as core from "@actions/core";
import {
  ECRPUBLICClient,
  paginateDescribeImages,
  BatchDeleteImageCommand,
  ImageIdentifier,
} from "@aws-sdk/client-ecr-public";

const shortImageId = (id?: ImageIdentifier) => {
  const digest = id?.imageDigest
    ? `${id.imageDigest.slice(0, 4)}...${id.imageDigest.slice(-4)}`
    : "unknown";
  const tag = id?.imageTag ?? "unknown";
  return `${digest}:${tag}`;
};

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

  core.info(`✓ fetched images: ${images.length}`);

  const dangling = images.filter(
    (image) => !image.imageTags || image.imageTags.length < 1
  );

  if (dangling.length < 1) {
    core.info(`✓ no images to remove`);
    return;
  }

  core.info(`attempting to remove: ${dangling.length} images`);

  const response = await client
    .send(new BatchDeleteImageCommand({ repositoryName, imageIds: dangling }))
    .catch((error) => {
      core.error(error);
      return null;
    });

  if (!response) {
    core.setFailed(`✗ failed to execute batch delete`);
    return;
  }

  core.summary
    .addHeading("ECR Cleanup Result")
    .addTable([
      [
        { data: "Status", header: true },
        { data: "Digest", header: true },
        { data: "Comment", header: true },
      ],
      ...(response.imageIds ?? []).map((id) => [
        "✓",
        shortImageId(id),
        "deleted",
      ]),
      ...(response.failures ?? []).map((id) => [
        "✗",
        shortImageId(id.imageId),
        `${id.failureCode ?? "?"} - ${id.failureReason ?? "?"}`,
      ]),
    ])
    .write();

  if (response.failures && response.failures.length > 0) {
    core.setFailed(`✗ some images failed to delete`);
    return;
  }

  core.info(`✓ deleted ${response.imageIds?.length ?? 0} images`);
})();
