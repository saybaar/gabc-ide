'use strict';

var express = require('express');

var parser = require('body-parser');
var process = require('process');
var socket = require('socket.io');
var fs = require('fs-extra');
const {
  spawn
} = require('child_process');
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

var server = express();
var io = socket(server.listen(process.env.PORT || 8080));
server.use(parser.urlencoded());

server.get('/', function(req, res) {
  res.status(200);
  res.type('html');
  res.sendFile(__dirname + '/index.html');
});

server.get('/example.gabc', function(req, res) {
  res.status(200);
  res.type('text/plain');
  res.sendFile(__dirname + '/example.gabc');
});

server.get('/:guid/test.pdf', function(req, res) {
  res.status(200);
  res.type('application/pdf');
  res.sendFile(__dirname + '/' + req.params.guid + '/test.pdf');
});

io.on('connection', function(objectSocket) {
  console.log('starting in directory ' + process.cwd());
  // make a temp directory; when scalable, this will happen inside a socket
  // connection event instead
  var newdir = __dirname + '/' + objectSocket.id;
  fs.mkdir(newdir, (err) => {
    if (err && err.code != 'EEXIST') {
      throw err;
    }
    fs.copyFileSync(__dirname + '/test.tex', newdir + '/test.tex');
  });

  objectSocket.on('message', function(objectData) {
    renderPdf(objectData.gabc);
  });

  objectSocket.on('disconnect', function() {
    fs.remove(objectSocket.id, function() {
      console.log('removed directory ' + objectSocket.id);
    })
  });

  var renderPdf = function(gabc) {
    process.chdir(__dirname + '/' + objectSocket.id); // todo: error check
    var gabc_file = 'example.gabc';
    fs.writeFile(gabc_file, gabc, (err) => {
      if (err) throw err;
      console.log('saved some GABC');
    });

    const render = spawn('lualatex',
      ['--shell-escape', '-interaction=nonstopmode', 'test.tex']);
    var output = '';

    render.stderr.on('data', (data) => {
      console.log(data);
      output = output + 'error: ' + data + '\n';
    });

    render.on('close', (code) => {
      console.log('render process exited with code ' + code);
      if (code === 0) {
        objectSocket.emit('message', {
          'status': 'done'
        });
      } else {
        objectSocket.emit('message', {
          'status': 'error',
          'log': output
        });
      }
    });
    console.log('finished, moving out of ' + process.cwd());
    process.chdir(__dirname);
  };

});

/*
server.get('/test.mid', function(req, res) {
  res.status(200);
  res.type('application/midi');
  res.sendFile('/home/lydia/webdev-project/test.mid');
})
*/
