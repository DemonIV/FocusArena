import { useAuthStore } from '../stores/authStore';
import { useSocketStore } from '../stores/socketStore';

export function useAuth() {
  const { user, isLoading, login, register, logout, accessToken } = useAuthStore();
  const { connect, disconnect } = useSocketStore();

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    const token = useAuthStore.getState().accessToken;
    if (token) connect(token);
  };

  const handleRegister = async (email: string, password: string, username: string) => {
    await register(email, password, username);
    const token = useAuthStore.getState().accessToken;
    if (token) connect(token);
  };

  const handleLogout = async () => {
    disconnect();
    await logout();
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !!accessToken,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
  };
}
