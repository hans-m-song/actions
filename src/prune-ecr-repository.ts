import * as core from "@actions/core";
import {
  ECRPUBLICClient,
  paginateDescribeImages,
} from "@aws-sdk/client-ecr-public";

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
})();
