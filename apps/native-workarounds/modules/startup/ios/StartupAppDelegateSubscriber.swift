import ExpoModulesCore

/**
 Registered through `apple.appDelegateSubscribers` in expo-module.config.json.
 Expo calls it from the real AppDelegate, so this file is app-owned source that
 survives a clean prebuild — unlike an edit to the generated AppDelegate.
 */
public class StartupAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Configuration for iOS startup code belongs in the Info.plist, which the
    // Expo app config owns through `ios.infoPlist`.
    let configured = Bundle.main.object(forInfoDictionaryKey: "StartupValue") as? String
    NSLog("[expo-native-config] didFinishLaunching, configured with: %@", configured ?? "unset")
    return true
  }

  public func applicationDidBecomeActive(_ application: UIApplication) {
    NSLog("[expo-native-config] applicationDidBecomeActive")
  }
}
