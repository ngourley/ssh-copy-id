#!/usr/bin/env node
var package = require('./package.json');
var program = require('commander');
var fs = require('fs');
var winston = require('winston');
var moment = require('moment');

var config = {};
config.winston = {};
config.winston.console = {};
config.winston.console.level = 'debug';
config.winston.console.silent = false;
config.winston.console.colorize = true;
config.winston.console.timestamp = function() {
    return moment().local().format('DD MMM HH:mm:ss');
};
 
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, config.winston.console);

program
    .version(package.version)
    .usage('[-i [identity_file]] [-r] [user@]machine')
    .option('-i, --identity_file [path]', 'An file location')
    .option('-r, --revoke', 'Revoke key')
    .parse(process.argv);

args = program.args

var lib = require('./lib');

var asCommand = !module.parent;

if (asCommand === false) {
    module.exports = lib;
    return;
}

if (!args.length) {
    winston.error('Host required');
    process.exit(1);
}

var identityFile = (program.identity_file) ? program.identity_file : '~/.ssh/id_rsa.pub';

var input = args[0].split('@');
var account = input[0];
var host = input[1];
var username = account.split(':')[0]
var password = account.split(':')[1]

var options = {
    host: host,
    username: username,
    password: password,
    identityPath: identityFile,
    revoke: program.revoke
}

lib(options, function() {});