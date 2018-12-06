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
express.static.mime.define({
  'text/plain': ['gabc','tex']
});
server.use(express.static('static'));

server.get('/:guid/gen.pdf', function(req, res) {
  res.status(200);
  res.type('application/pdf');
  res.set('Cache-Control', 'private, max-age=0, no-cache, no-store');
  res.sendFile(__dirname + '/temp/' + req.params.guid + '/gen.pdf');
});

server.get('/:guid/gen.png', function(req, res) {
  res.status(200);
  res.type('image/png');
  res.set('Cache-Control', 'private, max-age=0, no-cache, no-store');
  res.sendFile(__dirname + '/temp/' + req.params.guid + '/gen.png');
});

server.get('/:guid/gen.wav', function(req, res) {
  res.status(200);
  res.type('audio/wav');
  res.set('Cache-Control', 'private, max-age=0, no-cache, no-store');
  res.sendFile(__dirname + '/temp/' + req.params.guid + '/gen.wav');
});

io.on('connection', function(objectSocket) {
  var newdir = __dirname + '/temp/' + objectSocket.id;
  fs.mkdir(newdir, (err) => {
    if (err && err.code != 'EEXIST') {
      throw err;
    }
    fs.copyFileSync(__dirname + '/static/gen.tex', newdir + '/gen.tex');
  });

  objectSocket.on('disconnect', function() {
    fs.remove(__dirname + '/temp/' + objectSocket.id, function() {
      console.log('removed directory /temp/' + objectSocket.id);
    })
  });

  objectSocket.on('gen', function(objectData) {
    copyGABC(objectData.gabc);
    renderPdf();
    renderAudio();
  });

  var errorEvent = function(source, log) {
    objectSocket.emit('foobar', {
      'source': source,
      'log': log
    });
  };

  var copyGABC = function(gabc) {
    process.chdir(__dirname + '/temp/' + objectSocket.id); // todo: error check
    var gabc_file = 'input.gabc';
    try {
      fs.writeFileSync(gabc_file, gabc);
    } catch (error) {
      throw (error);
    }
    console.log('wrote some GABC');
    process.chdir(__dirname);
  };

  var renderPdf = function() {
    process.chdir(__dirname + '/temp/' + objectSocket.id); // todo: error check
    const render = spawn('lualatex',
      ['--shell-escape', '-interaction=nonstopmode', 'gen.tex']);
    var output = '';

    render.stderr.on('data', (data) => {
      output = output + 'error: ' + data + '\n';
    });

    render.on('close', (code) => {
      console.log('lualatex exited with code ' + code);
      if (code === 0) {
        renderImage();
      } else {
        errorEvent('lualatex', output);
      }
    });
    process.chdir(__dirname);
  };

  var renderImage = function() {
    process.chdir(__dirname + '/temp/' + objectSocket.id); // todo: error check
    var pdf_file = 'gen.pdf';
    const image_render = spawn('convert', ['-density', '300', pdf_file, '-quality', '90', 'gen.png']);
    var output = '';

    image_render.stderr.on('data', (data) => {
      output = output + 'error: ' + data + '\n';
    });

    image_render.on('close', (code) => {
      console.log('convert process exited with code ' + code);
      if (code === 0) {
        objectSocket.emit('image', {
          'status': 'done'
        });
      } else {
        errorEvent('convert', output);
      }
    });
    process.chdir(__dirname);
  };

  var renderAudio = function() {
    process.chdir(__dirname + '/temp/' + objectSocket.id); // todo: error check
    var gabc_file = 'input.gabc';
    const midi_convert = spawn(__dirname + '/gabctk/gabctk.py', ['-o', 'gen.mid', gabc_file]);
    var output = '';

    midi_convert.stderr.on('data', (data) => {
      output = output + 'error: ' + data + '\n';
    });

    midi_convert.on('close', (code) => {
      console.log('gabctk process exited with code ' + code);
      if (code === 0) {
        convertAudio();
      } else {
        errorEvent('gabctk', output);
      }
    });
    process.chdir(__dirname);
  };

  var convertAudio = function() {
    process.chdir(__dirname + '/temp/' + objectSocket.id); // todo: error check
    var midi_file = 'gen.mid';
    const wav_convert = spawn('timidity', ['-Ow', '-o', 'gen.wav', midi_file]);
    var output = '';

    wav_convert.stderr.on('data', (data) => {
      output = output + 'error: ' + data + '\n';
    });

    wav_convert.on('close', (code) => {
      console.log('timidity process exited with code ' + code);
      if (code === 0) {
        objectSocket.emit('audio', {
          'status': 'done'
        });
      } else {
        errorEvent('timidity', output);
      }
    });
    process.chdir(__dirname);
  };
});
