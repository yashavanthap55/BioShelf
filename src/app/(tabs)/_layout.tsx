import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { GlassTabBar } from '@/presentation/components/GlassTabBar';
import { useServices } from '@/presentation/hooks/useAppServices';

export default function TabLayout() {
  const { inventory } = useServices();

  // Expiry is date-based: re-evaluate when the app returns to the foreground
  // in case the day rolled over.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void inventory.refresh();
    });
    return () => subscription.remove();
  }, [inventory]);

  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <GlassTabBar />
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="inventory" href="/inventory" />
        <TabTrigger name="alerts" href="/alerts" />
        <TabTrigger name="settings" href="/settings" />
      </TabList>
    </Tabs>
  );
}
