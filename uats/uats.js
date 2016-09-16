var mockery = require('mockery');
var request = require('request-json');
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
  context('GET', () => {
    var capturedEvent = {};
    var testLambda = {};

    before(() => {
      console.log("entry");
      mockery.enable({
        warnOnReplace: false,
        warnOnUnregistered: false,
        useCleanCache: true
      });

      mockery.registerMock('./test.js', testLambda);
      return startApiGateway();
    })

    after(() => {
      console.log("exit");
      server.close();
    })

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

    it('Passes Through Response Body if no transform specified', done => {
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

    it('Transforms Response can clear body', done => {
      testLambda.handler = (event, context, callback) => {
        callback(null, { location:  "test" });
      };

      get('salesforce/')
        .then(data => {
          expect(data.res.get('location')).to.equal('test');
          expect(data.body).to.deep.equal({});
        })
        .done(done);
    });
    });
  })
});

var get = resource => {
  var deferred = Q.defer();

  var client = request.createClient('http://localhost:8080/');
  client.get('salesforce/tokens?env=test', (err, res, body) => {
    if ( err ) {
      deferred.reject(err);
    } else {
      deferred.resolve({res: res, body: body})
    }
  });
  return deferred.promise;
}
