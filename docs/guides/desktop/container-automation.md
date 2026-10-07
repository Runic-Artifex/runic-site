# Linux desktop container automation

Managed systemd-nspawn containers run the Linux desktop integration checks. GNOME's full Flatpak/input/audio sequence runs without QEMU or a host
Wayland, session D-Bus, PipeWire, home-directory or device bind. Plasma has a
separate configuration so each desktop selects its own portal implementations.
This is the only supported Linux desktop runner.

## Prepare once

The host needs the active managed-nspawn helpers and BTF-enabled systemd described
in [the container configuration](https://github.com/Runic-Artifex/runic-sdk/blob/main/nixos/portal-container/README.md).
Prepare one small base directory, in a parent owned by the invoking user:

```sh docs-test=skip:sdk-repository-workflow
mkdir -p /tmp/runic-desktop-base
sudo install -d -o root -g root -m 0755 /tmp/runic-desktop-base/root \
  /tmp/runic-desktop-base/root/usr /tmp/runic-desktop-base/root/usr/bin
sudo systemd-dissect --shift /tmp/runic-desktop-base/root foreign
```

This is a one-time privileged filesystem preparation, not a per-desktop or
per-run system activation. The runner reuses it with `--volatile=yes`, which
creates fresh writable state and ignores the base's stored `/home` and `/etc`.
A private `/usr/bin` tmpfs lets normal NixOS activation create its compatibility
shims. Test-installed apps, preferences and logs disappear at shutdown after
results have been copied out. Do not use a real system root as this base.

Build the chosen desktop and locked Flatpak preparation tools from the SDK root:

```sh docs-test=skip:sdk-repository-workflow
nix build .#nixosConfigurations.runic-headless-gnome.config.system.build.toplevel \
  --out-link artifacts/container-gnome
nix build .#nixosConfigurations.runic-headless-kde.config.system.build.toplevel \
  --out-link artifacts/container-kde
nix build .#desktop-flatpak-tools --out-link artifacts/desktop-flatpak-tools
```

Prepare the standard runtime once, outside the network-isolated test. The helper
pins both GNOME Platform 50 and its Mesa GL extension and uses a dedicated cache;
it does not install anything into the host user's normal Flatpak installation.

```sh docs-test=skip:sdk-repository-workflow
PATH="$PWD/artifacts/desktop-flatpak-tools/bin:$PATH" \
  bash nixos/portal-container/prepare-runtime.sh "$PWD/.cache/container-flatpak" \
  > /tmp/runic-runtime-path
nix-store --add-root "$PWD/artifacts/container-runtime" --indirect \
  --realise "$(cat /tmp/runic-runtime-path)"
```

The runtime is shared read-only between test desktops. The nested Flatpak receives
its standard runtime, not the container's Nix store. Reuse the cache and GC root;
do not rebuild a runtime snapshot for every test invocation.

## Prepare fixture inputs

Build the [portable NativeAOT Flatpak fixture](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.1/tests/native/Runic.Desktop.Gtk4.Smoke/flatpak/README.md)
using the locked SDK environment. For the native suite, use the ordinary
NativeAOT fixture publish. Put only the required executable and installer in a
small directory, then freeze that directory as the test input:

```sh docs-test=skip:sdk-repository-workflow
mkdir -p .cache/container-inputs
cp tests/native/Runic.Desktop.Gtk4.Smoke/flatpak/install.sh \
  .cache/container-inputs/install-flatpak.sh
cp artifacts/gtk4-flatpak/Runic.Desktop.Gtk4.Smoke \
  .cache/container-inputs/Runic.Desktop.Gtk4.Smoke.flatpak
# For the native mode, also copy its ordinary NativeAOT publish:
cp artifacts/gtk4-usability-aot/Runic.Desktop.Gtk4.Smoke .cache/container-inputs/
nix store add-path .cache/container-inputs > /tmp/runic-input-path
nix-store --add-root "$PWD/artifacts/container-inputs" --indirect \
  --realise "$(cat /tmp/runic-input-path)"
```

Omit `--flatpak` for the native suite. Recreate
the small input artifact after rebuilding a fixture; keep growing source trees,
SDK caches and build outputs out of Nix source snapshots.

## Run and collect

```sh docs-test=skip:sdk-repository-workflow
python3 -B nixos/portal-container/run.py \
  --desktop gnome --system artifacts/container-gnome \
  --root /tmp/runic-desktop-base/root \
  --inputs artifacts/container-inputs --runtime artifacts/container-runtime \
  --output artifacts/container-results/gnome-1 --flatpak --orca --keyboard --scaling --notifications
```

For Plasma, use `--desktop kde --system artifacts/container-kde` with the same
options. `--notifications` also needs the ordinary NativeAOT executable in the
input directory, even when the usability suite uses Flatpak.

Use a new output directory for each run. The host launcher uses the **active host
systemd** tools, then launches the suite through the guest system manager as
`runic`. It waits for the actual desktop/display/Settings/PipeWire services,
retains `boot.log`, `session.log`, `suite.log`, `journal.log` and guest results,
and powers down its own machine on success or failure. Readiness and test
failures exit nonzero. Results are extracted with Python's safe data filter.
Run one desktop at a time initially.

GNOME checks cover accessible roles, WebView actions, native inhibition
registration/removal, portal grant/private-sibling denial, chooser cancellation,
atomic-write rejection preserving the destination, owner closure, real compositor
keyboard navigation and Pinyin composition, and Orca speech with captured output
from a private PipeWire null sink. The virtual keyboard remains alive for the
suite: removing the last input device from a headless seat drops focus. The
chooser uses verified native text entry and compositor Enter input.

The container run checks actual Orca speech requests and non-silent PCM
independently of any speech recognition.

### Optional Whisper cross-check

Optionally cross-check the recordings with local CPU Whisper. Build the tool and
checksum-pinned English model from the SDK root, outside the normal SDK shell:

```sh docs-test=skip:sdk-repository-workflow
nix build .#vm-whisper --out-link artifacts/vm-whisper
nix build .#vm-whisper-model --out-link artifacts/vm-whisper-model

direnv exec . python3 -B tests/native/Runic.Desktop.Gtk4.Smoke/transcribe-speech.py \
  artifacts/container-results/gnome-1/results --model artifacts/vm-whisper-model \
  --whisper artifacts/vm-whisper/bin/whisper-cli \
  --output artifacts/container-results/gnome-1/transcripts
```

This uses locked whisper.cpp 1.9.2 with base.en, four CPU threads and no cloud
service. The model is an opt-in approximately 148 MB dependency. The script
requires the native checks to have passed, rechecks the WAV, and compares the
recognized label and role. Expected phrases are never passed as recognition
prompts. It retains the transcript and recognizer diagnostics, and returns
nonzero for mismatches; inspect both audio and Orca output before attributing
an ASR mismatch to Runic. Recognition can invent text in non-speech audio, so it
cannot replace the independent native and PCM assertions. See the
[Whisper model card](https://github.com/openai/whisper/blob/main/model-card.md)
and [whisper.cpp](https://github.com/ggml-org/whisper.cpp).

The audio checks have focused negative tests:

```sh docs-test=skip:sdk-repository-workflow
direnv exec . python3 -B -m unittest discover \
  -s tests/native/Runic.Desktop.Gtk4.Smoke -p test_speech_audio.py
```

## Compositor input and notifications

Plasma also covers its native Qt chooser, Flatpak grants/cancellation/atomic-write
rejection, PowerDevil registration/removal and Orca/PipeWire audio. Its Qt
accessibility bridge must be enabled before inspecting dialogs; the runner sets
and restores the session accessibility status. PowerDevil is explicitly enabled
because NixOS normally omits power management in containers.

Both keyboard adapters send real compositor input: Mutter RemoteDesktop for
GNOME and KWin EIS with the locked libei for Plasma. They type `runic`, verify
Tab/Shift+Tab focus order, switch the input source with the desktop shortcut,
compose and commit `你好`, then check native text and application composition
events. Fcitx5 source restoration refocuses an entry because its active input
context disappears when a button takes focus. No host `/dev/uinput` is shared.

`--scaling` applies actual 100%, 150% and 200% compositor display scales, reads
them back, clicks the target with compositor pointer input, verifies the hit
counter and records the page's pixel ratio and geometry in `scaling.json`.
Plasma uses KScreen plus a temporary read-only KWin script to map GTK's local
surface bounds into desktop coordinates. GNOME maximizes the test window using
the real desktop shortcut, uses the shell top bar to locate the work area, and
reads the native panel that embeds the WebView to account for window decorations.
Its pointer starts at the right edge to avoid the overview hot corner.
The virtual displays are large enough for the fixture at 200%. Scale and input
source changes are restored. These checks do not substitute CSS zoom or native
button actions for pointer input, and do not claim physical USB device coverage.

`--notifications` installs a temporary receiver service for the fixture identity
already present when the desktop boots. It refreshes D-Bus service discovery and
verifies that the receiver is activatable. It activates the visible **Open result**
action through Plasma's native accessibility action or GNOME's real pointer
hover/click. The fixture verifies the actual action ID, activation token, process
ID and native GTK focused-window state for both live and cold activation. The
cold sender must exit first and the receiver must have a different PID. Calling
the application's activation callback directly is not part of this test.

Notification results and logs are collected in `results/notifications`. The
runner waits for the preceding popup and bus owner to disappear, removes its
temporary service, and cleans up owned receiver processes. GNOME keeps its
pointer inside the banner between hover and click so the action row stays open.

## GTK X11 backend

For the X11 client path, add `--backend x11` to the KDE command with
`--keyboard --scaling --orca --flatpak`. Refresh the immutable fixture inputs
with the current `flatpak/install.sh` before running. The runner reads DISPLAY
and XAUTHORITY from the guest's session manager; no host X server is used.
It requires an actual Runic window in the guest X server's client list and retains
its properties in `x11-window.json`.

This runs GTK's X11 backend under KDE's Xwayland server. It covers real Fcitx5
Pinyin through XIM, native focus/text events and Orca speech, compositor scaling,
and sandboxed file grants/cancellation/owner closure. The Flatpak receives only
the selected display socket. X11 pointer coordinates are converted to compositor
coordinates using the measured WebView/client-buffer ratio, accounting for
both fractional Xwayland scale and integer GTK scale.

For a standalone Plasma/Xorg session, build
`nix build .#nixosConfigurations.runic-headless-kde-xorg.config.system.build.toplevel -o artifacts/container-kde-xorg`
and pass `--system artifacts/container-kde-xorg --desktop kde --session xorg` to
the same runner. The existing `--keyboard --scaling --orca --flatpak --notifications`
options apply. The Xorg server uses a dummy software display inside the managed
container, with no host display socket, physical input devices or network access.
The session probe requires its private X socket and an actual Xorg process.

Keyboard and pointer events use XTEST, including Fcitx5 Pinyin through XIM. The
DPI check reloads the session's XSettings daemon at 96, 144 and 192 DPI, reads back
the published settings, requires matching WebView pixel ratios and clicks the
native target at each setting. A real title-bar double-click maximizes the form;
KWin client geometry accounts for Xorg's server-side decorations. The previous
settings and window size are restored afterward. Notification actions must still
focus the actual receiver in live and cold modes. This Plasma/Xorg session does
not provide an activation token; the runner records its absence and retains the
token requirement for Wayland sessions, including Xwayland clients.
These are desktop DPI checks:
the dummy driver rejects RandR output transforms, so physical-output magnification
and multi-monitor transitions remain separate coverage.

## Remaining coverage

Visual candidate placement, announcement quality, physical input devices and real
hardware/power transitions remain distinct from these headless integration
checks. The keyboard checks cover all fixture controls in both directions and require
native focus events, text insertion events, text values and caret positions;
`accessibility-events.json` retains the observed events. Numeric/range controls,
selection-change events and broader assistive-technology interaction remain
future coverage. CI host provisioning can extend the runner. Windows VM and future real-macOS
testing are separate workstreams. These coverage limitations do not add release
gates.

## Extending the suite

Extend managed containers for Linux. Prepare immutable fixtures and pinned
runtime dependencies before the interaction phase, and keep GNOME/Plasma jobs
separate. Windows VM and real macOS adapters remain independent workstreams.

| Area                  | Automation approach and next assertion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyboard and IME      | GNOME/IBus and KDE/Fcitx5 compositor typing, Tab/Shift+Tab and Pinyin pass in containers. Physical devices remain separate. Changing an accessible text value does not test an IME.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Scaling and targeting | The container adapters set/read actual Mutter/KScreen scales and verify compositor pointer hits at 100%, 150% and 200%. Standalone Xorg verifies XSettings 96/144/192 DPI, WebView pixel ratios and XTEST targeting. Visual caret/candidate placement remains separate. CSS zoom and an AT-SPI button action do not establish physical targeting.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Notifications         | The container adapter activates the visible shell action and asserts the token, receiver PID and native focused-window result for live and cold launch. Calling the application's D-Bus callback directly would bypass the activation-token behavior under test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Accessibility         | Native roles/focus, Orca speech records, recorded audio and optional local ASR now work in GNOME and KDE. Native values, insertion/caret events and complete forward/reverse keyboard focus order also pass. Listening remains useful for announcement quality.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Windows               | Use the [Windows UI Automation smoke](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.1/tests/native/Runic.Desktop.WebViewSmoke/windows-ui-automation.md) through the existing interactive VM login. It verifies WebView2 accessibility names, editable focus, `ValuePattern`, `InvokePattern`, actual typed text and complete forward/reverse Tab navigation with native focused-element identity and `HasKeyboardFocus`, a UIA-point mouse click at the VM's observed 96 DPI, native open-file selection, open/save cancellation and atomic save with independent file verification, live output and deterministic process exit for JIT and executable-only NativeAOT publishes. Run native power-request checks independently. Session-0 SSH alone cannot cover interactive display behavior. Opt-in Narrator label/role speech with real WASAPI audio is implemented. IME composition remains application-specific and outside this smoke. Physical input, visual candidate placement, independent audio transcription, display-scale changes/multi-DPI pointer behavior, overwrite-confirmation flows and visual rendering remain Windows work. |
| macOS                 | Add an AXUIElement/Accessibility adapter and native assertions after the real Mac is available. Keep native support explicitly untested until then.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Start these as focused, opt-in desktop jobs. Move stable scenarios into CI with
the same prepared dependencies and failure handling. Preserve
structured results, native logs and failure screenshots; do not add broad soaks,
mandatory manual gates or retry failures until they happen to pass. Visual IME
placement, spoken quality and real power transitions are still outside the
current automated runner's claims.
