import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Auth0Provider
      domain="dev-tcizcdzuftlsdihd.ca.auth0.com"
      clientId="d99Oz8RiDUR5wuYjcHmqLwaBQvlx4o2X"
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: 'https://jobboard-api',
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>,
);
