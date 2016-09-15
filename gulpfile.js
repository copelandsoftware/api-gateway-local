var gulp  = require('gulp');
var gls   = require('gulp-live-server');
var exec = require('child_process').exec;

gulp.task('default', () => {
  gulp.watch(['*'], ['test']);
});

gulp.task('test', () => {
  var server = gls.new('./example/app.js');
  server.start();
});
