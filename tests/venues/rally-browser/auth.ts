export const useAuthState = () => ({ isAuthenticated: new URLSearchParams(window.location.search).get('signedIn') === '1' });
