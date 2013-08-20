/*global global, process, require, module, exports */
(function() {
  "use strict";
  var fs = require('fs');
  var path = require('path');
  var util = require('util');

  var cleanCSS = require('clean-css');
  var uglifyJS = require('uglify-js');


  var handlers = {
    css: function(opts) {
      console.log('Loading CSS files...');

      var source = fs.readFileSync(mappath(opts.input), 'utf8');

      source = source.replace(/@import url\("(.+?)"\);/g, function(line, path) {
        console.log(opts.path + '/' + path);
        //css "includes" are specified relative to current path
        return fs.readFileSync(mappath(opts.path, path), 'utf8');
      });

      console.log('\nAssembling' + (opts.noMinify ? '' : ' and Minifying') + ' CSS...');
      if (!opts.noMinify) {
        //use clean-css for minification
        source = cleanCSS.process(source, {keepSpecialComments: 0});
      }
      fs.writeFileSync(mappath(opts.output), source, 'utf8');
      console.log('Done.\n');
    },

    views: function(opts) {
      console.log('Loading Views...');
      var fileList = fs.readdirSync(mappath(opts.path));

      var views = {};
      fileList.forEach(function(name) {
        //todo: don't hard-code the ext here
        if (name.match(/\.html$/i)) {
          console.log(opts.path + '/' + name);
          var source = fs.readFileSync(mappath(opts.path, name), 'utf8');
          name = name.slice(0, -5);
          views[name] = source;
        }
      });
      var source = 'var ' + opts.variable + ' = ' + JSON.stringify(views) + ';';
      fs.writeFileSync(mappath(opts.output), source, 'utf8');

      console.log('Done.\n');
    },

    scripts: function(opts) {
      console.log('Loading JS files...');

      var source = fs.readFileSync(mappath(opts.input), 'utf8');
      //todo: deprecate opts.path in favour of getting from input
      //var sourcePath = path.dirname(mappath(opts.input));

      var files = [];
      source.replace(/src="(.+?)"/g, function(line, scriptPath) {
        //ensure leading slash
        scriptPath = scriptPath.replace(/^\/?/, '/');
        //ensure leading and trailing slash
        var prefix = '/' + opts.path.replace(/^\/|\/$/g, '') + '/';
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
          files[i] = fs.readFileSync(mappath(opts.path, file), 'utf8');
        });
        fs.writeFileSync(mappath(opts.output), files.join('\n'), 'utf8');
      } else {
        //use uglifyjs for minifcation
        var cwd = process.cwd();
        process.chdir(mappath(opts.path));
        var sourceMapPath = opts.output + '.map';
        var sourceMapFilename = sourceMapPath.split('/').pop();
        var result = uglifyJS.minify(files, {
          outSourceMap: sourceMapFilename
        });
        fs.writeFileSync(mappath(opts.output), result.code + '\n//@ sourceMappingURL=' + sourceMapFilename, 'utf8');
        fs.writeFileSync(mappath(sourceMapPath), result.map, 'utf8');
        process.chdir(cwd);
      }
      console.log('Done.\n');
    }
  };

  //todo: if callback present, do async
  function exec(config, callback) {
    var basePath = config.basePath || path.dirname(process.argv[1]);

    if (!config) {
      var args = getArgs(basePath);
      config = fs.readFileSync(path.join(args.configPath, 'build-conf.json'), 'utf8');
      config = JSON.parse(config);
    }

    //var mappath = path.join.bind(path, basePath);
    var mappath = function() {
      var paths = Array.prototype.unshift.call(arguments);
      paths.unshift(basePath);
      return path.join.apply(path, paths);
    };

    config.assemble.forEach(function(opts) {
      if (args) util._extend(opts, args);
      var handler = handlers[opts.type];
      if (handler) {
        handler(opts, mappath);
      } else {
        throw new Error('Unrecognized assembly type: ' + opts.type);
      }
    });
  }

  //if being run directly vs required
  if (module === require.main) {
    exec();
  } else {
    exports.exec = exec;
  }


  function getArgs(basePath) {
    //load cmd line args as true/false flags
    var args = {}, configPath;
    process.argv.slice(1).forEach(function(arg) {
      if (arg.charAt(0) == '-') {
        arg = args.replace(/^-+/);
        //camel-case
        arg = arg.replace(/-(.)/g, function(_, ch) {
          return ch.toUpperCase();
        });
        args[arg] = true;
      } else {
        configPath = path.join(basePath, arg)
      }
    });

    args.configPath = (configPath == null) ? basePath : configPath;
    return args;
  }

})();