/// <reference types="@google/local-home-sdk" />

import App = smarthome.App;
import LocalExecutionApp from './LocalExecutionApp';

const localHomeSdk = new App('1.0.0');
const localApp = new LocalExecutionApp(localHomeSdk);
localHomeSdk
  .onIdentify(localApp.identifyHandler.bind(localApp))
  .onReachableDevices(localApp.reachableDevicesHandler.bind(localApp))
  .onExecute(localApp.executeHandler.bind(localApp))
  .listen()
  .then(() => console.log('Ready1'))
  .catch((e: Error) => console.error(e));