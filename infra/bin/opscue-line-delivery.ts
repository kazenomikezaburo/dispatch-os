#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { OpsCueLineDeliveryStack } from "../lib/opscue-line-delivery-stack";

const app = new cdk.App();

new OpsCueLineDeliveryStack(app, "OpsCueLineDelivery", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.OPSCUE_AWS_REGION ?? "ap-northeast-1",
  },
  description: "OpsCue OCV1-07C2 LINE one-shot delivery foundation (disabled by default)",
});
