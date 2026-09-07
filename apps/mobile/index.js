/** Giriş nöqtəsi — React Native CLI (Expo deyil). */
import { AppRegistry } from 'react-native';
import { App } from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
