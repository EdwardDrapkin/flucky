module.exports = {
    entry: "./index.js",
    output: {
        path: "dist",
        filename: "index.js",
        libraryTarget: "umd"
    },
    externals: [
        "react",
    ],
    module: {
        loaders: [
            {
                test: /\.jsx?$/,
                exclude: /(node_modules|bower_components)/,
                loader: 'babel-loader', // 'babel-loader' is also a legal name to reference
                query: {
                    presets: ['es2015', 'react', 'stage-0']
                }
            }
        ]
    }
};
