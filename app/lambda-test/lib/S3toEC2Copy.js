const AWS = require("aws-sdk");
//const s3 = new AWS.S3();
const ssm = new AWS.SSM();
const asg = new AWS.AutoScaling();
exports.handler = (event, context, callback) => {
  var instance = event.InstanceId;
  console.log(instance)
  const asgName = process.env.ASG_NAME;
  // const bucket = process.env.BUCKET;
  // const scriptKey = 'upload/';
  var params1 = {
    AutoScalingGroupNames: [
       asgName
    ]
   };

asg.describeAutoScalingGroups(params1, function (err, data) {
    if (err) {
      console.log(err);
    } else {

      try {
        var a = data.AutoScalingGroups[0].Instances.map(instance => instance.InstanceId)
        console.log(a.join(', '));
        // Read userdata from shell script
        const fs = require('fs');
        const userData = fs.readFileSync('user-data.sh', 'utf8');
        // Run the script on the EC2 instance
        const params = {
          DocumentName: 'AWS-RunShellScript',
          InstanceIds: a,
          Parameters: {
            commands: [userData],
          },
        };
        console.log(params)
        ssm.sendCommand(params, function(err, data) {
          if (err) console.log(err, err.stack); // an error occurred
          else     console.log(data);           // successful response
        });
      } catch (err) {
        console.log(err, err.stack);
      }
    }
  });
};