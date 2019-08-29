var gulp  = require('gulp');
var mocha = require('gulp-mocha');
var log = require('fancy-log');

gulp.task('default', function(callback) {
  return gulp.src(['uats/*.js'], { read: false })
    .pipe(mocha({ ui: 'bdd', reporter: 'spec', growl: 'true', timeout: 1000}))
    .on('error', log)
    .once('end', function () {
      callback()
    });
});
