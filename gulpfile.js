var gulp  = require('gulp');
var mocha = require('gulp-mocha');
var gutil = require('gulp-util');

gulp.task('default', () => {
  gulp.watch(['./index.js', './uats/*.js'], ['uats']);
});

gulp.task('uats', function(callback) {
  gulp.src(['uats/*.js'], { read: false })
    .pipe(mocha({ ui: 'bdd', reporter: 'spec', growl: 'true', timeout: 1000}))
    .on('error', gutil.log)
});
