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

    it('Transforms Query Strings at the end of the Request Uri', done => {
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
