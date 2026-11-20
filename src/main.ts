import './style.css';
import { App } from './ui/screens';
import { DEFAULT_THEME, applyTheme } from './ui/themes';

applyTheme(DEFAULT_THEME);
new App(document.getElementById('app') as HTMLElement);
