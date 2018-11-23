'use strict';

var express = require('express');
var socket = require('socket.io');
var parser = require('body-parser');
var process = require('process');
var fs = require('fs');
const { spawn } = require('child_process');
/*
ls.stdout.on('data', (data) => {
  console.log('' + data);
  // fs.writeFile('hello.pdf', data, function(err) {
  //   if(err != undefined) {
  //     console.log('error: ' + err);
  //   } else {
  //     console.log('done!');
  //   }
  // });
  // ^ this is the way to go for a program like 'ls' that pipes to stdout
  // (lualatex does its own file generation)
});
*/
var guid = "1234567890";

var server = express();
server.use(parser.urlencoded());

server.get('/', function(req, res) {
  console.log('starting in directory ' + process.cwd());
  // make a temp directory; when scalable, this will happen inside a socket
  // event instead probably
  fs.mkdir('./' + guid, (err) => {
    if (err.code != 'EEXIST') throw err;
    process.chdir('./' + guid);
    console.log('now in directory ' + process.cwd());
    res.status(200);
    res.type('html');
    res.sendFile('/home/lydia/webdev-project/index.html');
  });
});

// Receive a POST with gabc body
server.post('/generate', function(req, res) {
  console.log('received POST with body: ' + req.body.gabc);
  const render = spawn('lualatex', ['--shell-escape', 'test.tex']);
  const cleanup = spawn('ls', ['*.glog', '*.gtex']);
  var output = '';

  render.stderr.on('data', (data) => {
    console.log(data);
    output = output + 'stderr says: ' + data + '\n';
  });

  render.on('close', (code) => {
    console.log('render process exited with code ' + code);
    res.status(200);
    res.type('text/plain');
    res.send(output);
  });

  cleanup.stdout.on('data', (data) => {
    console.log('ls says: ' + data);
  });
  cleanup.stderr.on('data', (data) => {
    console.log('ls-error says: ' + data);
  });
  cleanup.on('close', (code) => {
    console.log('cleanup edited with code ' + code);
  });

});

server.get('/:guid/gen.pdf', function(req, res) {
  res.status(200);
  res.type('application/pdf');
  res.sendFile('/home/lydia/webdev-project/' + gen + '/test.pdf');
})
/*
server.get('/test.mid', function(req, res) {
  res.status(200);
  res.type('application/midi');
  res.sendFile('/home/lydia/webdev-project/test.mid');
})
*/
server.listen(8080);
