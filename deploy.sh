#!/bin/bash

# Install dependencies
npm install --production

# Copy files
cp -r node_modules $DEPLOYMENT_TARGET/
cp -r src $DEPLOYMENT_TARGET/
cp package.json $DEPLOYMENT_TARGET/