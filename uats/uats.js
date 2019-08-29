var mockery = require('mockery');
var request = require('request-json');
var http = require('request');
var expect = require('chai').expect;
var Q = require('q');

var server = {};
var startApiGateway = () => {
  var apigateway = require('../index.js');
  return apigateway(require('./test.js'), './uats/example.yaml', 8080)
    .then(httpServer => {
      server = httpServer;
    })
}

context('uats', () => {
  var capturedEvent = {};
  var testLambda = {};

  before(() => {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true
    });

    mockery.registerMock('./test.js', testLambda);
    return startApiGateway();
  })

  after(() => {
    server.close();
  })

  context('DELETE', () => {
    it('Transforms body to include Query Params', done => {
      testLambda.handler = (event, context, callback) => {
        callback();
      };

      del('/clients/1234')
        .then(data => {
          expect(data.body).to.equal('')
        })
        .done(done);
    });
  });

  context('GET', () => {
    it('Transforms body to include Query Params', done => {
      testLambda.handler = (event, context, callback) => {
        capturedEvent = event;
        callback(null, null);
      };
      get('salesforce/tokens/?env=test')
        .then(data => {
          console.log(capturedEvent);
          expect(capturedEvent.env).to.equal('test');
        })
        .done(done);
    });

    it('Transforms body to include Paramters from Request Uri', done => {
      testLambda.handler = (event, context, callback) => {
        capturedEvent = event;
        callback(null, null);
      };
      get('salesforce/test/tokens')
        .then(data => {
          console.log(capturedEvent);
          expect(capturedEvent.env).to.equal('test');
        })
        .done(done);
    });

    it('Transforms Payload to add properties', done => {
      testLambda.handler = (event, context, callback) => {
        capturedEvent = event;
        callback(null, null);
      };

      get('salesforce/tokens/?env=test')
        .then(data => {
          expect(capturedEvent.action).to.equal('get');
        })
        .done(done);
    });

    it('Transforms Status Code', done => {
      testLambda.handler = (event, context, callback) => {
        callback('Not Found', null);
      };

      get('salesforce/tokens/?env=test')
        .then(data => {
          console.log(data.res.statusCode);
          expect(data.res.statusCode).to.equal(404);
        })
        .done(done);
    })

    it('Wraps error responses in errorMessage per Amazon if responseTemplate not specified', done => {
      testLambda.handler = (event, context, callback) => {
        callback({ token:  "test" }, null);
      };

      get('salesforce/tokens/?env=test')
        .then(data => {
          var obj = { token: "test" }
          expect(data.body).to.deep.equal({errorMessage: obj.toString() });
        })
        .done(done);
    })

    it('does not wrap success responses when no template specified', done => {
      testLambda.handler = (event, context, callback) => {
        callback(null, { token:  "test" });
      };

      get('salesforce/tokens/?env=test')
        .then(data => {
          expect(data.body).to.deep.equal({ token: "test" });
        })
        .done(done);
    })

    it('Transforms Response can clear body', done => {
      testLambda.handler = (event, context, callback) => {
        callback(null, { location:  "test" });
      };

      get('salesforce/')
        .then(data => {
          expect(data.body).to.deep.equal({});
        })
        .done(done);
    });

    it('Transforms Response Add Headers', done => {
      testLambda.handler = (event, context, callback) => {
        callback(null, { location:  "test" });
      };

      get('salesforce/')
        .then(data => {
          expect(data.res.headers['location']).to.equal('test');
          expect(data.body).to.deep.equal({});
        })
        .done(done);
    });

    it('handles JSON Posts', done => {
      testLambda.handler = (event, context, callback) => {
        console.log(event);
        if ( event.payload ) {
          return callback(null, event);
        }
        callback('Forbidden')
      }

      post('/login', { username: 'test' })
        .then(data => {
          expect(data.res.statusCode).to.equal(302);
          expect(data.body).to.deep.equal({ payload: { username: 'test' }})
        })
        .done(done);
    })

    it('handles WWW Form Encoded  Posts', done => {
      testLambda.handler = (event, context, callback) => {
        console.log(event);
        if ( event.form_data ) {
          return callback(null, event);
        }
        callback('Forbidden')
      }

      post_form('/login', { username: 'test' })
        .then(data => {
          expect(data.res.statusCode).to.equal(302);
          // request does not auto parse the body for us.  request-json (above test) does.
          expect(JSON.parse(data.body)).to.deep.equal({ form_data: "username=test" })
        })
        .done(done);
    })

    it('wraps errorMessage before processing template', done => {
      testLambda.handler = (event, context, callback) => {
        callback('invalid', null);
      }

      post('/login', { username: 'test' })
        .then(data => {
          expect(data.res.statusCode).to.equal(400);
          expect(data.body).to.deep.equal({ error: 'invalid' })
        })
        .done(done);
    });
  });
});

var post_form = (resource, data) => {
  var deferred = Q.defer();
  var base = 'http://localhost:8080'
  http.post({ url: `${base}${resource}`, form: data}, (err, res, body) => {
    if ( err ) {
      deferred.reject(err);
    } else {
      deferred.resolve({res: res, body: body})
    }
  })
  return deferred.promise;
}

var post = (resource, data) => {
  var deferred = Q.defer();
  var client = request.createClient('http://localhost:8080/');
  client.post(resource, data, (err, res, body) => {
    if ( err ) {
      deferred.reject(err);
    } else {
      deferred.resolve({res: res, body: body})
    }
  });
  return deferred.promise;
}

var get = resource => {
  var deferred = Q.defer();

  var client = request.createClient('http://localhost:8080/');
  client.get(resource, (err, res, body) => {
    if ( err ) {
      deferred.reject(err);
    } else {
      deferred.resolve({res: res, body: body})
    }
  });
  return deferred.promise;
}

var del = resource => {
  var deferred = Q.defer();

  var client = request.createClient('http://localhost:8080/');
  client.delete(resource, (err, res, body) => {
    if ( err ) {
      deferred.reject(err);
    } else {
      deferred.resolve({res: res, body: body})
    }
  });
  return deferred.promise;
}
