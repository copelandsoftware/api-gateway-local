var mockery = require('mockery');
var request = require('request-json');
var expect = require('chai').expect;

var startApiGateway = () => {
  var apigateway = require('../index.js');
  return apigateway(require('./test.js'), './uats/example.yaml', 8080)
}

context('uats', () => {
  context('GET', () => {

    var testLambda = {};

    beforeEach(() => {
      mockery.enable({
        warnOnReplace: false,
        warnOnUnregistered: false,
        useCleanCache: true
      });

      mockery.registerMock('./test.js', testLambda);
    })

    it('Transforms Query Strings at the end of the Request Uri', done => {
      testLambda.handler = (event, context, callback) => {
        console.log(event.env);
        expect(event.env).to.equal('test');
        callback(null, null);
      };

      startApiGateway()
        .then( () => {
          var client = request.createClient('http://localhost:8080/');
          client.get('salesforce/tokens?env=test', (err, res, body) => {
            console.log(body);
            done();
          });
        })
    });
  })
});
