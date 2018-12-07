'use strict';

var express = require('express');
var process = require('process');
var socket = require('socket.io');
var fs = require('fs-extra');
const {
  spawn
} = require('child_process');

var server = express();
var io = socket(server.listen(8080));
// Serve all the files in the "static" folder, sending .gabc and .tex files as
// plain text
express.static.mime.define({
  'text/plain': ['gabc','tex']
});
server.use(express.static('static'));

// Serve generated temp files. These could use better validation/error handling.
// Cache-Control doesn't work reliably - best to add a timestamp in the request
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

server.get('/:guid/gen.mid', function(req, res) {
  res.status(200);
  res.type('audio/midi');
  res.set('Cache-Control', 'private, max-age=0, no-cache, no-store');
  res.sendFile(__dirname + '/temp/' + req.params.guid + '/gen.mid');
});

server.get('/:guid/gen.wav', function(req, res) {
  res.status(200);
  res.type('audio/wav');
  res.set('Cache-Control', 'private, max-age=0, no-cache, no-store');
  res.sendFile(__dirname + '/temp/' + req.params.guid + '/gen.wav');
});

io.on('connection', function(objectSocket) {
  // Create a new temp directory and copy gen.tex into it
  var newdir = __dirname + '/temp/' + objectSocket.id;
  fs.mkdir(newdir, (err) => {
    if (err && err.code != 'EEXIST') {
      throw err;
    }
    fs.copyFileSync(__dirname + '/static/gen.tex', newdir + '/gen.tex');
  });

  objectSocket.on('disconnect', function() {
    // Remove this socket's temp directory
    fs.remove(__dirname + '/temp/' + objectSocket.id, function() {
      console.log('removed directory /temp/' + objectSocket.id);
    })
  });

  // The client sends this event with body {gabc: <some gabc code>}
  objectSocket.on('gen', function(objectData) {
    copyGABC(objectData.gabc);
    renderPdf();
    renderAudio();
  });

  // Helper functions for error-handling. The log should probably be hidden in
  // production or sanitized (the client ignores it), but it's useful for debugging.
  var imageError = function(source, log) {
    objectSocket.emit('image-error', {
      'source': source,
      'log': log
    });
  };
  var audioError = function(source, log) {
    objectSocket.emit('audio-error', {
      'source': source,
      'log': log
    });
  };

  // Save the given text as input.gabc inside the temp file
  var copyGABC = function(gabc) {
    process.chdir(__dirname + '/temp/' + objectSocket.id); // todo: error check
    var gabc_file = 'input.gabc';
    try {
      // This needs to be synchronous so that renderPdf and renderAudio don't
      // run before the new input is written
      fs.writeFileSync(gabc_file, gabc);
    } catch (error) {
      // very thorough error handling
      throw (error);
    }
    console.log('wrote some GABC');
    process.chdir(__dirname);
  };

  // Run lualatex inside the temp directory; assumes gen.tex and input.gabc
  // are already there
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
        // carry on to convert to PNG file
        renderImage();
      } else {
        // abort and send an error message
        imageError('lualatex', output);
      }
    });
    process.chdir(__dirname);
  };

  // Run convert inside the temp directory; assumes gen.pdf is already there
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
        // let the client know the image is ready
        objectSocket.emit('image', {
          'status': 'done'
        });
      } else {
        // abort and sent an error message
        imageError('convert', output);
      }
    });
    process.chdir(__dirname);
  };

  // Run gabctk in the temp directory; assumes input.gabc is already there
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
        // carry on to convert to a WAV file
        convertAudio();
      } else {
        // abort and send an error
        audioError('gabctk', output);
      }
    });
    process.chdir(__dirname);
  };

  // run timidity in the temp directory; assumes gen.mid is already there
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
        // let the client know the audio is ready
        objectSocket.emit('audio', {
          'status': 'done'
        });
      } else {
        // abort and send an error message
        audioError('timidity', output);
      }
    });
    process.chdir(__dirname);
  };
});
