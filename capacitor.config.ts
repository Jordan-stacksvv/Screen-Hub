import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.screenhub.app',
  appName: 'Screenhub',
  webDir: 'dist',
  server: {
    url: 'https://screen-hub-eta.vercel.app',
    cleartext: false
  }
};

export default config;
