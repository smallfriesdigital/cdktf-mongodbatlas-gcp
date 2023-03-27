import { Construct } from "constructs";
import { App, TerraformStack, TerraformVariable } from "cdktf";
import { MongodbatlasProvider } from "@cdktf/provider-mongodbatlas/lib/provider";
import { Project } from "@cdktf/provider-mongodbatlas/lib/project";
import { Cluster } from "@cdktf/provider-mongodbatlas/lib/cluster";
import { DatabaseUser } from "@cdktf/provider-mongodbatlas/lib/database-user";
import { ProjectIpAccessList } from "@cdktf/provider-mongodbatlas/lib/project-ip-access-list";

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // define secure environment variables (won't end up in cdk.tf.json)
    const publicKey = new TerraformVariable(this, "publicKey", {
      type: "string",
      description: "MongoDB Atlas Org Public Key",
      sensitive: true,
    });

    const privateKey = new TerraformVariable(this, "privateKey", {
      type: "string",
      description: "MongoDB Atlas Org Private Key",
      sensitive: true,
    });

    const orgId = new TerraformVariable(this, "orgId", {
      type: "string",
      description: "MongoDB Atlas Org ID",
      sensitive: true,
    });

    // satisfy all the Atlas requirements before instantiating new cluster
    new MongodbatlasProvider(this, 'Atlas', {
      publicKey: publicKey.value, // secret set via environment variable TF_VAR_publicKey
      privateKey: privateKey.value // secret set via environment variable TF_VAR_privateKey
    });

    const atlasProject = new Project(this, "newProject", {
      name: "CDKTFProject1",
      orgId: orgId.value // set via environment variable TF_VAR_orgId
    });

    // create cluster resource
    const atlasCluster = new Cluster(this, "newCluster1", {
      projectId: atlasProject.id,
      name: "atlasClusterCDK",
      clusterType: "REPLICASET",
      cloudBackup: false,
      mongoDbMajorVersion: "5.0",
      providerName: "TENANT",
      backingProviderName: "GCP",
      providerInstanceSizeName: "M0",
      providerRegionName: "CENTRAL_US",

      replicationSpecs: [
        {
          "numShards": 1,
          "regionsConfig": [
            {
              "electableNodes": 3,
              "priority": 7,
              "readOnlyNodes": 0,
              "regionName": "CENTRAL_US"
            }

          ]
        }
      ]
    })


    const adminPassword = new TerraformVariable(this, "adminPassword", {
      type: "string",
      description: "MongoDB Atlas Cluster DB Admin",
      sensitive: true,
    });

    // add admin user to cluster
    new DatabaseUser(this, "adminUser", {
      username: "cdktf-adminuser",
      password: adminPassword.value, // secret set via environment variable TF_VAR_adminPassword
      projectId: atlasProject.id,
      authDatabaseName: "admin",
      roles: [
        {
          roleName: "readAnyDatabase",
          databaseName: "admin"
        }
      ],
      scopes: [
        {
          name: atlasCluster.name,
          type: "CLUSTER"
        }
      ]

    })

    const userNetwork = new TerraformVariable(this, "userNetwork", {
      type: "string",
      description: "MongoDB Atlas Project IP access",
      sensitive: false,
    });

    new ProjectIpAccessList(this, "projectnetworkAccess", {
      projectId: atlasProject.id,
      cidrBlock: userNetwork.value // secret set via environment variable TF_VAR_userNetwork
    })

  }
}


const app = new App();
new MyStack(app, "cdktf-gcp-mongodbatlas");
app.synth();
