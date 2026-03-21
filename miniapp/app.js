const config = require("./config");

App({
  globalData: {
    appName: config.appName,
    apiBaseUrl: config.apiBaseUrl,
  },
});
