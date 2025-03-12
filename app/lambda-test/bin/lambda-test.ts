#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';
import { LambdaTestStack } from '../lib/lambda-test-stack';
import { RolesStack } from '../lib/infra/roles-stack';
import { ConfigReader } from '../lib/util/configreader';
import { AlphaPipelineStack } from '../pipeline/infra/alpha-pipeline-stack';
import { BetaPipelineStack } from '../pipeline/infra/beta-pipeline-stack';
import { ProdPipelineStack } from '../pipeline/infra/prod-pipeline-stack';


const deployEnv = process.env['DEPLOYENV'] || " ";

if ( deployEnv === " " ) {
    throw new Error("DEPLOYENV environment variable has not been set");
}

const cfgReader = new ConfigReader('/config/app.yml');
const prefix = cfgReader.get('prefix') || " ";

if (prefix === " ") {
    throw new Error("Missing prefix in /config/app.yml");
}

const account_ids = JSON.parse(JSON.stringify(cfgReader.get('accountids')));
const tooling_env = { account: account_ids['tooling'], region: cfgReader.get('region') };
const alpha_env = { account: account_ids['alpha'], region: cfgReader.get('region') };
//const beta_env = { account: account_ids['beta'], region: cfgReader.get('region') };
//const prod_env = { account: account_ids['prod'], region: cfgReader.get('region') };

const app = new cdk.App();
new LambdaTestStack(app, 'lambda-test-' + deployEnv, { env: alpha_env } );
// new LambdaTestStack(app, 'lambda-test-alpha', { env: alpha_env} );
// new LambdaTestStack(app, 'lambda-test-beta', { env: beta_env } );
// new LambdaTestStack(app, 'lambda-test-prod', { env: prod_env } );

new RolesStack(app, 'lambda-test-bitbucketrole', { env: tooling_env } );
new AlphaPipelineStack(app, 'lambda-test-alpha-pipeline', { env: tooling_env });
new BetaPipelineStack(app, 'lambda-test-beta-pipeline', { env: tooling_env }); 
new ProdPipelineStack(app, 'lambda-test-prod-pipeline', { env: tooling_env });