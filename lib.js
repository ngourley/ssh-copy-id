var Client = require('ssh2').Client;
var winston = require('winston');
var s = require("underscore.string");
var fs = require('fs')

var connectionInfo;
var identity;

module.exports = function (opts, callback) {
    var options = {};
    options.identityPath = opts.identityPath
    options.host = opts.host
    options.username = opts.username
    options.password = opts.password
    options.revoke = opts.revoke;

    try {
        identity = fs.readFileSync(options.identityPath, 'utf-8');
        identity = s(identity).trim().value()
        findCmd = 'grep -Fw "' + identity + '" ~/.ssh/authorized_keys | grep -qsvF "^#"';
        copyCmd = 'echo "' + identity + '" >> ~/.ssh/authorized_keys';
    } catch (err) {
        winston.error(err.message);
        process.exit(1);
    }

    connectionInfo = {
        host: options.host,
        port: 22,
        username: options.username,
        password: options.password,
    };

    if (options.revoke) {
        revoke(callback);
    } else {
        grant(callback);
    }
}

function revoke (callback) {
    var conn = new Client();
    conn.on('ready', function () {
        winston.debug('Connect established to ' + connectionInfo.host);
        conn.exec(findCmd, function (err, stream) {
            if (err) {
                return winston.error(err);
            }
            stream.on('close', function (code, signal) {
                if (code === 1) {
                    winston.info('Key not found, no action required');
                    conn.end();
                    return callback(null, false);
                }
                if (code === 0) {
                    conn.exec('echo remove', function (err, copyStream) {
                        if (err) throw err;
                        replace(conn, function (err, result) {
                            conn.end();
                            return callback(err, result);
                        });
                    });
                }
            }).on('data', function (data) {
                winston.debug('STDOUT: ' + data);
            }).stderr.on('data', function (data) {
                winston.debug('STDERR: ' + data);
            });
        });
    }).on('error', function (err) {
        winston.error(err.message);
        return callback(err, null);
    }).connect(connectionInfo);
}

function grant (callback) {
    var conn = new Client();
    conn.on('ready', function () {
        winston.debug('Connect established to ' + connectionInfo.host);
        conn.exec(findCmd, function(err, stream) {
            if (err) {
                winston.error(err);
                return callback(err, null);
            }
            stream.on('close', function(code, signal) {
                if (code === 1) {
                    winston.info('Key not found, transferring');
                    conn.exec(copyCmd, function (err, copyStream) {
                        if (err) {
                            winston.error(err);
                            return callback(err, null);
                        }
                        winston.info('Key added.')
                        conn.end();
                        return callback(null, true);
                    });
                }
                if (code === 0) {
                    winston.info('Key already exists');
                    conn.end();
                    return callback(null, false);
                }
            }).on('data', function(data) {
                winston.debug('STDOUT: ' + data);
            }).stderr.on('data', function(data) {
                winston.debug('STDERR: ' + data);
            });
        });
    }).on('error', function (err) {
        winston.error(err.message);
        return callback(err, null);
    }).connect(connectionInfo);
}

function replace (connection, callback) {
    
    var grepOut = 'grep -v "'+ identity +'" ~/.ssh/authorized_keys | cat > ~/.ssh/authorized_keys.node-ssh-copy-id';
    var replace = 'mv -f ~/.ssh/authorized_keys.node-ssh-copy-id ~/.ssh/authorized_keys';

    connection.exec(grepOut, function (err, stream) {
        if (err) {
            winston.error(err);
            return callback(err, null);
        }
        stream.on('close', function (code, signal) {
            if (code === 0) {
                winston.info('Temp created.');
                connection.exec(replace, function (err, replaceStream) {
                    if (err) {
                        winston.error(err);
                        return callback(err, null);
                    }
                    replaceStream.on('close', function (code, signal) {
                        if (code === 0) {
                            winston.info('Revoke complete');
                            callback(null, true);
                        } else {
                            winston.error('Revoke failed!');
                            callback(new Error('Revoke failed'), null);
                        }
                    });
                });
            }
        }).on('data', function (data) {
            winston.debug('STDOUT: ' + data);
        }).stderr.on('data', function (data) {
            winston.debug('STDERR: ' + data);
            return callback(err, null);
        });
    });
}