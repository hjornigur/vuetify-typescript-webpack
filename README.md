### Generate/update ESI typescript client

Download ESI swagger schema
`curl -O "https://esi.evetech.net/_latest/swagger.json?datasource=tranquility" -o swagger.json`

Rename `swagger.json?datasource=tranquility` to `swagger.json`

`npx swagger-typescript-api -p ./swagger.json -o ./src -n esi.ts`

File `src/esi.ts` now contains ESI typescript client
