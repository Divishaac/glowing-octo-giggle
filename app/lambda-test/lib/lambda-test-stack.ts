import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export class LambdaTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    //Role lambda 
    const lambdawebserverRole = new iam.Role(this, 'divi-lambdawebserver-role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    //Create S3 bucket
    const springBucket = new s3.Bucket(this, "divisha-bucket-2", {
      versioned: true,
      bucketName: "divisha-bucket-2",
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    new s3deploy.BucketDeployment(this, 'DeployS3', {
      sources: [s3deploy.Source.asset('lib/objects/')],
      destinationBucket: springBucket,
    });

    // Import the ARN of the ASG from the other stack
    const asgArn = cdk.Fn.importValue('ASG-main-dc');
    const asgRole = cdk.Fn.importValue('ASG-main-role');
    // Create an AutoScalingGroup object for the ASG
    const asg = autoscaling.AutoScalingGroup.fromAutoScalingGroupName(this, 'MyAsg', asgArn);
    const roleASG = iam.Role.fromRoleArn(this, 'MyASGRole', asgRole);
    springBucket.grantReadWrite(roleASG);
    // Lambda function to copy files from S3 to EC2
    const copyFunc = new lambda.Function(this, "S3toEC2Copy", {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("lib"),
      handler: "S3toEC2Copy.handler",
      role: lambdawebserverRole,
      environment: {
        BUCKET: springBucket.bucketName,
        ASG_NAME: asg.autoScalingGroupName
      }
    });
    //Grant the Lambda function permissions to read from the S3 bucket
    springBucket.grantRead(copyFunc);
    springBucket.grantDelete(copyFunc);
    // Add the S3 bucket as an event source for the Lambda function
    copyFunc.addEventSource(new cdk.aws_lambda_event_sources.S3EventSource(springBucket, {
      events: [s3.EventType.OBJECT_CREATED, s3.EventType.OBJECT_REMOVED]
    }));
    //Attach policy
    const policy = new iam.Policy(this, 'LambdaAccessPolicy', {
      policyName: 'LambdaAccessPolicy',
      statements: [
        new iam.PolicyStatement({
          actions: ["ec2:DescribeInstances", "ec2:Connect", "ec2:DescribeInstanceStatus"],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          resources: ['arn:aws:logs:*:*:*'],
          actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        }),
        new iam.PolicyStatement({
          actions: ["autoscaling:DescribeAutoScalingGroups"],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          actions: ["ssm:SendCommand"],
          resources: ["*"]
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [copyFunc.functionArn]
        })
      ]
    });
    lambdawebserverRole.attachInlinePolicy(policy);
    //copyFunc.addEnvironment('ASG_STACK-NAME', 'test-c-dc' )
    // Create a CloudWatch Events rule to trigger the Lambda function whenever a new EC2 instance is launched by the ASG
    const rule = new events.Rule(this, 'DiviRule', {
      eventPattern: {
        source: ['aws.autoscaling'],
        detailType: ['EC2 Instance Launch Successful'],
        //check event types
        detail: {
          'AutoScalingGroupName': [asg.autoScalingGroupName],
        },
      },
    });
    rule.addTarget(new targets.LambdaFunction(copyFunc));
  }
}
