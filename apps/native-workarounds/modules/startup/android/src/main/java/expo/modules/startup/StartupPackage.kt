package expo.modules.startup

import android.app.Application
import android.content.Context
import android.util.Log
import expo.modules.core.BasePackage
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Autolinking finds this package because the module carries an
 * expo-module.config.json; the Gradle plugin puts the class into the generated
 * package list that ApplicationLifecycleDispatcher reads. Nothing edits
 * MainApplication, and nothing here has to be registered by hand.
 */
class StartupPackage : BasePackage() {
  override fun createApplicationLifecycleListeners(
    context: Context,
  ): List<ApplicationLifecycleListener> = listOf(StartupLifecycleListener(context))

  override fun createReactActivityLifecycleListeners(
    activityContext: Context,
  ): List<ReactActivityLifecycleListener> = listOf(StartupActivityListener())
}

/** Runs in Application.onCreate, before the JS engine starts. */
class StartupLifecycleListener(private val context: Context) : ApplicationLifecycleListener {
  override fun onCreate(application: Application) {
    // The value comes from android.strings in workspace.config.ts, which is the
    // documented channel for configuration native startup code needs: it is a
    // string resource by the time this runs, so there is no bridge to wait for.
    val value = context.getString(R.string.startup_value)
    Log.i(TAG, "application onCreate, configured with: " + value)
  }

  companion object {
    const val TAG = "expo-native-config"
  }
}

/** Runs in the React activity's onCreate, after the application listener. */
class StartupActivityListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: android.app.Activity, savedInstanceState: android.os.Bundle?) {
    Log.i(StartupLifecycleListener.TAG, "react activity onCreate")
  }
}
