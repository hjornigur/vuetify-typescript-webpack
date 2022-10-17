import * as path from 'path';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';
import * as NodePolyfillPlugin from 'node-polyfill-webpack-plugin';
import type { Configuration } from 'webpack';
import 'webpack-dev-server';

import devServer from './webpack.dev-server';

const config: Configuration = {
    mode: 'development',
    entry: {
        index: './src/main.ts',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    devtool: 'inline-source-map',
    devServer,
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Development',
            hash: true,
            myPageHeader: 'The Best Deals',
            template: './src/index.html',
            inject: 'body',
        }),
        new NodePolyfillPlugin(),
    ],
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            // "tls": require.resolve('tls'),
            // "net": require.resolve('net'),
            tls: false,
            net: false,
            // "crypto-browserify": require.resolve('crypto-browserify'), //if you want to use this module also don't forget npm i crypto-browserify
            // setImmediate: require.resolve('setimmediate'),
            // "async": false
        },
    },
};

export default config;
