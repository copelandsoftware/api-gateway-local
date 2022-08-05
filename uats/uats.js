var mockery = require('mockery');
var request = require('request-json');
var http = require('request');
var expect = require('chai').expect;

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
    it('Transforms body to include Query Params', async () => {
      testLambda.handler = async (event) => {
        return ''
      };

      const res = await del('/clients/1234')
      expect(res.body).to.equal('')
    });
  });

  context('GET', () => {
    it('Transforms body to include Query Params', async () => {
      testLambda.handler = async (event) => {
        capturedEvent = event;
        return null
      };

      await get('salesforce/tokens/?env=test')

      expect(capturedEvent.env).to.equal('test');
    });

    it('Transforms body to include Paramters from Request Uri', async () => {
      testLambda.handler = async (event) => {
        capturedEvent = event;
        return null
      };


      await get('salesforce/test/tokens')

      expect(capturedEvent.env).to.equal('test');
    });

    it('Transforms Payload to add properties', async () => {
      testLambda.handler = async (event) => {
        capturedEvent = event;
        return null
      };

      await get('salesforce/tokens/?env=test')

      expect(capturedEvent.action).to.equal('get');
    });

    it('Transforms Status Code', async () => {
      const error = new Error('Not Found')

      testLambda.handler = async (event) => {
        throw error
      };

      const data = await get('salesforce/tokens/?env=test')

      expect(data.res.statusCode).to.equal(404);
    })

    it('Wraps error responses in errorMessage per Amazon if responseTemplate not specified', async () => {
      const error = new Error({ token: "test" })

      testLambda.handler = async (event) => {
        throw error
      };

      const data = await get('salesforce/tokens/?env=test')

      expect(data.body).to.deep.equal({ errorMessage: `${error}` });
    })

    it('does not wrap success responses when no template specified', async () => {
      testLambda.handler = async (event) => {
        return { token: "test" }
      };

      const data = await get('salesforce/tokens/?env=test')

      expect(data.body).to.deep.equal({ token: "test" });
    })

    it('Transforms Response can clear body', async () => {
      testLambda.handler = async (event) => {
        return { location: "test" }
      };

      const data = await get('salesforce/')

      expect(data.body).to.deep.equal({});
    });

    it('Transforms Response Add Headers', async () => {
      testLambda.handler = async (event) => {
        return { location: "test" }
      };

      const data = await get('salesforce/')

      expect(data.res.headers['location']).to.equal('test');
      expect(data.body).to.deep.equal({});
    });

    it('handles JSON Posts', async () => {
      testLambda.handler = async (event) => {
        if (event.payload) {
          return event
        }
        throw new Error('Forbidden')
      }

      const data = await post('/login', { username: 'test' })

      expect(data.res.statusCode).to.equal(302);
      expect(data.body).to.deep.equal({ payload: { username: 'test' } })

    })

    it('handles WWW Form Encoded  Posts', async () => {
      testLambda.handler = async (event) => {
        if (event.form_data) {
          return event;
        }

        throw new Error('Forbidden')
      }

      const data = await post_form('/login', { username: 'test' })

      expect(data.res.statusCode).to.equal(302);
      expect(JSON.parse(data.body)).to.deep.equal({ form_data: "username=test" });
    });

    it('wraps errorMessage before processing template', async () => {
      const error = new Error('invalid')
      
      testLambda.handler = async (event) => {
        throw error
      }

      const data = await post('/login', { username: 'test' })

      expect(data.res.statusCode).to.equal(400);
      expect(data.body).to.deep.equal({ error: `${error}` })   
    });
  });
});

var post_form = (resource, data) => {
  var base = 'http://localhost:8080'

  return new Promise((resolve, reject) => {
    http.post({ url: `${base}${resource}`, form: data }, (err, res, body) => {
      if (err) {
        reject(err);
      } else {
        resolve({ res: res, body: body })
      }
    })
  })
}

var post = (resource, data) => {
  var client = request.createClient('http://localhost:8080/');

  return new Promise((resolve, reject) => {
    client.post(resource, data, (err, res, body) => {
      if (err) {
        reject(err);
      } else {
        resolve({ res: res, body: body })
      }
    });
  })
}

var get = resource => {
  var client = request.createClient('http://localhost:8080/');

  return new Promise((resolve, reject) => {
    client.get(resource, (err, res, body) => {
      if (err) {
        reject(err);
      } else {
        resolve({ res: res, body: body })
      }
    });
  });
}

var del = resource => {
  var client = request.createClient('http://localhost:8080/');

  return new Promise((resolve, reject) => {
    client.delete(resource, (err, res, body) => {
      if (err) {
        reject(err);
      } else {
        resolve({ res: res, body: body })
      }
    });
  })
}
