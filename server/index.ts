import { createApp } from './app.js';
import { appConfig } from './config.js';

const app = createApp();

app.listen(appConfig.port, () => {
  console.log(`AI dApp Builder backend listening on http://localhost:${appConfig.port}`);
});
