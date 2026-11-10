# App settings and desktop preferences

Your app's own settings belong in a file that the app writes itself.
`IDesktopSettings` is something else: it reads the desktop's appearance
preferences, such as dark mode.

## Two different things

|                | App settings                        | `IDesktopSettings`                                           |
| -------------- | ----------------------------------- | ------------------------------------------------------------ |
| Owner          | Your application                    | The operating system and the user's desktop                  |
| Examples       | Recent files, window size, a theme  | Light or dark scheme, accent color, reduced motion           |
| Read or write  | Both                                | Read only                                                    |
| Where it lives | A file in the app's data folder     | Windows settings, macOS AppKit, xdg-desktop-portal           |
| Runic API      | None needed: plain .NET file access | `Runic.Platform`, registered by `AddRunicPlatformServices()` |

A setting such as "Theme: follow the system, light or dark" uses both: the app
stores the user's choice, and when the choice is "follow the system", it reads
the current scheme from `IDesktopSettings`.

## Store app settings in a file

The SDK has no settings store, and needs none: a settings file is ordinary
.NET code. Keep it in the per-user application data folder, in a folder named
after your app. Your app owns that folder, so it can write the file directly,
without a file dialog and without the
[platform limits on atomic save](files.md#when-atomic-save-is-unavailable).

This store, from the
[multi-window example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.17.0/examples/multi-window),
loads the settings on demand and saves them by writing a temporary file and
moving it over the old one, so a crash never leaves a half-written file. It
uses System.Text.Json's source generator, so it works with NativeAOT:

```csharp docs-test=source:examples/multi-window/SettingsStore.cs
public sealed record AppSettings(string Theme = "system", string? LastFolder = null, string? Language = null)
// ...

[JsonSerializable(typeof(AppSettings))]
internal sealed partial class SettingsJson : JsonSerializerContext;
// ...
public sealed class SettingsStore(string path)
{
    private readonly Lock _gate = new();

    // The per-user application data folder, in a folder named after the app.
    public static string DefaultPath { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "RunicMultiWindow", "settings.json");

    public AppSettings Load()
    {
        lock (_gate)
            return File.Exists(path)
                ? JsonSerializer.Deserialize(File.ReadAllText(path), SettingsJson.Default.AppSettings) ?? new()
                : new();
    }

    // Raised after each save, on the saving Window's thread; Program.cs applies the theme to every Window.
    public event EventHandler<AppSettings>? Saved;

    public void Save(AppSettings settings)
    {
        lock (_gate)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            var temporary = path + ".tmp";
            File.WriteAllText(temporary, JsonSerializer.Serialize(settings, SettingsJson.Default.AppSettings));
            File.Move(temporary, path, overwrite: true);
        }
        Saved?.Invoke(this, settings);
    }
}
```

The path is a constructor parameter, so a test can point the store at a
temporary file. Register it as a singleton, so every Window reads and writes
the same file:

```csharp docs-test=source:examples/multi-window/ProjectServices.cs
services.AddSingleton(new SettingsStore(SettingsStore.DefaultPath));
```

- The lock matters. Each Window has its own model context, and two Windows can
  save at the same time; see
  [Update every Window from a shared service](cross-window.md).
- A ViewModel takes `SettingsStore` in its constructor and calls it from a
  command. For a large file, move the work off the model context and commit the
  result with `InvokeAsync`, as
  [ViewModel state and threads](../guides/model-context.md#leaving-the-context)
  shows.
- If other Windows must react when a setting changes, let the store raise an
  event and follow the [cross-window sample](cross-window.md).
- `Microsoft.Extensions.Configuration` and the options pattern suit settings
  that the app only reads, such as an `appsettings.json` shipped next to the
  executable. They don't write settings back.

## Read the desktop's preferences

`IDesktopSettings` from `Runic.Platform` reads the desktop's appearance:

- `ReadAsync()` returns the current `DesktopAppearance`.
- `WatchAsync()` returns the current value first, then every change, including
  the desktop's settings service going away and coming back.

`DesktopAppearance` has a `ColorScheme` (`NoPreference`, `Light` or `Dark`),
an `AccentColor`, `HighContrast` and `ReducedMotion`, and since SDK `0.11.0`
`TextScale`, the desktop's text size factor (Windows, GNOME). A preference that
the platform doesn't report is `null`, not `false`. Every read returns a
`PlatformResult<DesktopAppearance>`, so an unavailable or failed read is a
value that you handle, not an exception.

Since SDK `0.12.0`, an application that offers its own light or dark setting
passes it to the window as `DesktopWindowOptions.ColorScheme` (or
`DesktopWindowHostOptions.ColorScheme`): Runic Desktop windows on macOS and
Windows, and the WPF `RunicWebView`, then show that scheme, and the page's
`prefers-color-scheme` follows. `NoPreference`, the default, follows the
desktop; GTK windows ignore it. See
[windows on macOS](../../desktop-services.md#windows-on-macos). To switch while the application runs,
see [Light and dark at run time](#light-and-dark-at-run-time).

Unlike the file dialogs, `IDesktopSettings` belongs to the application, not to
a Window. Since SDK `0.7.0-preview.7`, `AddRunicPlatformServices()` registers
it as one singleton, which it creates from the provider for the running
platform when it is first resolved;
the service provider disposes it. Windows reads its settings, macOS reads
AppKit, and Linux reads xdg-desktop-portal with either GTK version, without
loading GTK. On other systems, and with CS-WebUI's registration, every read
returns `Unavailable(ProviderNotConfigured)`. To replace it, for example in a
test, register your own `IDesktopSettings` before calling
`AddRunicPlatformServices()`, or after it as the multi-window tests do:

```csharp docs-test=source:examples/multi-window/Tests/ProjectWindowTests.cs
_services = new ServiceCollection()
    .AddProject()
    .AddSingleton<IRunicWindowService>(_windows)
    .AddSingleton(new SettingsStore(_settingsPath))
    .AddSingleton<IDesktopSettings>(new FixedDesktopSettings(DesktopColorScheme.Dark))
    .BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
```

With SDK `0.7.0-preview.6`, or outside a Runic Views app, create it from the
platform provider yourself; you own it and dispose it at shutdown:

| Platform | Factory                                                          |
| -------- | ---------------------------------------------------------------- |
| Windows  | `WindowsPlatformProvider.CreateSettings()`                       |
| macOS    | `MacOSPlatformProvider.CreateSettings()`, once AppKit is running |
| Linux    | `new PortalApplication(applicationId).CreateSettings()`          |

On Linux it reads the xdg-desktop-portal settings with either GTK version,
without loading a GTK toolkit. Before SDK `0.9.0`, the Linux factories were
`LinuxPlatformProvider.CreateSettings()` and
`PortalPlatformProvider.CreateSettings()`. The Windows provider's interactive
check reads the preferences like this:

```csharp docs-test=source:tests/dotnet/Runic.Platform.Windows.Tests/SettingsTests.cs
await using var settings = WindowsPlatformProvider.CreateSettings();
if (await settings.ReadAsync() is not PlatformResult<DesktopAppearance>.Success { Value: var appearance })
    throw new InvalidOperationException("Windows appearance read failed.");
```

A ViewModel takes `IDesktopSettings` in its constructor. To follow changes,
watch them in a background loop and commit each value with the Window's model
context, because the values arrive outside it. The multi-window example's
ViewModel starts the loop in its constructor and stops it in `Dispose`:

```csharp docs-test=source:examples/multi-window/ProjectViewModel.cs
// The values arrive outside the model context, so each one is committed in a turn of it.
private async Task WatchAppearanceAsync(IDesktopSettings settings, CancellationToken cancellationToken)
{
    try
    {
        await foreach (var result in settings.WatchAsync(cancellationToken))
            if (result is PlatformResult<DesktopAppearance>.Success { Value: var appearance })
                await _context.InvokeAsync(() => DesktopScheme = appearance.ColorScheme.ToString(), cancellationToken);
    }
    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
    {
    }
}
```

Its theme command saves the user's choice in the settings file, and the View
uses `DesktopScheme` while the choice is "system":

```csharp docs-test=source:examples/multi-window/ProjectViewModel.cs
ChooseThemeCommand = ReactiveCommand.Create<string>(theme =>
{
    settings.Save(settings.Load() with { Theme = theme });
    Theme = theme;
});
```

The frontend can also read `prefers-color-scheme` and
`prefers-reduced-motion` with CSS media queries. Use `IDesktopSettings` when
.NET code needs the value, for example to store "follow the system" or to
choose a native resource.

## Light and dark at run time

Since SDK `0.16.0`, a theme setting applies while the application runs,
without a reload. `DesktopHost.SetColorSchemeAsync` switches the whole
application, and `DesktopWindow.SetColorSchemeAsync` one window. The page's
`prefers-color-scheme` and the window's frame follow. A window's own
`ColorScheme` still wins; `NoPreference` follows the application's scheme, and
the application's `NoPreference` follows the desktop.

The multi-window example's `AppSettings.ColorScheme` maps its theme setting to
a `DesktopColorScheme`. It applies the saved scheme before the first Window
opens, and again after each save, so the theme command above switches every
open Window at once:

```csharp docs-test=source:examples/multi-window/Program.cs
// The theme is the application's: every Window shows it, the page's prefers-color-scheme follows, and a new choice
// switches the open Windows at once. "system" (NoPreference) follows the desktop.
var settings = provider.GetRequiredService<SettingsStore>();
await host.Desktop.SetColorSchemeAsync(settings.Load().ColorScheme);
settings.Saved += (_, saved) => _ = host.Desktop.SetColorSchemeAsync(saved.ColorScheme).AsTask();
```

- Every GTK window of the process, and the windows of one WebView2
  `ProfilePath`, share a scheme: switching one switches all of them.
  `Features.PerWindowColorScheme` tells which kind a window has. On Linux,
  `NoPreference` returns GTK's settings to the desktop's.
- A ViewModel switches its own Window through
  `IRunicWindowPresentation.SetColorSchemeAsync`; see
  [Control a Window from its ViewModel](../../desktop-services.md#control-a-window-from-its-viewmodel).
  Custom window hosts implement `IDesktopColorSchemeWindowHost`.

The
[Runic.Desktop README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/packages/dotnet/Runic.Desktop/README.md#switching-while-the-application-runs)
lists what each window host sets.

## Contrast, text size and accent colour

Since SDK `0.17.0`, Windows and pages follow more of the desktop's appearance
than light and dark. In .NET, `DesktopAppearance.Contrast` reports the
desktop's contrast preference in three states (`NoPreference`, `More` and
`ForcedColors`), and `SystemColors` the palette of a Windows contrast theme.
`HighContrast` is unchanged, and `DesktopColorScheme` stays light or dark.

A page's CSS reads `prefers-contrast`, `forced-colors` and
`prefers-reduced-motion`, but no engine gives script the desktop's text size,
accent colour or contrast palette, and not every engine follows a change while
the window is open. With the Views feature `appearance/1`, Runic Desktop pushes
the desktop's appearance to each window's pages and keeps it current. The
page's appearance store combines the push with the engine's media queries:

```ts docs-test=readme:packages/web/views/README.md
import { onAppearance } from '@runic-artifex/views';

onAppearance((look) => {
  document.documentElement.style.fontSize = `${look.textScale ?? 1}rem`;
  if (look.accentColor)
    document.documentElement.style.setProperty('--accent', look.accentColor);
});
```

- The frameworks wrap it as `useAppearance` (React, Vue, Svelte),
  `injectAppearance` (Angular) and `appearances()` (Effect). `engine` is what
  the page's CSS sees, and `host` what the desktop asks for.
- The desktop's settings describe the user at this computer, so only windows
  that nothing else can reach get them: not serve-only windows, a host on every
  network interface or CS-WebUI windows, whose pages get every member `null`.
- In tests, set `host.Content.Appearance` and read `host.AppearancePushes`; a
  page test calls the mock bridge's `setAppearance`.

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
host.Content.Appearance = new DesktopAppearance(DesktopColorScheme.Dark) { Contrast = DesktopContrast.More, TextScale = 1.5 };
await Assert.That(host.AppearancePushes[^1]?.TextScale).IsEqualTo(1.5);
```

[Contrast, forced colors and reduced motion](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/packages/dotnet/Runic.Desktop/README.md#contrast-forced-colors-and-reduced-motion)
in the Runic.Desktop README lists what each engine reports, and
[Appearance](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/packages/web/views/README.md#appearance)
in the Views npm README describes the store.

## The language

Since SDK `0.16.0`, text that a ViewModel produces can follow the Window's
language: give the member the type `Runic.Translations.TranslationReference`,
and the page formats it with its Runic Translations runtime. Since SDK
`0.17.0`, the language is the application's. `IRunicApplicationLocale`, which
`AddRunicWindowService()` registers, switches every Window at once, and the
multi-window example saves the user's choice after a switch succeeded:

```csharp docs-test=source:examples/multi-window/ProjectViewModel.cs
ChooseLanguageCommand = ReactiveCommand.CreateFromTask<string>(async (language, token) =>
{
    if (ProjectServices.SupportedLanguage(translations, language) is not { } supported) return;
    await application.SetLocaleAsync(supported, token);
    settings.Save(settings.Load() with { Language = supported });
});
```

At the next start it passes the saved language to
`IRunicApplicationLocale.SetLocaleAsync` before the first Window opens. A
Window can still set a language of its own with `IRunicWindowLocale`; save its
`OwnLocale`, which is `null` while the Window follows the application.
[The application's language](../guides/languages.md) shows the whole setup,
Runic's own text in English and German, and the tests.

## Next steps

- [Open and save files](files.md) uses the per-Window dialog services.
- [Update every Window from a shared service](cross-window.md) shows how a
  change in one Window reaches the others.
- [Desktop preferences, notifications, file handoff, and clipboard](../../desktop-services.md)
  covers the platform providers.
