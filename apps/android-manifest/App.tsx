import { useState } from 'react';
import {
  Button,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function App() {
  const [status, setStatus] = useState('Ready to explore');
  async function inspect() {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      setStatus(`Camera permission: ${result}`);
      return;
    }
    setStatus(`Running on ${Platform.OS}. See the sample README for native verification steps.`);
  }
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>EXPO NATIVE WORKSPACE</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Android Manifest
        </Text>
        <Text style={styles.body}>
          Tap below to request camera permission. Camera hardware is declared optional, so
          installation remains possible on devices without a camera.
        </Text>
        <Button
          title="Request camera permission"
          onPress={() => {
            void inspect();
          }}
        />
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {status}
        </Text>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', backgroundColor: '#101827', padding: 24 },
  card: { backgroundColor: '#1d2a40', borderRadius: 20, padding: 24, gap: 20 },
  eyebrow: { color: '#8bdad2', fontSize: 12, letterSpacing: 2 },
  title: { color: '#ffffff', fontSize: 30, fontWeight: '700' },
  body: { color: '#d1dae7', fontSize: 17, lineHeight: 25 },
  status: { color: '#8bdad2', fontSize: 14 },
});
