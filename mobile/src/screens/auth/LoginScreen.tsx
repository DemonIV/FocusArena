import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from '../../types';
import { useAuth } from '../../hooks';
import { LanguagePicker } from '../../components';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t('common.error'), t('auth.fillAllFields'));
      return;
    }
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      Alert.alert(t('auth.loginFailed'), err?.message ?? t('auth.invalidCredentials'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <Text style={styles.logoText}>🎯 StudySquad</Text>
          <Text style={styles.tagline}>{t('auth.tagline')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor="#4a4a6a"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#4a4a6a"
            secureTextEntry
            autoComplete="password"
          />

          <TouchableOpacity
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t('auth.signIn')}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <TouchableOpacity
          style={styles.switchRow}
          onPress={() => navigation.replace('Register')}
        >
          <Text style={styles.switchText}>
            {t('auth.noAccount')}{' '}
            <Text style={styles.switchLink}>{t('auth.createOne')}</Text>
          </Text>
        </TouchableOpacity>

        {/* Language picker */}
        <View style={styles.langRow}>
          <LanguagePicker />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 13,
    color: '#8a8a9a',
    marginTop: 6,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  form: { gap: 10 },
  fieldLabel: {
    fontSize: 13,
    color: '#8a8a9a',
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  btn: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  switchRow: {
    alignItems: 'center',
    marginTop: 32,
  },
  langRow: {
    marginTop: 28,
  },
  switchText: {
    color: '#8a8a9a',
    fontSize: 14,
  },
  switchLink: {
    color: '#00d2ff',
    fontWeight: '600',
  },
});
