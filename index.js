var FS = require('fs')
var Path = require('path')
var mkdirp = require('mkdirp')
var compileToHTML = require('./lib/compile-to-html')

function SimpleHtmlPrecompiler (staticDir, paths, options) {
  this.staticDir = staticDir
  this.paths = paths
  this.options = options || {}
}

SimpleHtmlPrecompiler.prototype.apply = function (compiler) {
  var self = this
  compiler.plugin('after-emit', function (compilation, done) {
    function compileOne(outputPath) {
      return new Promise(function (resolve, reject) {
        compileToHTML(self.staticDir, outputPath, self.options, function (prerenderedHTML) {
          if (self.options.postProcessHtml) {
            prerenderedHTML = self.options.postProcessHtml({
              html: prerenderedHTML,
              route: outputPath
            })
          }
          var dest = Path.join(self.options.outputDir || self.staticDir, outputPath)
          var folder = Path.join(dest, '..')
          mkdirp(folder, function (error) {
            if (error) {
              return reject('Folder could not be created: ' + folder + '\n' + error)
            }
            var file = (dest === '/' ? 'index' : dest) + '.html'
            FS.writeFile(
              file,
              prerenderedHTML,
              function (error) {
                if (error) {
                  return reject('Could not write file: ' + file + '\n' + error)
                }
                resolve()
              }
            )
          })
        })
      })
    }

    var superbatch = null
    var batch = []
    for (var i = 0; i < self.paths.length; i++) {
      batch.push(self.paths[i])

      if (batch.length === 4 || i === self.paths.length - 1) {
        var startBatch = function (batch) {
          return function () {
            return Promise.all(batch.map(compileOne))
          }
        }
        if (superbatch) {
          superbatch = superbatch.then(startBatch(batch))
        } else {
          superbatch = startBatch(batch)()
        }
        batch = []
      }
    }

    superbatch
    .then(function () { done() })
    .catch(function (error) {
      // setTimeout prevents the Promise from swallowing the throw
      setTimeout(function () { throw error })
    })
  })
}

module.exports = SimpleHtmlPrecompiler
