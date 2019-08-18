
Description:

Building an API Gateway in AWS is rather simplistic.  One benefit of API Gateway, is that it can export the swagger definitions.  Other than using this definition for documentation, you can also use it to drive your integration tests with the implementing lambdas. 

Example:

```
const lambda     = require('../index.js');
```
```
const startApiGateway = () => apigateway(lambda, './swagger.yaml')
  .then(httpServer => {
    http.server = httpServer;
  });
```

```  
  before(() => {
    api.start();
    return startApiGateway();
  });
  ```

  Credits:

  Draws inspiration from: https://github.com/ToQoz/api-gateway-localdev