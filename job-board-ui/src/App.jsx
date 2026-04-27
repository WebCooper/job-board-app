import { useAuth0 } from '@auth0/auth0-react';
import './App.css';

function App() {
  const {
    isLoading,
    isAuthenticated,
    error,
    loginWithRedirect: login,
    logout: auth0Logout,
    user,
  } = useAuth0();

  const signup = () => login({ authorizationParams: { screen_hint: 'signup' } });
  const logout = () =>
    auth0Logout({ logoutParams: { returnTo: window.location.origin } });

  if (isLoading) return <div className="app-loading">Loading...</div>;

  return isAuthenticated ? (
    <main className="auth-demo">
      <p className="status-line">Logged in as {user?.email}</p>
      <h1>User Profile</h1>
      <pre>{JSON.stringify(user, null, 2)}</pre>
      <button className="btn btn-primary" onClick={logout}>
        Logout
      </button>
    </main>
  ) : (
    <main className="auth-demo">
      <h1>Auth0 Login Test</h1>
      {error && <p className="error-text">Error: {error.message}</p>}
      <div className="button-row">
        <button className="btn btn-primary" onClick={signup}>
          Signup
        </button>
        <button className="btn btn-ghost" onClick={login}>
          Login
        </button>
      </div>
    </main>
  );
}

export default App;
