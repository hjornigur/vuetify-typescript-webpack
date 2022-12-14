import * as path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';
import type { Configuration } from 'webpack';
import 'webpack-dev-server';

const { VueLoaderPlugin } = require('vue-loader');

import devServer from './webpack.dev-server';

const config: Configuration = {
    mode: 'development',
    entry: {
        index: './src/main.ts',
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                use: 'vue-loader',
            },
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                options: { appendTsSuffixTo: [/\.vue$/] },
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.s(c|a)ss$/,
                use: [
                    'vue-style-loader',
                    'css-loader',
                    {
                        loader: 'sass-loader',
                        // Requires >= sass-loader@^8.0.0
                        options: {
                            implementation: require('sass'),
                            sassOptions: {
                                indentedSyntax: true, // optional
                            },
                        },
                    },
                ],
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
        new VueLoaderPlugin(),
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
