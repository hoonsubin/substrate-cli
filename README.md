# Plasm Scripts

This is a multi-purpose CLI tool for quickly interacting with Plasm Network from ts-node.
This project was made to test and organize various features at a fast paste in both Plasm Network and Polkadot-js without having to create a UI.

By default, script calls from yarn will use the dotenv package, so if you want to access Ethereum blocks, you will need to provide your Infura credentials in the `.env` file.

```env
NODE_ENV=development
PORT=3000
INFURA_SECRETE=<your secrete>
INFURA_PROJ_ID=<your project ID>
```

## Project Structure

Everything that is directly related to the tool's functionality will be inside the `src/` folder.
`yarn start` will execute `index.ts`, which contains what ever script you imported inside the `cli/` folder.

- `cli/`: The main tool logic. Everything you want to execute should be in here.
- `data/`: Cached data, account data, any fixed peace of data will be placed in here, and it is recommended that all local data read/writes within a cli function points their directory to this folder.
- `helper/`: All utility functions that is used throughout different cli functions should be placed here.
- `model/`: Data models used internally and from external APIs should be defined here.
- `type/`: This is a special folder that contains the global type declarations, for example, importing `.csv` files as string within TypeScript.
