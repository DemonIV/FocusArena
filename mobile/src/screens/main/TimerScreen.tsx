import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTimer } from '../../hooks';
import { TimerCircle } from '../../components';
import { timerService } from '../../services';
import { formatDuration } from '../../utils/formatTime';

const PRESET_DURATIONS = [15, 25, 45, 60, 90];

export function TimerScreen() {
  const timer = useTimer();
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>();

  const subjectsQ = useQuery({
    queryKey: ['subjects'],
    queryFn: () => timerService.getSubjects(),
  });

  const subjects = subjectsQ.data ?? [];
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  const handleStart = useCallback(async () => {
    try {
      await timer.start(selectedDuration, selectedSubjectId);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not start timer');
    }
  }, [selectedDuration, selectedSubjectId, timer]);

  const handleStop = useCallback(async () => {
    Alert.alert(
      'End Session?',
      'Your progress will be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await timer.stop();
              if (result) {
                Alert.alert(
                  '✅ Session Complete',
                  `+${result.xpEarned} XP earned!\n${formatDuration(result.durationMinutes)} focused`,
                );
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not end session');
            }
          },
        },
      ],
    );
  }, [timer]);

  const renderIdle = () => (
    <View style={styles.idleArea}>
      {/* Duration Picker */}
      <Text style={styles.sectionLabel}>Duration</Text>
      <View style={styles.durationRow}>
        {PRESET_DURATIONS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.durationBtn, d === selectedDuration && styles.durationBtnActive]}
            onPress={() => setSelectedDuration(d)}
            activeOpacity={0.7}
          >
            <Text style={[styles.durationBtnText, d === selectedDuration && styles.durationBtnTextActive]}>
              {d}m
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subject Picker */}
      <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Subject (optional)</Text>
      <TouchableOpacity
        style={styles.subjectPicker}
        onPress={() => setSubjectModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.subjectPickerText}>
          {selectedSubject ? `📚 ${selectedSubject.name}` : '+ Add Subject'}
        </Text>
        {selectedSubjectId && (
          <TouchableOpacity
            onPress={() => setSelectedSubjectId(undefined)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearSubject}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Start Button */}
      <TouchableOpacity
        style={[styles.actionBtn, styles.startBtn]}
        onPress={handleStart}
        disabled={timer.isLoading}
        activeOpacity={0.85}
      >
        {timer.isLoading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.actionBtnText}>▶  Start Session</Text>
        }
      </TouchableOpacity>
    </View>
  );

  const renderActive = () => (
    <View style={styles.activeArea}>
      {/* Subject label */}
      {selectedSubject && (
        <Text style={styles.subjectLabel}>📚 {selectedSubject.name}</Text>
      )}

      {/* Controls */}
      <View style={styles.controlsRow}>
        {timer.isPaused ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.resumeBtn]}
            onPress={timer.resume}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnText}>▶  Resume</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, styles.pauseBtn]}
            onPress={timer.pause}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnText}>⏸  Pause</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionBtn, styles.stopBtn]}
          onPress={handleStop}
          activeOpacity={0.85}
        >
          <Text style={styles.actionBtnText}>■  End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Circle */}
        <View style={styles.circleArea}>
          <TimerCircle
            progress={timer.progress}
            remainingMs={timer.remainingMs}
            isActive={timer.isActive}
            isPaused={timer.isPaused}
          />
        </View>

        {timer.isActive ? renderActive() : renderIdle()}
      </ScrollView>

      {/* Subject Selection Modal */}
      <Modal
        visible={subjectModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSubjectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Subject</Text>

            {subjectsQ.isLoading
              ? <ActivityIndicator color="#00d2ff" style={{ marginVertical: 20 }} />
              : (
                <FlatList
                  data={subjects}
                  keyExtractor={(s) => s.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.subjectItem,
                        item.id === selectedSubjectId && styles.subjectItemActive,
                      ]}
                      onPress={() => {
                        setSelectedSubjectId(item.id);
                        setSubjectModalVisible(false);
                      }}
                    >
                      <View style={[styles.subjectDot, { backgroundColor: item.color ?? '#00d2ff' }]} />
                      <Text style={styles.subjectItemText}>{item.name}</Text>
                      {item.id === selectedSubjectId && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>No subjects yet.</Text>
                  }
                  style={{ maxHeight: 320 }}
                />
              )
            }

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setSubjectModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
    alignItems: 'center',
  },

  circleArea: {
    marginBottom: 48,
  },

  sectionLabel: {
    alignSelf: 'flex-start',
    color: '#8a8a9a',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Idle
  idleArea: { width: '100%' },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  durationBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#16213e',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  durationBtnActive: {
    backgroundColor: '#0f3460',
    borderColor: '#00d2ff',
  },
  durationBtnText: { color: '#8a8a9a', fontWeight: '600' },
  durationBtnTextActive: { color: '#00d2ff' },

  subjectPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16213e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#0f3460',
    marginBottom: 4,
  },
  subjectPickerText: { color: '#8a8a9a', fontSize: 15 },
  clearSubject: { color: '#e94560', fontSize: 16 },

  actionBtn: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  startBtn: { backgroundColor: '#00d2ff', marginTop: 32 },

  // Active
  activeArea: { width: '100%' },
  subjectLabel: {
    color: '#00d2ff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  controlsRow: { flexDirection: 'row', gap: 12 },
  pauseBtn: { backgroundColor: '#16213e', borderWidth: 1, borderColor: '#00d2ff' },
  resumeBtn: { backgroundColor: '#00d2ff' },
  stopBtn: { backgroundColor: '#e94560' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#16213e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  subjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
    gap: 12,
  },
  subjectItemActive: { opacity: 1 },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  subjectItemText: { flex: 1, color: '#fff', fontSize: 15 },
  checkmark: { color: '#00d2ff', fontSize: 16 },
  emptyText: { color: '#8a8a9a', textAlign: 'center', marginVertical: 16 },
  modalClose: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#0f3460',
    borderRadius: 12,
  },
  modalCloseText: { color: '#8a8a9a', fontSize: 15 },
});
