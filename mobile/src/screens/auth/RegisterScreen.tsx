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
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from '../../types';
import { useAuth } from '../../hooks';
import { LanguagePicker } from '../../components';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { register, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password) {
      Alert.alert(t('common.error'), t('auth.fillAllFields'));
      return;
    }
    if (password !== confirm) {
      Alert.alert(t('common.error'), t('auth.passwordsNoMatch'));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('common.error'), t('auth.passwordTooShort'));
      return;
    }
    try {
      await register(email.trim().toLowerCase(), password, username.trim());
    } catch (err: any) {
      Alert.alert(t('auth.registrationFailed'), err?.message ?? t('auth.somethingWrong'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoArea}>
          <Text style={styles.logoText}>🎯 StudySquad</Text>
          <Text style={styles.tagline}>{t('auth.joinTagline')}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>{t('auth.username')}</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder={t('auth.usernamePlaceholder')}
            placeholderTextColor="#4a4a6a"
            autoCapitalize="none"
            autoComplete="username-new"
          />

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
            placeholder={t('auth.passwordMinPlaceholder')}
            placeholderTextColor="#4a4a6a"
            secureTextEntry
            autoComplete="password-new"
          />

          <Text style={styles.fieldLabel}>{t('auth.confirmPassword')}</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder={t('auth.confirmPlaceholder')}
            placeholderTextColor="#4a4a6a"
            secureTextEntry
            autoComplete="password-new"
          />

          <TouchableOpacity
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t('auth.createAccount')}</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.switchRow}
          onPress={() => navigation.replace('Login')}
        >
          <Text style={styles.switchText}>
            {t('auth.haveAccount')}{' '}
            <Text style={styles.switchLink}>{t('auth.signInLink')}</Text>
          </Text>
        </TouchableOpacity>

        {/* Language picker */}
        <View style={styles.langRow}>
          <LanguagePicker />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingVertical: 48,
    justifyContent: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 30,
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
    marginTop: 28,
  },
  langRow: {
    marginTop: 24,
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
