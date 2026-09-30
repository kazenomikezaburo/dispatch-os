import assert from "node:assert/strict";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { OpsCueLineDeliveryStack } from "../lib/opscue-line-delivery-stack";

const app = new cdk.App();
const stack = new OpsCueLineDeliveryStack(app, "TestStack", { env: { region: "ap-northeast-1" } });
const template = Template.fromStack(stack);

template.resourceCountIs("AWS::EC2::NatGateway", 0);
template.resourceCountIs("AWS::EC2::SecurityGroupIngress", 0);
template.hasResourceProperties("AWS::Scheduler::Schedule", {
  State: "DISABLED",
  ScheduleExpression: "rate(1 minute)",
  FlexibleTimeWindow: { Mode: "OFF" },
  Target: {
    RetryPolicy: { MaximumEventAgeInSeconds: 120, MaximumRetryAttempts: 1 },
    EcsParameters: Match.objectLike({
      LaunchType: "FARGATE",
      TaskCount: 1,
      NetworkConfiguration: { AwsvpcConfiguration: Match.objectLike({ AssignPublicIp: "ENABLED" }) },
    }),
  },
});
template.resourceCountIs("AWS::ECS::TaskDefinition", 2);
template.hasResourceProperties("AWS::ECS::TaskDefinition", {
  Cpu: "256",
  Memory: "512",
  ContainerDefinitions: Match.arrayWith([Match.objectLike({
    Name: "opscue-line-dispatcher",
    ReadonlyRootFilesystem: true,
    Environment: Match.arrayWith([
      { Name: "LINE_DELIVERY_ENABLED", Value: "false" },
      { Name: "LINE_DELIVERY_MODE", Value: "normal" },
      { Name: "LINE_DELIVERY_BATCH_SIZE", Value: "4" },
      { Name: "LINE_DISPATCHER_MAX_RUNTIME_MS", Value: "55000" },
    ]),
  })]),
});
template.hasResourceProperties("AWS::ECS::TaskDefinition", {
  ContainerDefinitions: Match.arrayWith([Match.objectLike({
    Name: "opscue-line-canary-dispatcher",
    ReadonlyRootFilesystem: true,
    Environment: Match.arrayWith([
      { Name: "LINE_DELIVERY_ENABLED", Value: "false" },
      { Name: "LINE_DELIVERY_MODE", Value: "canary" },
      { Name: "LINE_DELIVERY_BATCH_SIZE", Value: "1" },
    ]),
    Secrets: Match.arrayWith([Match.objectLike({ Name: "OPSCUE_LINE_CANARY_DISPATCHER_DATABASE_URL" })]),
  })]),
});
template.hasResourceProperties("AWS::SecretsManager::Secret", Match.not(Match.objectLike({ SecretString: Match.anyValue() })));
template.resourceCountIs("AWS::IAM::Role", 4);
template.resourceCountIs("AWS::CloudWatch::Alarm", 4);
template.hasResourceProperties("AWS::Logs::LogGroup", { RetentionInDays: 30 });

const json = JSON.stringify(template.toJSON());
assert.doesNotMatch(json, /postgresql:\/\//);
for (const resource of Object.values(template.toJSON().Resources) as Array<{ Type: string; Properties?: Record<string, unknown> }>) {
  if (resource.Type === "AWS::SecretsManager::Secret") {
    assert.equal(resource.Properties?.SecretString, undefined);
    assert.equal(resource.Properties?.GenerateSecretString, undefined);
  }
}
assert.match(json, /opscue_line_dispatcher|claim_line_deliveries|line-dispatcher/);
console.log("OpsCue LINE delivery CDK: PASS");
