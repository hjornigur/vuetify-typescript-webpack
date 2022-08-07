const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");


const SingleSignOn = require('eve-sso').default;

// Get the client ID and secret from the Eve developers section
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
// The callback URI as defined in the application in the developers section
const CALLBACK_URI =  process.env.CALLBACK_URI || 'http://localhost:8080/';

const ESI_SCOPES = process.env.ESI_SCOPES || "esi-assets.read_assets.v1 esi-markets.structure_markets.v1 esi-markets.read_character_orders.v1 esi-characters.read_notifications.v1";

const sso = new SingleSignOn(CLIENT_ID, CLIENT_SECRET, CALLBACK_URI, {
  endpoint: 'https://login.eveonline.com', // optional, defaults to this
//   userAgent: 'my-user-agent' // optional
})

module.exports = {
    mode: 'development',
    entry: {
        index: './src/index.js'
    },
    devtool: 'inline-source-map',
    devServer: {
        contentBase: './dist',
        open: false,
        before: function(app) {
            const scopes = ESI_SCOPES.split(' ');

            app.get("/login-url", function(req, res) {
                // TODO: generate and check state
                res.send(sso.getRedirectUrl('my-state', scopes));
            });

            app.get("/sso", async function(req, res) {
                const { code, refresh } = req.query;
                // NOTE: usually you'd want to validate the state (ctx.query.state) as well
              
                // Swap the one-time code for an access token
                console.log(code)
                console.log(refresh)
                const info = await sso.getAccessToken(code, refresh);
              
                // Usually you'd want to store the access token
                // as well as the refresh token
                console.log('info', info)
                
                // Do whatever, for example, redirect to user page
                res.json(info);
            });
          },
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Development',
            hash: true,
            myPageHeader: 'The Best Deals',
            template: './src/index.html',
            inject: 'body'
        }),
        new NodePolyfillPlugin(),
    ],
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    resolve: {
        fallback: {
            // "tls": require.resolve('tls'),
            // "net": require.resolve('net'),
            "tls": false,
            "net": false
            // "crypto-browserify": require.resolve('crypto-browserify'), //if you want to use this module also don't forget npm i crypto-browserify 
            // setImmediate: require.resolve('setimmediate'),
            // "async": false
        }
    }
};