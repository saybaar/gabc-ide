# gabc-ide
Simple web interface for gabc development

This is a web interface for [Gregorio](http://gregorio-project.github.io/index.html), a typesetting system for Gregorian chant using the gabc language. 

Run `npm install` and `node index.js` in the project directory to get started. 

For the server to function correctly, quite a bit of additional software is also required: 
* [Gregorio](http://gregorio-project.github.io/installation.html) and a LuaLaTeX installation that will support it; the following packages are sufficient on Ubuntu 16.04: 
```
texlive-luatex
texlive-latex-base
texlive-latex-extra
texlive-xetex
```
* [imagemagick](https://packages.ubuntu.com/imagemagick) for its "convert" command, which may require [editing its policy file](https://stackoverflow.com/questions/52861946/imagemagick-not-authorized-to-convert-pdf-to-an-image)
* [gabctk](https://github.com/jperon/gabctk), which should be cloned inside the gabc-ide directory, and Python 3
* [timidity](https://packages.ubuntu.com/timidity)

By default, the server listens on port 8080 and the client uses a websocket to connect to it at http://localhost:8080. To change that (e.g. to deploy to a remote server), change the line in static/index.html 
```
  var objectSocket = io.connect("http://localhost:8080/");
```
to connect to the server's actual IP address. 
