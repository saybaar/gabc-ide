# gabc-ide
Simple web interface for gabc development

This is a web interface for [Gregorio](http://gregorio-project.github.io/index.html), a typesetting system for Gregorian chant using the gabc language. 

To run it, make sure Node.js is installed

For the server to function, quite a bit of additional software is also required: 
* [Gregorio](http://gregorio-project.github.io/installation.html) and a LuaLaTeX installation that will support it; the following packages are sufficient on Ubuntu 16.04: 
```
texlive-luatex
texlive-latex-base
texlive-latex-extra
texlive-xetex
```
* ImageMagick for the "convert" command, which may require [editing its policy file](https://stackoverflow.com/questions/52861946/imagemagick-not-authorized-to-convert-pdf-to-an-image)
* [gabctk](https://github.com/jperon/gabctk), which should be cloned inside the gabc-ide directory, and Python 3 to run it
* timidity
