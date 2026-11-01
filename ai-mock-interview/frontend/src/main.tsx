import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';

async function prepareApp() {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    try {
      const { worker } = await import('./mocks/browser');
      await worker.start({
        onUnhandledRequest: 'bypass',
        serviceWorker: {
          url: '/mockServiceWorker.js',
        },
      });
      console.log('[MSW] Mock Service Worker started successfully.');
    } catch (err) {
      console.error('[MSW] Failed to initialize worker:', err);
    }
  }
}

prepareApp().then(() => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
});
