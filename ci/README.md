# Jenkins build setup

This repository uses a self-contained Jenkins pipeline at `Jenkinsfile/Cocos`.
It does not require the previous `cocos(this)` shared library.

## Jenkins requirements

- A macOS agent with label `cocos-mac-3.8.7`.
- Cocos Creator 3.8.7 installed at the path configured in the pipeline.
- Node.js and npm available on the agent.
- Jenkins SSH Agent plugin.
- Jenkins Credentials Binding plugin.
- An SSH private-key credential named `github-ssh`, or a different credential ID passed through the pipeline parameter.
- A Secret Text credential named `discord-webhook` containing the Discord
  webhook URL, if build notifications are enabled.
- The agent must run inside a logged-in macOS GUI session because Cocos Creator command-line builds still require the window server.

## Job configuration

1. Create a Pipeline or Multibranch Pipeline job from this GitHub repository.
2. Set the pipeline script path to `Jenkinsfile/Cocos`.
3. Configure the repository checkout credential.
4. Keep the Mac awake while the agent is online.
5. To enable Discord notifications, open **Manage Jenkins > Credentials >
   System > Global credentials > Add Credentials** and create:
   - Kind: `Secret text`
   - Secret: the Discord webhook URL
   - ID: `discord-webhook`
6. Keep the default `DISCORD_CREDENTIALS_ID=discord-webhook`, or enter another
   credential ID in **Build with Parameters**.
7. Run the pipeline and download ZIP/HTML files from Jenkins Artifacts.

Jenkins polls GitHub every two minutes and starts a build when the repository
HEAD changes. After every build, Jenkins sends the build result to Discord.
Notification messages include the app name, a link to one ZIP containing every
network artifact, and the commit built by that run. The combined ZIP is stored
under Jenkins Artifacts because it can exceed Discord's direct upload limit.
Notification errors are logged as warnings and do not change the build result.
Leave `DISCORD_CREDENTIALS_ID` empty to disable notifications. The webhook URL
is never stored in this repository or exposed as a normal build parameter.

## Local verification

```bash
npm --prefix CocosPlayableAdsTemplate ci --no-audit --no-fund
npm --prefix CocosPlayableAdsTemplate/extensions/super-html ci --no-audit --no-fund
./ci/build-cocos.sh
```

The build configuration is stored in `ci/cocos-build.json`. The `super-html`
project extension runs from its Cocos `onAfterBuild` hook after the normal
`web-mobile` build finishes.

The pipeline automatically finds a single Cocos project directory at the
repository root, so it continues to work after the template folder is renamed.
Update the scene URL and UUID in `ci/cocos-build.json` if a derived project
replaces `MainScene`.

The first version only archives build artifacts in Jenkins. Dashboard upload
should be added as a separate stage after its API and authentication method are
confirmed.
