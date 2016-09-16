var gulp  = require('gulp');
var mocha = require('gulp-mocha');
var gutil = require('gulp-util');

gulp.task('default', () => {
  gulp.watch(['src/**', 'test/**, uats/**'], ['uats']);
});

gulp.task('uats', function(callback) {
  gulp.src(['uats/*.js'], { read: false })
    .pipe(mocha({ ui: 'bdd', reporter: 'spec', growl: 'true', timeout: 15000}))
    .on('error', gutil.log)
    .once('end', function () {
      process.exit();
    });
});
