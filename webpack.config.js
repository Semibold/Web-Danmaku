const path = require("path");
const rimraf = require("rimraf");
const webpack = require("webpack");
const shell = require("shell-env");
const git = require("git-rev-sync");
const TerserPlugin = require("terser-webpack-plugin");
const EventHooksPlugin = require("event-hooks-webpack-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

const manifest = require("./package.json");

const shellEnv = Object(shell.sync());
const webpackPath = path.resolve(__dirname, "dist/webpack");
const releasePath = path.resolve(__dirname, "dist/release");

/**
 * @readonly
 * @desc Webpack/Custom Command Line Interface
 */
class CustomDefaultConfig {
    static noop() {
        // nonfeasance
    }

    static get argv() {
        return {
            mode: "production",
            devtool: false,
        };
    }

    static get env() {
        return {
            // Custom environment variables
        };
    }

    constructor(envProxy, argvProxy) {
        this.envProxy = envProxy;
        this.argvProxy = argvProxy;
        this.lastCompiled = new Date().toISOString();
    }

    get production() {
        return this.argvProxy.mode === "production";
    }

    get outputPath() {
        return this.production ? releasePath : webpackPath;
    }
}

/**
 * @desc Webpack Config
 */
module.exports = function(_env = {}, _argv = {}) {
    const env = new Proxy(CustomDefaultConfig.env, {
        get(target, key, receiver) {
            if (_env[key] != null) return _env[key];
            return Reflect.get(target, key, receiver);
        },
    });
    const argv = new Proxy(CustomDefaultConfig.argv, {
        get(target, key, receiver) {
            if (_argv[key] != null) return _argv[key];
            return Reflect.get(target, key, receiver);
        },
    });
    const config = new CustomDefaultConfig(env, argv);
    const filename = manifest.name;
    const preamble = `/*! @preserve ${filename}: ${manifest.version}-${git.short()} (${config.lastCompiled}) */`;

    console.log(`webpack mode: ${argv.mode}, git revision: ${git.short()}, current branch: ${git.branch()}`);

    return {
        mode: argv.mode,
        entry: {
            [filename]: ["./src/danmaku.ts"],
        },
        devtool: argv.devtool,
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: [
                        {
                            loader: "ts-loader",
                            options: {
                                compilerOptions: {
                                    module: "esnext",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        devServer: {
            compress: true,
            overlay: true,
            publicPath: "/dist/webpack/",
            host: "localhost",
            port: 8443,
            open: true,
            openPage: "./demo/index.html",
            headers: {
                "X-Custom-Server": "webpack-dev-server",
            },
        },
        output: {
            path: config.outputPath,
            filename: "[name].js",
            libraryTarget: "umd",
        },
        resolve: {
            extensions: [".tsx", ".ts", ".jsx", ".js"],
        },
        plugins: [
            new webpack.ProgressPlugin(shellEnv["CI"] ? CustomDefaultConfig.noop : null),
            new webpack.DefinePlugin({
                __X_METADATA__: JSON.stringify({
                    name: filename,
                    version: manifest.version,
                    revision: git.short(),
                    lastCompiled: config.lastCompiled,
                }),
                DEBUG: !config.production,
            }),
            new EventHooksPlugin({
                environment() {
                    rimraf.sync(config.outputPath);
                },
            }),
            new BundleAnalyzerPlugin({
                logLevel: "warn",
                reportFilename: `${filename}.report.html`,
                analyzerMode: config.production ? "static" : "disabled",
                openAnalyzer: false,
            }),
        ],
        optimization: {
            minimizer: [
                new TerserPlugin({
                    sourceMap: Boolean(argv.devtool),
                    extractComments: false,
                    cache: true,
                    parallel: true,
                    terserOptions: {
                        ecma: 5,
                        compress: {
                            drop_console: false,
                            drop_debugger: true,
                        },
                        output: {
                            /**
                             * @desc escape Unicode characters in strings and regexps
                             *       (affects directives with non-ascii characters becoming invalid)
                             */
                            ascii_only: false,
                            preamble: preamble,
                        },
                    },
                }),
            ],
        },
        node: false,
    };
};
