var path = require('path');
var assembler = require('../../../assembler');

assembler.exec({
  args: process.argv.slice(2),
  //this trumps `require.main.filename` because it works with symlinks
  basePath: path.dirname(process.argv[1]),
  assemble: [
    {
      type: 'css',
      path: 'css',
      input: 'css/all.css',
      output: 'css/all.min.css'
    },
    {
      type: 'scripts',
      path: 'scripts',
      input: 'scripts/all.js',
      output: 'scripts/all.min.js'
    },
    {
      type: 'scripts',
      path: 'scripts/lib/ext',
      input: 'scripts/lib/ext/all.js',
      output: 'scripts/lib/ext/all.min.js'
    }
  ]
});
