#!/bin/bash 
sudo yum install java-1.8.0-openjdk -y
mkdir -p /S3
aws s3 sync s3://divisha-bucket-2/upload/S3 /S3
chmod -R 777 /spring
#java -jar /spring/apps/RoadNameWS.jar