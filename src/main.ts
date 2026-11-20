import './style.css';
import { App } from './ui/screens';
import { installThemeDefs } from './ui/themes';

installThemeDefs();
new App(document.getElementById('app') as HTMLElement);
