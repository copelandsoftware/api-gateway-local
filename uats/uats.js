var mockery = require('mockery');
var request = require('request-json');

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

    it('properly sets up examples', done => {
      var apigateway = require('../index.js');
      apigateway(require('./test.js'), './uats/example.yaml', 8080, (err, res) => {
          testLambda.handler = (event, context, callback) => {
            console.log(context);
            callback(null, null);
          };

          var client = request.createClient('http://localhost:8080/');
          client.get('salesforce/tokens', (err, res, body) => {
            done();
          });
      })
    });
  })
});
