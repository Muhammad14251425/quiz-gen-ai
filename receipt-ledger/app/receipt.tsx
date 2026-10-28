import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../src/components/ui';
import { t } from '../src/i18n';

/** Full-screen receipt viewer. Pinch to zoom on iOS; double-tap toggles 2.5× zoom on Android. */
export default function ReceiptViewer() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [aspect, setAspect] = useState(0.5);
  const [zoomed, setZoomed] = useState(false);
  const [lastTap, setLastTap] = useState(0);

  const fitWidth = Math.min(width, height * aspect);
  const imgWidth = zoomed ? width * 2.5 : fitWidth;
  const image = (
    <Pressable
      accessibilityRole="image"
      accessibilityLabel={t('tx.receipt')}
      onPress={() => {
        const now = Date.now();
        if (now - lastTap < 300) setZoomed((z) => !z);
        setLastTap(now);
      }}
    >
      <Image
        source={{ uri }}
        style={{ width: imgWidth, height: imgWidth / aspect }}
        contentFit="contain"
        onLoad={(e) => e.source.width && setAspect(e.source.width / e.source.height)}
      />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {Platform.OS === 'ios' ? (
        <ScrollView
          maximumZoomScale={5}
          minimumZoomScale={1}
          centerContent
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {image}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <ScrollView horizontal contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            {image}
          </ScrollView>
        </ScrollView>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.done')}
        onPress={() => router.back()}
        style={{
          position: 'absolute',
          top: insets.top + 8,
          right: 16,
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: 'rgba(0,0,0,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="close" color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
