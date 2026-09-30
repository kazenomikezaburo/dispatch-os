import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export class OpsCueLineDeliveryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.42.0.0/24"),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: "public-dispatcher", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 26 }],
    });

    const securityGroup = new ec2.SecurityGroup(this, "DispatcherSecurityGroup", {
      vpc,
      allowAllOutbound: false,
      description: "No ingress; outbound HTTPS, Supabase session pooler, and VPC DNS only",
    });
    securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "LINE and AWS public APIs");
    securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(5432), "Supabase shared session pooler");
    securityGroup.addEgressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.udp(53), "VPC DNS UDP");
    securityGroup.addEgressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(53), "VPC DNS TCP");

    const repository = new ecr.Repository(this, "Repository", {
      repositoryName: "opscue-line-dispatcher",
      imageScanOnPush: true,
      encryption: ecr.RepositoryEncryption.AES_256,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ maxImageCount: 20, description: "Retain the latest 20 immutable deployment candidates" }],
    });
    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: "/opscue/line-dispatcher",
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const databaseSecretResource = new secretsmanager.CfnSecret(this, "DatabaseUrlSecret", {
      name: "opscue/line-dispatcher/database-url",
      description: "Populate after deploy with the dedicated Supabase session-pooler URL; no value is defined by CDK.",
    });
    const canaryDatabaseSecretResource = new secretsmanager.CfnSecret(this, "CanaryDatabaseUrlSecret", {
      name: "opscue/line/canary-dispatcher/database-url",
      description: "Populate before a manual canary with the canary-only Supabase session-pooler URL; no value is defined by CDK.",
    });
    const tokenSecretResource = new secretsmanager.CfnSecret(this, "MessagingTokenSecret", {
      name: "opscue/line/messaging-channel-access-token",
      description: "Populate only for the C2-06 canary; no value is defined by CDK.",
    });
    const databaseSecret = secretsmanager.Secret.fromSecretCompleteArn(this, "ImportedDatabaseUrlSecret", databaseSecretResource.ref);
    const canaryDatabaseSecret = secretsmanager.Secret.fromSecretCompleteArn(this, "ImportedCanaryDatabaseUrlSecret", canaryDatabaseSecretResource.ref);
    const tokenSecret = secretsmanager.Secret.fromSecretCompleteArn(this, "ImportedMessagingTokenSecret", tokenSecretResource.ref);

    const executionRole = new iam.Role(this, "TaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "ECS agent only: pull the exact ECR image, read the two exact secrets, and write the exact log group.",
    });
    executionRole.addToPolicy(new iam.PolicyStatement({ actions: ["ecr:GetAuthorizationToken"], resources: ["*"] }));
    executionRole.addToPolicy(new iam.PolicyStatement({
      actions: ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"],
      resources: [repository.repositoryArn],
    }));
    const canaryExecutionRole = new iam.Role(this, "CanaryTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Manual canary ECS agent only: pull the exact image, read canary DB and Messaging token secrets, and write logs.",
    });
    canaryExecutionRole.addToPolicy(new iam.PolicyStatement({ actions: ["ecr:GetAuthorizationToken"], resources: ["*"] }));
    canaryExecutionRole.addToPolicy(new iam.PolicyStatement({
      actions: ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"],
      resources: [repository.repositoryArn],
    }));

    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Dispatcher application role. Intentionally has no AWS API permissions.",
    });
    const cluster = new ecs.Cluster(this, "Cluster", { vpc, containerInsightsV2: ecs.ContainerInsights.ENABLED });
    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDefinition", {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole,
      taskRole,
      runtimePlatform: { cpuArchitecture: ecs.CpuArchitecture.X86_64, operatingSystemFamily: ecs.OperatingSystemFamily.LINUX },
    });
    const container = taskDefinition.addContainer("Dispatcher", {
      containerName: "opscue-line-dispatcher",
      image: ecs.ContainerImage.fromEcrRepository(repository, "c2-05-placeholder"),
      essential: true,
      readonlyRootFilesystem: true,
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: "task" }),
      stopTimeout: cdk.Duration.seconds(30),
      environment: {
        NODE_ENV: "production",
        LINE_DELIVERY_ENABLED: "false",
        LINE_DELIVERY_MODE: "normal",
        LINE_DELIVERY_BATCH_SIZE: "4",
        LINE_PUSH_TIMEOUT_MS: "8000",
        LINE_DISPATCHER_MAX_RUNTIME_MS: "55000",
        OPSCUE_APP_ORIGIN: "https://replace-before-c2-06.invalid",
      },
      secrets: {
        OPSCUE_LINE_DISPATCHER_DATABASE_URL: ecs.Secret.fromSecretsManager(databaseSecret),
        LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: ecs.Secret.fromSecretsManager(tokenSecret),
      },
    });
    container.addUlimits({ name: ecs.UlimitName.NOFILE, softLimit: 1024, hardLimit: 1024 });

    const canaryTaskDefinition = new ecs.FargateTaskDefinition(this, "CanaryTaskDefinition", {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: canaryExecutionRole,
      taskRole,
      runtimePlatform: { cpuArchitecture: ecs.CpuArchitecture.X86_64, operatingSystemFamily: ecs.OperatingSystemFamily.LINUX },
    });
    const canaryContainer = canaryTaskDefinition.addContainer("CanaryDispatcher", {
      containerName: "opscue-line-canary-dispatcher",
      image: ecs.ContainerImage.fromEcrRepository(repository, "c2-05-placeholder"),
      essential: true,
      readonlyRootFilesystem: true,
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: "canary-task" }),
      stopTimeout: cdk.Duration.seconds(30),
      environment: {
        NODE_ENV: "production",
        LINE_DELIVERY_ENABLED: "false",
        LINE_DELIVERY_MODE: "canary",
        LINE_DELIVERY_BATCH_SIZE: "1",
        LINE_PUSH_TIMEOUT_MS: "8000",
        LINE_DISPATCHER_MAX_RUNTIME_MS: "55000",
        OPSCUE_APP_ORIGIN: "https://replace-before-c2-06.invalid",
      },
      secrets: {
        OPSCUE_LINE_CANARY_DISPATCHER_DATABASE_URL: ecs.Secret.fromSecretsManager(canaryDatabaseSecret),
        LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: ecs.Secret.fromSecretsManager(tokenSecret),
      },
    });
    canaryContainer.addUlimits({ name: ecs.UlimitName.NOFILE, softLimit: 1024, hardLimit: 1024 });

    const schedulerRole = new iam.Role(this, "SchedulerRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
      description: "EventBridge Scheduler may run only this task definition on this cluster.",
    });
    schedulerRole.addToPolicy(new iam.PolicyStatement({
      actions: ["ecs:RunTask"],
      resources: [taskDefinition.taskDefinitionArn],
      conditions: { ArnEquals: { "ecs:cluster": cluster.clusterArn } },
    }));
    schedulerRole.addToPolicy(new iam.PolicyStatement({
      actions: ["iam:PassRole"],
      resources: [executionRole.roleArn, taskRole.roleArn],
      conditions: { StringEquals: { "iam:PassedToService": "ecs-tasks.amazonaws.com" } },
    }));

    const scheduleGroup = new scheduler.CfnScheduleGroup(this, "ScheduleGroup", { name: "opscue-line-delivery" });
    const schedule = new scheduler.CfnSchedule(this, "Schedule", {
      name: "opscue-line-delivery-every-minute",
      groupName: scheduleGroup.name,
      state: "DISABLED",
      scheduleExpression: "rate(1 minute)",
      flexibleTimeWindow: { mode: "OFF" },
      target: {
        arn: cluster.clusterArn,
        roleArn: schedulerRole.roleArn,
        retryPolicy: { maximumEventAgeInSeconds: 120, maximumRetryAttempts: 1 },
        ecsParameters: {
          taskDefinitionArn: taskDefinition.taskDefinitionArn,
          launchType: "FARGATE",
          platformVersion: "LATEST",
          taskCount: 1,
          enableEcsManagedTags: true,
          networkConfiguration: {
            awsvpcConfiguration: {
              assignPublicIp: "ENABLED",
              securityGroups: [securityGroup.securityGroupId],
              subnets: vpc.publicSubnets.map((subnet) => subnet.subnetId),
            },
          },
        },
      },
    });
    schedule.addResourceDependency(scheduleGroup);

    const authMetric = new logs.MetricFilter(this, "ProviderAuthMetric", {
      logGroup,
      filterPattern: logs.FilterPattern.literal('{ $.event = "line_dispatcher_complete" && $.providerAuthFailure = true }'),
      metricNamespace: "OpsCue/LineDelivery",
      metricName: "ProviderAuthFailure",
      metricValue: "1",
      defaultValue: 0,
    }).metric({ period: cdk.Duration.minutes(1), statistic: "Sum" });
    new cloudwatch.Alarm(this, "ProviderAuthAlarm", {
      metric: authMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const failureMetric = new logs.MetricFilter(this, "FailureMetric", {
      logGroup,
      filterPattern: logs.FilterPattern.literal('{ $.event = "line_dispatcher_complete" && $.outcome = "failed" }'),
      metricNamespace: "OpsCue/LineDelivery",
      metricName: "DispatcherFailure",
      metricValue: "1",
      defaultValue: 0,
    }).metric({ period: cdk.Duration.minutes(1), statistic: "Sum" });
    new cloudwatch.Alarm(this, "ConsecutiveFailureAlarm", {
      metric: failureMetric,
      threshold: 1,
      evaluationPeriods: 3,
      datapointsToAlarm: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    for (const metricName of ["TargetErrorCount", "InvocationDroppedCount"] as const) {
      new cloudwatch.Alarm(this, `${metricName}Alarm`, {
        metric: new cloudwatch.Metric({
          namespace: "AWS/Scheduler",
          metricName,
          dimensionsMap: { ScheduleGroup: scheduleGroup.name! },
          statistic: "Sum",
          period: cdk.Duration.minutes(1),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }

    new cdk.CfnOutput(this, "RepositoryUri", { value: repository.repositoryUri });
    new cdk.CfnOutput(this, "ScheduleName", { value: schedule.name! });
    new cdk.CfnOutput(this, "DatabaseSecretArn", { value: databaseSecretResource.ref });
    new cdk.CfnOutput(this, "CanaryDatabaseSecretArn", { value: canaryDatabaseSecretResource.ref });
    new cdk.CfnOutput(this, "CanaryTaskDefinitionArn", { value: canaryTaskDefinition.taskDefinitionArn });
    new cdk.CfnOutput(this, "MessagingTokenSecretArn", { value: tokenSecretResource.ref });
  }
}
