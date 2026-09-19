import { useState } from 'react';
import { Button, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';

const workarounds = [
  'Scoped CocoaPods build settings and a removed build phase',
  'Podfile properties, globals and a raw post_install hook',
  'A local Gradle module linked with project(…)',
  'Manifest meta-data, activity attributes and a removed receiver',
  'ABI filters, a forced dependency version and package visibility',
];

export default function App() {
  const [detail, setDetail] = useState('Inspect ios/ and android/ after prebuild.');
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>EXPO NATIVE WORKSPACE</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Native Workarounds
        </Text>
        <Text style={styles.body}>
          Each declaration in workspace.config.ts replaces a config plugin someone would otherwise
          hand-write. Nothing here is visible from JavaScript; the evidence is in the generated
          native projects.
        </Text>
        {workarounds.map((item) => (
          <Text key={item} style={styles.item}>
            • {item}
          </Text>
        ))}
        <Button
          title="What should I check?"
          onPress={() => {
            setDetail(
              Platform.OS === 'ios'
                ? 'ios/Podfile, ios/Podfile.properties.json and the pbxproj build settings.'
                : 'android/settings.gradle, app/build.gradle, AndroidManifest.xml and res/values.',
            );
          }}
        />
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {detail}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', backgroundColor: '#101827', padding: 24 },
  card: { backgroundColor: '#1d2a40', borderRadius: 20, padding: 24, gap: 12 },
  eyebrow: { color: '#8bdad2', fontSize: 12, letterSpacing: 2 },
  title: { color: '#ffffff', fontSize: 30, fontWeight: '700' },
  body: { color: '#d1dae7', fontSize: 16, lineHeight: 24 },
  item: { color: '#d1dae7', fontSize: 14, lineHeight: 20 },
  status: { color: '#8bdad2', fontSize: 14 },
});
