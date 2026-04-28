import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import './styles.css';

if (window.location.hash === '#overlay') {
  document.documentElement.classList.add('overlay-route');
  document.body.classList.add('overlay-route');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
