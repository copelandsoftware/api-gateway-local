var parser = require('swagger-parser');
var express = require('express');
var fs = require('fs');
var Q = require('q');
var app = express();
var mappingTemplate = require("api-gateway-mapping-template");

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

var buildEventFromRequestTemplate = (req, method) => {
  var templates = method['x-amazon-apigateway-integration'].requestTemplates['application/json'];
  return JSON.parse(mappingTemplate({
    template: templates,
    payload: req.rawBody,
    params: {
      header: req.headers,
      path: req.params,
      querystring: req.query
    }
  }));
}

var transformStatus = (body, method) => {
  var responses = method['x-amazon-apigateway-integration'].responses;
  var statusCode = null;
  Object.keys(responses).forEach(response => {
    var result = new RegExp(response).test(body)
    if ( result ) {
      console.log(`Found Matching Status Code:  ${responses[response].statusCode}`)
      statusCode = responses[response];
    }
  });

  return statusCode ? statusCode : responses.default;
}

var transformResponse = (res, method, body) => {
  var status = transformStatus(body, method);
  if ( status.responseTemplates ) {
    body = JSON.parse(mappingTemplate({
      template: status.responseTemplates['application/json'],
      payload: body
    }));
  }
  res.status(status.statusCode).json(body);
}

var addAndHandleRequest = (route, verb, method, lambda) => {
  app[verb.toLowerCase()](route, (req, res) => {
    var lambdaName = parseLambdaName(method);
    if ( __dirname.indexOf(lambdaName) <= -1 ) {
      throw new Error('Invoked API that is not part of current lambda project')
    }

    var event = buildEventFromRequestTemplate(req, method);

    Q.ninvoke(lambda, 'handler', event, context)
      .then(body => {
        transformResponse(res, method, body);
      })
      .catch(err => {
        transformResponse(res, method, err);
      });
  });
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
        Object.keys(curPath).forEach(verb => {
          route = expressify_path(path);
          console.log(`${verb} ${route}`)

          addAndHandleRequest(route, verb, curPath[verb], lambda);
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
