const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (_, argv) => {
  const config = {
    mode: argv.mode ? argv.mode : 'development',
    context: path.resolve(__dirname, 'src'),
    entry: {
      index: './index.tsx',
      'pdf.worker': 'pdfjs-dist/build/pdf.worker.entry',
    },
    // output: {
    //   filename: '[name].js',
    //   path: path.resolve(__dirname, 'dist'),
    // },
    plugins: [
      new HtmlWebpackPlugin({
        template: 'index.html',
      }),
    ],
    devServer: {
      // contentBase: path.resolve(__dirname, 'dist'),
      compress: true,
      port: 9000,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: ['babel-loader'],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
  };
  //   if (config.mode === 'production') {
  //     config.optimization = {
  //       minimize: true,
  //       minimizer: [new TerserPlugin()],
  //     };
  //   }
  return config;
};
