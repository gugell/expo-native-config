Pod::Spec.new do |s|
  s.name = 'WorkspaceGreeting'
  s.version = '1.0.0'
  s.summary = 'Local sample CocoaPod for Expo Native Workspace.'
  s.homepage = 'https://expo.dev'
  s.license = { :type => 'MIT', :file => 'LICENSE' }
  s.author = 'Expo Native Workspace contributors'
  s.source = { :path => '.' }
  s.platform = :ios, '15.0'
  s.swift_version = '5.9'
  s.source_files = 'Sources/**/*.swift'
end
