var parser = require('swagger-parser');
var express = require('express');
var fs = require('fs');
var Q = require('q');
var app = express();

var context = {
  done: (err, obj) => {
    throw new Error('Using Context Succeed/Fail are Deprecated when using NodeJS 4.3 on Lambda');
  },

  success: (obj) => {
    done(null, obj);
  },

  fail: (err) => {
    done(err, null);
  }
}

var expressify_path = path => {
  return path.split('/')
    .map( segment => {
      if ( /^{[a-zA-Z0-9._-]+}$/.test(segment) ) {
        return `:${segment.replace(/^{/, '').replace(/}$/, '')}`
      }
      return segment;
    })
    .join('/');
}

var parseLambdaName = (method) => {
  var lambdaUri = method['x-amazon-apigateway-integration'].uri;
  var lambdaName = lambdaUri.replace(/.*function:/, '').replace(/\/.*/, '');
  return lambdaName;
}

module.exports = (lambda, swaggerFile, port, callback) => {
  var deferred = Q.defer();

  app.use(function(req, res, next) {
    req.rawBody = '';
    req.setEncoding('utf8');
    req.on('data', function(chunk) { req.rawBody += chunk; });
    req.on('end', function() {
      next();
    });
  });

  parser.validate(swaggerFile)
    .then(swaggerDef => {
      Object.keys(swaggerDef.paths).forEach(path => {
        var curPath = swaggerDef.paths[path];
        Object.keys(curPath).forEach(method => {
          route = expressify_path(path);
          console.log(`${method} ${route}`)

          app[method.toLowerCase()](route, (req, res) => {
            var lambdaName = parseLambdaName(curPath[method]);
            if ( __dirname.indexOf(lambdaName) <= -1 ) {
              throw new Error('Invoked API that is not part of current lambda project')
            }

            Q.ninvoke(lambda, 'handler', null, context)
              .then(response => {
                res.end();
              })
              .catch(err => {
                res.end();
              });
          });
        })
      })
      var httpServer = app.listen(port, () => {
        deferred.resolve(httpServer);
      });
    })
  .catch(err => {
    deferred.reject(new Error(err));
  })

  return deferred.promise;
}
