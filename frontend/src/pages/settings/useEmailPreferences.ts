/**
 * TanStack Query hook backing the Settings page's email notification preferences
 * section. It owns the load query, the optimistic save mutation (with rollback),
 * the test-email mutation, and the transient status message — preserving the exact
 * behavior the inline SettingsPage implementation had:
 *
 * - The load query uses `retry: false` so each load (initial mount or "Try again")
 *   is a single request, matching the hand-rolled loader the E2E contract relies on.
 * - Saves optimistically update the cache, roll back on failure, and apply the
 *   server's normalized response on success.
 * - Synchronous `useRef` guards block duplicate save / test-email submissions fired
 *   within the same tick (before `isLoading` re-renders), so a double click still
 *   results in a single request.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import {
  applyEmailPreferenceTiming,
  applyEmailPreferenceToggle,
  DEFAULT_EMAIL_PREFERENCES,
  fetchEmailPreferences,
  saveEmailPreferences,
  sendTestEmail,
  type EmailPreferences,
  type EmailPreferenceTimingKey,
  type EmailPreferenceToggleKey,
  type NotificationTiming,
} from './emailPreferencesData';

export interface EmailPreferenceMessage {
  type: 'success' | 'error';
  text: string;
}

export interface UseEmailPreferencesResult {
  preferences: EmailPreferences;
  isLoading: boolean;
  loadFailed: boolean;
  isSaving: boolean;
  isSendingTestEmail: boolean;
  message: EmailPreferenceMessage | null;
  reloadPreferences: () => void;
  togglePreference: (key: EmailPreferenceToggleKey) => void;
  changePreferenceTiming: (timingKey: EmailPreferenceTimingKey, timing: NotificationTiming) => void;
  sendTestEmail: () => void;
}

const SAVE_SUCCESS_MESSAGE_DURATION_MS = 3000;
const TEST_EMAIL_SUCCESS_MESSAGE_DURATION_MS = 5000;

export function useEmailPreferences(): UseEmailPreferencesResult {
  const queryClient = useQueryClient();

  const [message, setMessage] = useState<EmailPreferenceMessage | null>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const sendingTestEmailRef = useRef(false);

  const showMessage = useCallback((next: EmailPreferenceMessage | null, duration?: number) => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }

    setMessage(next);
    if (next && duration) {
      messageTimeoutRef.current = setTimeout(() => setMessage(null), duration);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  const preferencesQuery = useQuery({
    queryKey: queryKeys.emailPreferences,
    queryFn: fetchEmailPreferences,
    retry: false,
    onError: (error) => {
      logError('Failed to load email preferences:', error);
      showMessage({
        type: 'error',
        text: extractErrorMessage(error, 'Failed to load email preferences'),
      });
    },
  });

  const loadFailed = preferencesQuery.isError;
  const preferences = preferencesQuery.data ?? DEFAULT_EMAIL_PREFERENCES;

  const saveMutation = useMutation({
    mutationFn: saveEmailPreferences,
    onMutate: (newPreferences: EmailPreferences) => {
      const previousPreferences = queryClient.getQueryData<EmailPreferences>(
        queryKeys.emailPreferences,
      );
      // Optimistically reflect the change immediately.
      queryClient.setQueryData(queryKeys.emailPreferences, newPreferences);
      showMessage(null);
      return { previousPreferences };
    },
    onError: (error, _newPreferences, context) => {
      // Roll back to the pre-save snapshot.
      if (context?.previousPreferences) {
        queryClient.setQueryData(queryKeys.emailPreferences, context.previousPreferences);
      }
      showMessage({
        type: 'error',
        text: extractErrorMessage(error, 'Failed to save email preferences - changes reverted'),
      });
    },
    onSuccess: (savedPreferences) => {
      // Server confirmed; keep the normalized response.
      queryClient.setQueryData(queryKeys.emailPreferences, savedPreferences);
      showMessage(
        { type: 'success', text: 'Email preferences saved' },
        SAVE_SUCCESS_MESSAGE_DURATION_MS,
      );
    },
    onSettled: () => {
      savingRef.current = false;
    },
  });

  const persistPreferences = useCallback(
    (newPreferences: EmailPreferences) => {
      if (savingRef.current || preferencesQuery.isError) return;

      // Synchronous guard so a same-tick double submit only fires one request.
      savingRef.current = true;
      saveMutation.mutate(newPreferences);
    },
    [preferencesQuery.isError, saveMutation],
  );

  const togglePreference = useCallback(
    (key: EmailPreferenceToggleKey) => {
      persistPreferences(applyEmailPreferenceToggle(preferences, key));
    },
    [persistPreferences, preferences],
  );

  const changePreferenceTiming = useCallback(
    (timingKey: EmailPreferenceTimingKey, timing: NotificationTiming) => {
      persistPreferences(applyEmailPreferenceTiming(preferences, timingKey, timing));
    },
    [persistPreferences, preferences],
  );

  const testEmailMutation = useMutation({
    mutationFn: sendTestEmail,
    onSuccess: (result) => {
      showMessage(
        { type: 'success', text: `Test email sent to ${result.sentTo}` },
        TEST_EMAIL_SUCCESS_MESSAGE_DURATION_MS,
      );
    },
    onError: (error) => {
      showMessage({
        type: 'error',
        text: extractErrorMessage(error, 'Failed to send test email'),
      });
    },
    onSettled: () => {
      sendingTestEmailRef.current = false;
    },
  });

  const triggerSendTestEmail = useCallback(() => {
    if (sendingTestEmailRef.current) return;

    sendingTestEmailRef.current = true;
    showMessage(null);
    testEmailMutation.mutate();
  }, [showMessage, testEmailMutation]);

  const reloadPreferences = useCallback(() => {
    showMessage(null);
    void preferencesQuery.refetch();
  }, [preferencesQuery, showMessage]);

  return {
    preferences,
    isLoading: preferencesQuery.isLoading,
    loadFailed,
    isSaving: saveMutation.isLoading,
    isSendingTestEmail: testEmailMutation.isLoading,
    message,
    reloadPreferences,
    togglePreference,
    changePreferenceTiming,
    sendTestEmail: triggerSendTestEmail,
  };
}
