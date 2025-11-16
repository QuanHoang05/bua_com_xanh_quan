module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
  plugins: [
    // Plugin này cần thiết để xử lý các hàm async/await trong test
    "@babel/plugin-transform-runtime",
  ],
};
