import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '@/navigation/types';

const LINK = /^gezgin:\/\/([a-z]+)(?:\/(.+))?$/;

/**
 * Bildiriş deep link-lərini tətbiqdaxili keçidə çevirir.
 * Server `gezgin://post/:id`, `gezgin://user/:username`, `gezgin://badges`
 * göndərir (bax: API `NotificationsService`). Push (Sprint 9) eyni sxemi işlədəcək.
 */
export function useDeepLink(): (link: string | null | undefined) => boolean {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  return useCallback(
    (link) => {
      const match = link ? LINK.exec(link) : null;
      if (!match) return false;
      const [, kind, id] = match;

      if (kind === 'post' && id) navigation.navigate('PostDetail', { publicId: id });
      else if (kind === 'user' && id) navigation.navigate('UserProfile', { username: id });
      else if (kind === 'chat' && id) navigation.navigate('Chat', { publicId: id });
      else if (kind === 'badges') navigation.navigate('Badges');
      else if (kind === 'score') navigation.navigate('Score');
      else return false;
      return true;
    },
    [navigation],
  );
}
