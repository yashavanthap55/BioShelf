import { useLocalSearchParams } from 'expo-router';

import { AssetFormScreen } from '@/presentation/screens/form/AssetFormScreen';

export default function AssetFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <AssetFormScreen id={id} />;
}
