# Changelog

## [0.2.0-alpha.2](https://github.com/gugell/expo-native-config/compare/v0.2.0-alpha.1...v0.2.0-alpha.2) (2026-09-20)

### Features

* **ios:** four ways to include a target, including from a package ([#12](https://github.com/gugell/expo-native-config/issues/12)) ([816f239](https://github.com/gugell/expo-native-config/commit/816f2396a61e9d07bd92bd6edebe0aa828343d1e))

## [0.2.0-alpha.1](https://github.com/gugell/expo-native-config/compare/v0.2.0-alpha.0...v0.2.0-alpha.1) (2026-09-20)

### Bug Fixes

* **cli:** keep --json parseable, and stop dropping plugins silently ([#11](https://github.com/gugell/expo-native-config/issues/11)) ([b767e20](https://github.com/gugell/expo-native-config/commit/b767e20bf23daeb14c57e8542a40f76de77ce992))

## [0.2.0-alpha.0](https://github.com/gugell/expo-native-config/compare/v0.1.0...v0.2.0-alpha.0) (2026-09-20)

### Features

* **cli:** migrate an existing project, and step-by-step docs ([#9](https://github.com/gugell/expo-native-config/issues/9)) ([4b11566](https://github.com/gugell/expo-native-config/commit/4b1156673adff57839408cf8fd2f2ba8ac2b1576))
* **release:** publish prerelease channels from the Release workflow ([#10](https://github.com/gugell/expo-native-config/issues/10)) ([4a15757](https://github.com/gugell/expo-native-config/commit/4a157579d7d7ed1c0749365eaa4c58166f67a72b))

### Documentation

* show the before/after and the status, not just the pitch ([#8](https://github.com/gugell/expo-native-config/issues/8)) ([88ccd64](https://github.com/gugell/expo-native-config/commit/88ccd6424b0b23d91fc6a177c0dfc27c1a79246e))

## 0.1.0 (2026-09-19)

### ⚠ BREAKING CHANGES

* `android.permissions` is removed. Move the entries to
`expo.android.permissions` in your Expo app config; validation now says so
by name.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
* `ios.appDelegate` and `android.mainApplication` are
removed. Nothing is published yet, so no installed app carries them; a
config that declares either now fails validation with an unknown-key
error naming the field.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

### refactor

* drop android.permissions — the Expo config already owns it ([94ddf2e](https://github.com/gugell/expo-native-config/commit/94ddf2e905cea6d5da0dab457a202a33866a0bb7))
* drop entry-point injection and support Expo SDK 50 through 57 ([72b1ef7](https://github.com/gugell/expo-native-config/commit/72b1ef7ab5aea4cf33d96897481bfcd5b2b7a881))

### Features

* add constructors and named constants for manifest values ([b4abb73](https://github.com/gugell/expo-native-config/commit/b4abb7359e8d97ea3543759c454d0c5b2dfce63a))
* **android:** accept project and platform Gradle dependencies ([1cf5a19](https://github.com/gugell/expo-native-config/commit/1cf5a19a283fabffe4d93db90347a03f42e9bc35))
* **android:** declare manifest components, metadata and resources ([205c218](https://github.com/gugell/expo-native-config/commit/205c2189cd1465333aa6b29b31f4c4a7a25b6965))
* **android:** declare repositories, classpath, modules and defaultConfig ([d176d8f](https://github.com/gugell/expo-native-config/commit/d176d8fc260ecd1da4f937c6428e0f69b48cd094))
* bootstrap Expo native workspace CLI and verified sample apps ([6671578](https://github.com/gugell/expo-native-config/commit/66715780d4defd84d5b8b238295441610ff7c1e5))
* **cli:** warn about escape hatches and hide cleanup operations ([5448667](https://github.com/gugell/expo-native-config/commit/5448667e639d90d5c28f27e1654d90f675573f54))
* **core:** add copy, replace and block-removal file operations ([b185334](https://github.com/gugell/expo-native-config/commit/b185334064a20ad8ed1f80541464f4901820a022))
* expose scoped CocoaPods rules and preserve scheme names ([163e6ee](https://github.com/gugell/expo-native-config/commit/163e6ee2fcd13f91ee22a1c0d96f916ffc693eb8))
* expose the expanded native surface in the public schema ([b42696b](https://github.com/gugell/expo-native-config/commit/b42696bf83074023c7ba8ddcaad1b5a3dbbf2bc2))
* **init:** scaffold the Expo lifecycle hooks instead of editing entry points ([bbbd967](https://github.com/gugell/expo-native-config/commit/bbbd96702517c420c24cb31dc2b7273f2b51e647))
* inject app-owned lines into generated entry points ([cf69751](https://github.com/gugell/expo-native-config/commit/cf69751a0bd4881124d99025da15cc0e7f30fb8f))
* **ios:** add notification, intent, action and Safari extension targets ([d1df415](https://github.com/gugell/expo-native-config/commit/d1df4155e280e796140ee1735f9f95381a014805))
* **ios:** configure the host application target ([432bff2](https://github.com/gugell/expo-native-config/commit/432bff2b0517ddf24e293d625137ce34668d1256))
* **ios:** exclude autolinked modules and open a scoped Podfile hatch ([21c4c76](https://github.com/gugell/expo-native-config/commit/21c4c76ba127034a101828999ffe6af61dc3a237))
* **ios:** write Podfile.properties.json through Expo's own mod ([3b6d4b9](https://github.com/gugell/expo-native-config/commit/3b6d4b9f14655a3ff4cf58101d32416e14d85183))
* **samples:** add a sample for the workarounds apps hand-write ([1806cf7](https://github.com/gugell/expo-native-config/commit/1806cf792152b7ad7f0d5246627a05b0850c2baf))
* **samples:** demonstrate host-target and Gradle structure fields ([0dd8732](https://github.com/gugell/expo-native-config/commit/0dd8732563608eb4d8185da4637697b19f8d4208))
* **samples:** run app-owned code at launch through Expo's lifecycle hooks ([403d151](https://github.com/gugell/expo-native-config/commit/403d1516e61756a86cf71a1d8bb6eb46e7b4e130))
* support declarative app native configuration and local signing ([3199737](https://github.com/gugell/expo-native-config/commit/3199737e9eda27887ca7f97873c881f5198d1a01))
* support Expo SDK 57 and stop doctor blocking on a newer SDK ([891ceac](https://github.com/gugell/expo-native-config/commit/891ceac6c36f22769e5403c9df53626c6ab3f0cf))
* tell people where a change belongs, not just whether it parses ([89f1207](https://github.com/gugell/expo-native-config/commit/89f120746ccee938e8e18db44039c507818e07c6))

### Bug Fixes

* **ci:** check out LF everywhere and run the release script through bash ([f387d29](https://github.com/gugell/expo-native-config/commit/f387d29cf5e8a273ada990baeb9dde2cdf830290))
* **ci:** refresh the lockfile and fail locally when it drifts ([53bbdbe](https://github.com/gugell/expo-native-config/commit/53bbdbea635358ce9f3772b963c6b2559ca30909))
* **plugin:** guard double registration and resolve config-plugins via expo ([04ed63c](https://github.com/gugell/expo-native-config/commit/04ed63c0f3e8ecd7c5d8cc02855182fea8859ce5))
* **release:** compute the version with the same flags as the release ([f023715](https://github.com/gugell/expo-native-config/commit/f023715e06bf6701defe318622274bc241723c67))
* **release:** expand empty flag arrays safely under set -u ([134b7b3](https://github.com/gugell/expo-native-config/commit/134b7b391768e07621e772bc42ab4d8d764a832e))
* **release:** publish the version already in the manifest with --no-increment ([17a29a2](https://github.com/gugell/expo-native-config/commit/17a29a2c9c7346479c09856336af1c07934b994a))
* stop committing generated native output, and check for it ([12bac90](https://github.com/gugell/expo-native-config/commit/12bac907bdc249f826d665054bea558da68eded9))

### Documentation

* document the expanded surface and where a change belongs ([82bd094](https://github.com/gugell/expo-native-config/commit/82bd09428409bb1c4c9a4e5f1521dc5656cc101a))
* explain manifests and templates with complete recipes ([2413915](https://github.com/gugell/expo-native-config/commit/24139155aa96c18d77696e2ab8b99743ebd42eb2))
* lead the README with the before and after ([12da60c](https://github.com/gugell/expo-native-config/commit/12da60c374834251ba9707fcab33343a3e09ef43))
* record the release rehearsal on the real path ([9d6c109](https://github.com/gugell/expo-native-config/commit/9d6c10966ba291d8c16cbfcd36e0dc8fbf2ec475))
* record verified release rehearsal ([83e0dab](https://github.com/gugell/expo-native-config/commit/83e0dabc829692425ac790a77eefdf63f3783412))
* record what the expanded surface was actually verified against ([b84ea04](https://github.com/gugell/expo-native-config/commit/b84ea0427151739637945a296be73ee45955f9fc))
* require focused commits and a completed PR checklist ([b3a8532](https://github.com/gugell/expo-native-config/commit/b3a85325cf0e2f061f5cc4330ddabf9f5cf6f653))
* **skills:** teach the Expo mechanisms, not just this package's fields ([2dbe4bf](https://github.com/gugell/expo-native-config/commit/2dbe4bf708b86304afb58b7a21fdf71a7c53ab52))

Release notes are generated from conventional commits by release-it. This project has not been published yet.
