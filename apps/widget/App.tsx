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
    setStatus(`Running on ${Platform.OS}. Add the widget from the Home Screen.`);
  }
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>EXPO NATIVE WORKSPACE</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Home Screen Widget
        </Text>
        <Text style={styles.body}>
          Build the iOS app, then add Workspace Widget from the Home Screen widget gallery. The
          native widget shows a daily focus prompt.
        </Text>
        <Button
          title="Check platform"
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
