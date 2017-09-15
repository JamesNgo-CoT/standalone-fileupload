#!/usr/bin/env bash

#after a new project is up and running,
# you can use these commands to create and connect to the remote repo and push the first commit

#be sure to update these vars:
REMOTE_PATH=/Volumes/inet/secure/docs/webapps/source/
APP_NAME=fileupload.git

#get current dir
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

#setup remote
cd ${REMOTE_PATH}
git init --bare ${APP_NAME}

#setup local
cd ${DIR}
git init

#first commit
git add .
git commit -m "First commit"

#add and push to remote
git remote add origin ${REMOTE_PATH}${APP_NAME}
git remote -v
git push -u origin master
