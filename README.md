# Lockdrop cache server

This is a read-only server that stores and filters blockchain data for the lockdrop UI.
This is done to prevent any client-side errors for future lockdrops.

## Usage

This server application requires you to have an Inura project key in order to fetch lock events.
The API keys should be stored on the `.env` file.

```env
NODE_ENV=development
PORT=3000
INFURA_SECRETE=<your secrete>
INFURA_PROJ_ID=<your project ID>
```

```bash
# install dependencies
yarn

# start server
yarn start

# build mainnet Ethereum cache
yarn fetch:eth-main

# build Ropsten Ethereum cache
yarn fetch:eth-test

# build plasm mainnet claim request cache
yarn fetch:claims

# build cache for everything
yarn fetch:all
```
