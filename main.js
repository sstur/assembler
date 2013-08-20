/*global global, process, require */
(function() {
  "use strict";
  var fs = require('fs');
  var path = require('path');
  var workingDir = global.workingDirectory || process.cwd();

  var opts = global.opts || JSON.parse(fs.readFileSync(path.join(workingDir, 'build-conf.json'), 'utf8'));

  //load arguments as yes/no opts
  process.argv.slice(1).forEach(function(arg) {
    if (arg.charAt(0) == '-') {
      //camel-case args
      arg = arg.slice(1).replace(/-(.)/g, function(_, ch) {
        return ch.toUpperCase();
      });
      opts[arg] = true;
    }
  });

  if (opts.cssInput) {
    console.log('Loading CSS files...');
    var cleanCSS = require('clean-css');

    var source = fs.readFileSync(mappath(opts.cssInput), 'utf8');

    source = source.replace(/@import url\("(.+?)"\);/g, function(line, path) {
      console.log(opts.cssPath + '/' + path);
      //css "includes" are specified relative to current path
      return fs.readFileSync(mappath(opts.cssPath, path), 'utf8');
    });

    console.log('\nAssembling' + (opts.noMinify ? '' : ' and Minifying') + ' CSS...');
    if (!opts.noMinify) {
      //use clean-css for minification
      source = cleanCSS.process(source, {keepSpecialComments: 0});
    }
    fs.writeFileSync(mappath(opts.cssOutput), source, 'utf8');
    console.log('Done.\n');
  }


  if (opts.viewsPath) {
    console.log('Loading Views...');
    var fileList = fs.readdirSync(mappath(opts.viewsPath));

    var views = {};
    fileList.forEach(function(name) {
      //todo: don't hard-code the ext here
      if (name.match(/\.html$/i)) {
        console.log(opts.viewsPath + '/' + name);
        var source = fs.readFileSync(mappath(opts.viewsPath, name), 'utf8');
        name = name.slice(0, -5);
        views[name] = source;
      }
    });
    source = 'var ' + opts.viewsVariable + ' = ' + JSON.stringify(views) + ';';
    fs.writeFileSync(mappath(opts.viewsOutput), source, 'utf8');

    console.log('Done.\n');
  }


  if (opts.scriptsPath) {
    console.log('Loading JS files...');
    var uglifyJS = require('uglify-js');

    source = fs.readFileSync(mappath(opts.scriptsInput), 'utf8');

    var files = [];
    source.replace(/src="(.+?)"/g, function(line, scriptPath) {
      //ensure leading slash
      scriptPath = scriptPath.replace(/^\/?/, '/');
      //ensure leading and trailing slash
      var prefix = '/' + opts.scriptsPath.replace(/^\/|\/$/g, '') + '/';
      var index = scriptPath.indexOf(prefix);
      if (index >= 0) {
        scriptPath = scriptPath.slice(index + prefix.length);
        console.log(prefix.slice(1) + scriptPath);
        files.push(scriptPath);
      }
    });

    console.log('\nAssembling' + (opts.noMinify ? '' : ' and Minifying') + ' JS...');

    if (opts.noMinify) {
      //combine without minification
      files.forEach(function(file, i) {
        files[i] = fs.readFileSync(mappath(opts.scriptsPath, file), 'utf8');
      });
      fs.writeFileSync(mappath(opts.scriptsOutput), files.join('\n'), 'utf8');
    } else {
      //use uglifyjs for minifcation
      process.chdir(mappath(opts.scriptsPath));
      var sourceMapPath = opts.scriptsOutput + '.map';
      var sourceMapFilename = sourceMapPath.split('/').pop();
      var result = uglifyJS.minify(files, {
        outSourceMap: sourceMapFilename
      });
      fs.writeFileSync(mappath(opts.scriptsOutput), result.code + '\n//@ sourceMappingURL=' + sourceMapFilename, 'utf8');
      fs.writeFileSync(mappath(sourceMapPath), result.map, 'utf8');
      process.chdir(workingDir);
    }
    console.log('Done.\n');
  }


  function mappath() {
    var root = path.dirname(require.main.filename);
    var paths = Array.prototype.slice.call(arguments);
    paths.unshift(root);
    return path.join.apply(path, paths);
  }

})();