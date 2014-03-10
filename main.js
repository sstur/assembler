/*global global, process, require, module, exports */
(function() {
  "use strict";
  var fs = require('fs');
  var path = require('path');
  var util = require('util');

  var cleanCSS = require('clean-css');
  var uglifyJS = require('uglify-js');

  var CSS_INCLUDE = /@import(\s+)(url\(".+?"\)|".+?");/g;

  var handlers = {
    css: function(opts, mappath) {
      console.log('Loading CSS files...');

      var source = fs.readFileSync(mappath(opts.input), 'utf8');

      source = source.replace(CSS_INCLUDE, function(line) {
        var path = line.match(/"(.+?)"/)[1];
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

    views: function(opts, mappath) {
      console.log('Loading Views...');
      var fileList = fs.readdirSync(mappath(opts.path));

      var views = {};
      fileList.forEach(function(name) {
        //todo: don't hard-code the extension here
        if (name.match(/\.html$/i)) {
          console.log(opts.path + '/' + name);
          var source = fs.readFileSync(mappath(opts.path, name), 'utf8');
          name = name.slice(0, -5);
          views[name] = source;
        }
      });
      var source = JSON.stringify(views);
      source = opts.outputTmpl.replace('[[DATA]]', source);
      fs.writeFileSync(mappath(opts.output), source, 'utf8');

      console.log('Done.\n');
    },

    scripts: function(opts, mappath) {
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
    if (config) {
      //handle usage as a module
      var args = config.args ? parseArgs(config.args) : [];
    } else {
      //handle usage from terminal/command line
      args = parseArgs(process.argv.slice(2));
    }
    if (args.configPath) {
      var configPath = path.join(process.cwd(), args.configPath);
    } else {
      configPath = path.join(path.dirname(process.argv[1]), args.configPath);
    }
    if (!configPath.match(/\.json$/)) {
      configPath = path.join(configPath, 'build-conf.json');
    }
    //basePath is the location in which the config file lives
    var basePath = path.dirname(configPath);
    config = fs.readFileSync(path.join(args.configPath, 'build-conf.json'), 'utf8');
    config = JSON.parse(config);

    //var mappath = path.join.bind(path, basePath);
    var mappath = function() {
      var paths = Array.prototype.slice.call(arguments);
      paths.unshift(basePath);
      return path.join.apply(path, paths);
    };

    config.assemble.forEach(function(opts) {
      util._extend(opts, args);
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


  function parseArgs(allArgs) {
    //parse arguments as true/false flags
    var args = {}, configPath;
    allArgs.forEach(function(arg) {
      if (arg.charAt(0) == '-') {
        arg = arg.replace(/^-+/, '');
        //camel-case
        arg = arg.replace(/-(.)/g, function(_, ch) {
          return ch.toUpperCase();
        });
        args[arg] = true;
      } else {
        configPath = arg;
      }
    });
    args.configPath = configPath;
    return args;
  }

})();