import type { CapacitorConfig } from '@capacitor/cli';
import { BRAND } from './src/brand';

const config: CapacitorConfig = {
  appId: 'app.waymuse.student',
  appName: BRAND,
  webDir: 'dist',
};

export default config;
