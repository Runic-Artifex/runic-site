# App settings and desktop preferences

Your app's own settings belong in a file that the app writes itself.
`IDesktopSettings` is something else: it reads the desktop's appearance
preferences, such as dark mode.

## Two different things

|                | App settings                        | `IDesktopSettings`                                   |
| -------------- | ----------------------------------- | ---------------------------------------------------- |
| Owner          | Your application                    | The operating system and the user's desktop          |
| Examples       | Recent files, window size, a theme  | Light or dark scheme, accent color, reduced motion   |
| Read or write  | Both                                | Read only                                            |
| Where it lives | A file in the app's data folder     | Windows settings, macOS AppKit, xdg-desktop-portal   |
| Runic API      | None needed: plain .NET file access | `Runic.Platform`, created from the platform provider |

A setting such as "Theme: follow the system, light or dark" uses both: the app
stores the user's choice, and when the choice is "follow the system", it reads
the current scheme from `IDesktopSettings`.

## Store app settings in a file

The SDK has no settings store, and needs none: a settings file is ordinary
.NET code. Keep it in the per-user application data folder, in a folder named
after your app. Your app owns that folder, so it can write the file directly,
without a file dialog and without the
[platform limits on atomic save](files.md#when-atomic-save-is-unavailable).

This minimal store loads the settings once and saves them by writing a
temporary file and moving it over the old one, so a crash never leaves a
half-written file. It uses System.Text.Json's source generator, so it works
with NativeAOT:

```csharp docs-test=skip:missing-sdk-example
public sealed record AppSettings(string Theme = "system", string? LastFolder = null);

[JsonSerializable(typeof(AppSettings))]
internal sealed partial class SettingsJson : JsonSerializerContext;

public sealed class SettingsStore
{
    private readonly string _path = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "MyApp", "settings.json");
    private readonly Lock _gate = new();

    public AppSettings Load()
    {
        lock (_gate)
            return File.Exists(_path)
                ? JsonSerializer.Deserialize(File.ReadAllText(_path), SettingsJson.Default.AppSettings) ?? new()
                : new();
    }

    public void Save(AppSettings settings)
    {
        lock (_gate)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
            var temporary = _path + ".tmp";
            File.WriteAllText(temporary, JsonSerializer.Serialize(settings, SettingsJson.Default.AppSettings));
            File.Move(temporary, _path, overwrite: true);
        }
    }
}
```

Register it as a singleton, so every Window reads and writes the same file:

```csharp docs-test=skip:missing-sdk-example
services.AddSingleton<SettingsStore>();
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
an `AccentColor`, and `HighContrast` and `ReducedMotion`. A preference that
the platform doesn't report is `null`, not `false`. Every read returns a
`PlatformResult<DesktopAppearance>`, so an unavailable or failed read is a
value that you handle, not an exception.

Unlike the file dialogs, `IDesktopSettings` belongs to the application, not to
a Window, and `AddRunicPlatformServices()` doesn't register it. Create it from
the provider for your platform. You own it and dispose it at shutdown:

| Platform     | Factory                                                          |
| ------------ | ---------------------------------------------------------------- |
| Windows      | `WindowsPlatformProvider.CreateSettings()`                       |
| macOS        | `MacOSPlatformProvider.CreateSettings()`, once AppKit is running |
| Linux, GTK 3 | `LinuxPlatformProvider.CreateSettings()`                         |
| Linux, GTK 4 | `PortalPlatformProvider.CreateSettings()`                        |

On Linux both factories read the same xdg-desktop-portal settings; the portal
one doesn't load a GTK toolkit. The Windows provider's interactive check reads
the preferences like this:

```csharp docs-test=source:tests/dotnet/Runic.Platform.Windows.Tests/SettingsTests.cs
await using var settings = WindowsPlatformProvider.CreateSettings();
if (await settings.ReadAsync() is not PlatformResult<DesktopAppearance>.Success { Value: var appearance })
    throw new InvalidOperationException("Windows appearance read failed.");
```

To follow changes, watch them in a background loop and commit each value to a
ViewModel with the model context, because the values arrive outside it:

```csharp docs-test=skip:missing-sdk-example
await foreach (var result in settings.WatchAsync(cancellationToken))
    if (result is PlatformResult<DesktopAppearance>.Success { Value: var appearance })
        await context.InvokeAsync(() => ColorScheme = appearance.ColorScheme, cancellationToken);
```

The frontend can also read `prefers-color-scheme` and
`prefers-reduced-motion` with CSS media queries. Use `IDesktopSettings` when
.NET code needs the value, for example to store "follow the system" or to
choose a native resource.

## Next steps

- [Open and save files](files.md) uses the per-Window dialog services.
- [Update every Window from a shared service](cross-window.md) shows how a
  change in one Window reaches the others.
- [Desktop preferences, notifications, file handoff, and clipboard](../../desktop-services.md)
  covers the platform providers.
