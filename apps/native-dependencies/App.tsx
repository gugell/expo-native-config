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
    setStatus(`Running on ${Platform.OS}. See the sample README for native verification steps.`);
  }
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>EXPO NATIVE WORKSPACE</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Native Dependencies
        </Text>
        <Text style={styles.body}>
          A local Swift package and CocoaPod are linked to the iOS app. Inspect the generated Xcode
          project and Podfile after prebuild.
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
