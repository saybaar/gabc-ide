'use strict';

var express = require('express');
var parser = require('body-parser');
var process = require('process');
var socket = require('socket.io');
var fs = require('fs-extra');
const {
  spawn
} = require('child_process');

var server = express();
var io = socket(server.listen(8080));
server.use(parser.urlencoded());
express.static.mime.define({'text/plain': ['gabc']});
server.use(express.static('static'));

server.get('/:guid/test.pdf', function(req, res) {
  res.status(200);
  res.type('application/pdf');
  res.set('Cache-Control', 'private, max-age=0, no-cache, no-store');
  res.sendFile(__dirname + '/' + req.params.guid + '/test.pdf');
});

server.get('/:guid/test.png', function(req, res) {
  res.status(200);
  res.type('image/png');
  res.set('Cache-Control', 'private, max-age=0, no-cache, no-store');
  res.sendFile(__dirname + '/' + req.params.guid + '/test.png');
});

server.get('/:guid/test.wav', function(req, res) {
  res.status(200);
  res.type('audio/wav');
  res.set('Cache-Control', 'private, max-age=0, no-cache, no-store');
  res.sendFile(__dirname + '/' + req.params.guid + '/test.wav');
})

io.on('connection', function(objectSocket) {
  console.log('starting in directory ' + process.cwd());
  var newdir = __dirname + '/' + objectSocket.id;
  fs.mkdir(newdir, (err) => {
    if (err && err.code != 'EEXIST') {
      throw err;
    }
    fs.copyFileSync(__dirname + '/static/test.tex', newdir + '/test.tex');
  });

  objectSocket.on('gen', function(objectData) {
    copyGABC(objectData.gabc);
    renderPdf();
    renderAudio();
  });

  objectSocket.on('disconnect', function() {
    fs.remove(objectSocket.id, function() {
      console.log('removed directory ' + objectSocket.id);
    })
  });

  var copyGABC = function(gabc) {
    process.chdir(__dirname + '/' + objectSocket.id); // todo: error check
    var gabc_file = 'example.gabc';
    fs.writeFile(gabc_file, gabc, (err) => {
      if (err) throw err;
      console.log('saved some GABC');
    });
  };

  var renderPdf = function() {
    process.chdir(__dirname + '/' + objectSocket.id); // todo: error check
    const render = spawn('lualatex',
      ['--shell-escape', '-interaction=nonstopmode', 'test.tex']);
    var output = '';

    render.stderr.on('data', (data) => {
      console.log(data);
      output = output + 'error: ' + data + '\n';
    });

    render.on('close', (code) => {
      console.log('lualatex exited with code ' + code);
      if (code === 0) {
        renderImage();
      } else {
        objectSocket.emit('error', {
          'status': 'error',
          'log': output
        });
      }
    });
    // console.log('finished, moving out of ' + process.cwd());
    process.chdir(__dirname);
  };

  var renderImage = function() {
    process.chdir(__dirname + '/' + objectSocket.id); // todo: error check
    var pdf_file = 'test.pdf';
    const image_render = spawn('convert', ['-density', '300', pdf_file, '-quality', '90', 'test.png']);
    var output = '';

    image_render.stderr.on('data', (data) => {
      console.log(data);
      output = output + 'error: ' + data + '\n';
    });

    image_render.on('close', (code) => {
      console.log('image render process exited with code ' + code);
      if (code === 0) {
        objectSocket.emit('image', {
          'status': 'done'
        });
      } else {
        objectSocket.emit('error', {
          'status': 'error',
          'log': output
        });
      }
    });
    console.log('finished, moving out of ' + process.cwd());
    process.chdir(__dirname);
  };

  var renderAudio = function() {
    process.chdir(__dirname + '/' + objectSocket.id); // todo: error check
    var gabc_file = 'example.gabc';
    const midi_convert = spawn(__dirname + '/gabctk/gabctk.py', ['-o', 'test.mid', gabc_file]);
    var output = '';

    midi_convert.stderr.on('data', (data) => {
      console.log(data);
      output = output + 'error: ' + data + '\n';
    });

    midi_convert.on('close', (code) => {
      console.log('gabctk process exited with code ' + code);
      if (code === 0) {
        convertAudio();
      } else {
        objectSocket.emit('error', {
          'status': 'error',
          'log': output
        });
      }
    });
    process.chdir(__dirname);
  };

  var convertAudio = function() {
    process.chdir(__dirname + '/' + objectSocket.id); // todo: error check
    var midi_file = 'test.mid';
    const wav_convert = spawn('timidity', ['-Ow', '-o', 'test.wav', midi_file]);
    var output = '';

    wav_convert.stderr.on('data', (data) => {
      console.log(data);
      output = output + 'error: ' + data + '\n';
    });

    wav_convert.on('close', (code) => {
      console.log('timidity process exited with code ' + code);
      if (code === 0) {
        objectSocket.emit('audio', {
          'status':'done'
        });
      } else {
        objectSocket.emit('error', {
          'status': 'error',
          'log': output
        });
      }
    });
    process.chdir(__dirname);
  };

});
