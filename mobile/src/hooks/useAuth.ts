import { useAuthStore } from '../stores/authStore';
import { useSocketStore } from '../stores/socketStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import { unregisterPushNotifications } from '../services';

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
    await unregisterPushNotifications();
    disconnect();
    // Re-evaluate onboarding for whoever logs in next on this device
    // (existing users auto-skip via the subjects check).
    useOnboardingStore.getState().reset();
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
