Pod::Spec.new do |s|
  s.name           = 'Startup'
  s.version        = '0.1.0'
  s.summary        = 'App-owned startup hooks'
  s.description    = 'Runs app-owned code at launch through Expo lifecycle hooks.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
