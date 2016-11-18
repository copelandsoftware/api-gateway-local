var parser = require('swagger-parser');
var express = require('express');
var fs = require('fs');
var Q = require('q');
var app = express();
var mappingTemplate = require("api-gateway-mapping-template");

function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low + 1) + low);
}

var context = {
  done: (err, obj) => { throw new Error('Using Context Succeed/Fail are Deprecated when using NodeJS 4.3 on Lambda'); },

  success: (obj) => { done(null, obj); },

  fail: (err) => { done(err, null); }
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

var buildEventFromRequestTemplate = (path, req, method, contentType) => {
  var requestTemplates = method['x-amazon-apigateway-integration'].requestTemplates;
  var templates = requestTemplates[contentType] || requestTemplates['application/json'];
  return JSON.parse(mappingTemplate({
    template: templates,
    payload: req.rawBody,
    params: {
      header: req.headers,
      path: req.params,
      querystring: req.query
    },
    context: {
      resourcePath: path,
      httpMethod: req.method
    }
  }));
}

var transformStatus = (body, method) => {
  var responses = method['x-amazon-apigateway-integration'].responses;
  var statusCode = null;
  Object.keys(responses).forEach(response => {
    var result = new RegExp(response).test(body)
    if ( result ) {
      statusCode = responses[response];
    }
  });

  return statusCode ? statusCode : responses.default;
}

Object.byString = function(o, s) {
  s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
  s = s.replace(/^\./, '');           // strip a leading dot
  var a = s.split('.');
  for (var i = 0, n = a.length; i < n; ++i) {
    var k = a[i];
    if (k in o) {
      o = o[k];
    } else {
      return;
    }
  }
  return o;
}

var transformResponseParameters = (res, status, body) => {
  if ( status.responseParameters ) {
    var response = {
      integration: {
        response:  {
          body: body
        }
      }
    };
    Object.keys(status.responseParameters).forEach(param => {
      var value = Object.byString(response, status.responseParameters[param]);
      if ( value && param.toLowerCase().indexOf('header') !== -1 ) {
        var params = param.split('.');
        var headerName = params[params.length - 1];
        res.set(headerName, value);
      }
    })
  }
}

var transformResponse = (res, method, body, contentType, isError) => {
  var status = transformStatus(body, method);

  transformResponseParameters(res, status, body);
  res.set('Content-Type', 'application/json');

  if (isError) {
    if ( typeof body === 'object' ) {
      body = body.toString()
    }
    body = { errorMessage: body };
  }

  if ( status.responseTemplates ) {
    console.log(body);
    body = JSON.parse(mappingTemplate({
      template: status.responseTemplates[contentType] || status.responseTemplates['application/json'],
      payload: body instanceof Object ? JSON.stringify(body) : body
    }));
  }

  res.status(status.statusCode).send(body);
}

var addAndHandleRequest = (path, verb, method, lambda) => {
  const route = expressify_path(path);
  app[verb.toLowerCase()](route, (req, res) => {
    var contentType = req.headers['content-type'] || 'application/json';
    console.log('handling event');
    var event = buildEventFromRequestTemplate(path, req, method, contentType);

    Q.ninvoke(lambda, 'handler', event, context)
      .then(body => {
        transformResponse(res, method, body, contentType);
      })
      .catch(err => {
        transformResponse(res, method, err, contentType, true);
      });
  });
}

module.exports = (lambda, swaggerFile, port, callback) => {
  var deferred = Q.defer();
  const listenPort = port ? port : randomInt(9000, 10000);

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

          addAndHandleRequest(path, verb, curPath[verb], lambda);
        })
      })
      var httpServer = app.listen(listenPort, () => {
        httpServer.port = listenPort;
        deferred.resolve(httpServer);
      });
    })
    .catch(err => {
      deferred.reject(new Error(err));
    })

  return deferred.promise;
}
