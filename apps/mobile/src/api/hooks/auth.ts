import { useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useAuth, type Session } from '@/store/auth';

interface RegisterInput {
  fullName: string;
  username: string;
  email: string;
  password: string;
}
interface LoginInput {
  identifier: string;
  password: string;
}

/** Qeydiyyat, giriş və qonaq rejimi eyni sessiya obyektini qaytarır. */
function useSessionMutation<TInput>(path: string) {
  const signIn = useAuth((s) => s.signIn);
  return useMutation({
    mutationFn: (body: TInput) => api<Session>(path, { method: 'POST', body }),
    onSuccess: (session) => signIn(session),
  });
}

export const useRegister = () => useSessionMutation<RegisterInput>('/auth/register');
export const useLogin = () => useSessionMutation<LoginInput>('/auth/login');
export const useGuestLogin = () => useSessionMutation<void>('/auth/guest');
export const useGoogleLogin = () => useSessionMutation<{ token: string }>('/auth/social/google');
export const useAppleLogin = () => useSessionMutation<{ token: string }>('/auth/social/apple');

export const useSendOtp = () =>
  useMutation({
    mutationFn: (body: { email: string; purpose: string }) =>
      api<{ sent: true; devCode?: string }>('/auth/otp/send', { method: 'POST', body }),
  });

export const useVerifyOtp = () =>
  useMutation({
    mutationFn: (body: { email: string; code: string; purpose: string }) =>
      api<{ verified: true }>('/auth/otp/verify', { method: 'POST', body }),
  });

export const useForgotPassword = () =>
  useMutation({
    mutationFn: (body: { email: string }) =>
      api<{ sent: true; devCode?: string }>('/auth/password/forgot', { method: 'POST', body }),
  });

export const useResetPassword = () =>
  useMutation({
    mutationFn: (body: { email: string; code: string; newPassword: string }) =>
      api<{ success: true }>('/auth/password/reset', { method: 'POST', body }),
  });

export function useLogout() {
  const { session, signOut } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (session?.refreshToken) {
        await api('/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken } }).catch(
          () => undefined, // serverdə ləğv olunmasa da lokal sessiya bağlanmalıdır
        );
      }
      await signOut();
    },
  });
}
