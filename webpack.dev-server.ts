import SingleSignOn from 'eve-sso';

import 'dotenv/config';
// Get the client ID and secret from the Eve developers section
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
// The callback URI as defined in the application in the developers section
const CALLBACK_URI = process.env.CALLBACK_URI || 'http://localhost:8080/';

console.log(process.env);

const ESI_SCOPES =
    process.env.ESI_SCOPES ||
    'esi-assets.read_assets.v1 esi-markets.structure_markets.v1 esi-markets.read_character_orders.v1 esi-characters.read_notifications.v1';

const sso = new SingleSignOn(CLIENT_ID, CLIENT_SECRET, CALLBACK_URI, {
    endpoint: 'https://login.eveonline.com', // optional, defaults to this
    //   userAgent: 'my-user-agent' // optional
});
import type { Configuration as DevServerConfiguration } from 'webpack-dev-server';

const devServer: DevServerConfiguration = {
    static: './dist',
    open: false,
    setupMiddlewares: (middlewares, devServer) => {
        if (!devServer) {
            throw new Error('webpack-dev-server is not defined');
        }
        const { app } = devServer;
        const scopes = ESI_SCOPES.split(' ');

        app.get('/login-url', function (req, res) {
            // TODO: generate and check state
            res.send(sso.getRedirectUrl('my-state', scopes));
        });

        app.get('/sso', async function (req, res) {
            const { code, refresh } = req.query;
            // NOTE: usually you'd want to validate the state (ctx.query.state) as well

            // Swap the one-time code for an access token
            console.log(code);
            console.log(refresh);
            try {
                const info = await sso.getAccessToken(code.toString(), refresh ? true : false);

                // Usually you'd want to store the access token
                // as well as the refresh token
                console.log('info', info);

                // Do whatever, for example, redirect to user page
                res.json(info);
            } catch (error) {
                console.error(error);
                console.error('Error!');
            }
        });
        return middlewares;
    },
};
export default devServer;
