import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installUiKit } from './ui/kit/install';
import './styles/global.css';

// Fonts, frames and the UI zoom are generated in code; build them before the
// first frame so nothing flashes in a fallback face.
installUiKit().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
