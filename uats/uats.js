var mockery = require('mockery');
var request = require('request-json');
var expect = require('chai').expect;
var Q = require('q');

var startApiGateway = () => {
  var apigateway = require('../index.js');
  return apigateway(require('./test.js'), './uats/example.yaml', 8080)
}

context('uats', () => {
  context('GET', () => {

    var capturedEvent = {};
    var testLambda = {
      handler: (event, context, callback) => {
        capturedEvent = event;
        callback(null, null);
      }
    };

    beforeEach(() => {
      mockery.enable({
        warnOnReplace: false,
        warnOnUnregistered: false,
        useCleanCache: true
      });

      mockery.registerMock('./test.js', testLambda);
    })

    it('Transforms Query Strings at the end of the Request Uri', done => {
      var server = {};
      startApiGateway()
        .then( (httpServer) => {
          server = httpServer;
          return get('salesforce/tokens/?env=test');
        })
      .then( (response) => {
        expect(capturedEvent.env).to.equal('test');
      })
      .finally(() => {
        server.close();
      })
      .done(done);
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
