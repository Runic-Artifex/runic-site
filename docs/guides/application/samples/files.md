# Open and save files

A ViewModel opens and saves files through its Window's file dialog service.
This sample reads a text file, replaces it atomically, and handles platforms
that can't.

The services in this guide, `AddRunicPlatformServices()` and its per-Window
registrations, are newer than SDK `0.7.0-preview.6`. With that release, create
the providers yourself as the
[desktop services guide](../../desktop-services.md) describes.

## Register the services

`services.AddRunicPlatformServices()` registers the file dialogs, the text
clipboard and the file launcher once for each Window's DI scope. The template
calls it in `WorkspaceServices.cs`:

```csharp docs-test=template:WorkspaceServices.cs host=desktop
// Per-window file dialogs, clipboard and file launcher from the provider for the running backend. A
// ViewModel can take IFileDialogs, ITextClipboard or IWindowPlatformServices in its constructor; they
// bind to the native window when it opens and report OwnerUnavailable until then, as in tests.
...
services.AddRunicPlatformServices();
```

It registers these services:

| Service                   | Use                                                 |
| ------------------------- | --------------------------------------------------- |
| `IFileDialogs`            | Open a file or folder, choose where to save a file. |
| `ITextClipboard`          | Read and write text on the clipboard.               |
| `IDesktopFileLauncher`    | Open a file in its app, or show it in its folder.   |
| `IWindowPlatformServices` | All of the above, plus `GetSnapshot()`.             |

A ViewModel takes them in its constructor, like any other service. The
constructor runs before the Window opens, so the services can't show a dialog
yet:

```csharp docs-test=source:tests/dotnet/Runic.Application.Views.Desktop.Tests/PlatformServicesChecks.cs
// Takes its services in the constructor, before its window opens.
sealed class FileViewModel : INotifyPropertyChanged
{
    public FileViewModel(IFileDialogs files, ITextClipboard clipboard, IWindowPlatformServices platform)
```

When `OpenWindowAsync` opens the Window, the services bind to its native
window, so each dialog is parented to the Window whose ViewModel asked. They
use the provider for the platform and backend that actually run: Windows,
macOS, GTK 3 or GTK 4. Every result before or after that time is a value, not
an exception:

- Before the Window opens, and in tests, every operation returns
  `Unavailable(OwnerUnavailable)`. The same applies to CS-WebUI, which has no
  native window, and to a Window shown in an installed browser.
- After the Window closes, every operation returns `Unavailable(OwnerClosed)`.
- A Linux process without a GTK backend returns
  `Unavailable(ProviderNotConfigured)`.

`IWindowPlatformServices.GetSnapshot()` reports the same state for each
capability, such as `platform.files.save`, so a ViewModel can disable a
command that can't work. `dotnet runic doctor` names the provider it selects
and, on Linux, checks for the session bus and xdg-desktop-portal.

## Open and read a file

`OpenFileAsync` shows the dialog and returns a `PickerResult<IReadFileLease>`.
`Selected` carries a lease on the chosen file; `Dismissed`, `Unavailable` and
`Failed` are the other outcomes. The lease grants access to that one file;
dispose it when you are done:

```csharp docs-test=source:tests/dotnet/Runic.Application.Views.Desktop.Tests/PlatformServicesChecks.cs
public async Task OpenAsync()
{
    if (await files.OpenFileAsync(new()) is not PickerResult<IReadFileLease>.Selected(var lease)) return;
    await using (lease)
    await using (var stream = await lease.OpenReadAsync())
    using (var reader = new StreamReader(stream))
        Text = await reader.ReadToEndAsync();
}
```

Call it from a command, such as a `ReactiveCommand.CreateFromTask` or a
`[RelayCommand]`. The command body runs on the Window's model context, and so
does the code after each `await`, so it sets `Text` directly; see
[ViewModel state and threads](../guides/model-context.md). The lease, the
stream and the file's path stay in .NET. Send the text, or a DTO, to the
frontend, never the lease.

## Save atomically

`SaveFileAsync` asks where to save and returns a save lease.
`BeginWriteAsync(FileWritePolicy.RequireAtomicReplace)` starts a staged write:
you write the new content to the transaction's `Content` stream, and
`CommitAsync` replaces the file in one step. The file is either fully replaced
or left as it was; a reader never sees half of it.

```csharp docs-test=source:tests/dotnet/Runic.Application.Views.Desktop.Tests/PlatformServicesChecks.cs
public async Task<bool> SaveAsync()
{
    if (await files.SaveFileAsync(new("notes.txt")) is not PickerResult<ISaveFileLease>.Selected(var lease)) return false;
    await using (lease)
    {
        if (await lease.BeginWriteAsync(FileWritePolicy.RequireAtomicReplace)
            is not PlatformResult<IFileWriteTransaction>.Success(var transaction)) return false;
        await using (transaction)
        {
            await using (var writer = new StreamWriter(transaction.Content, leaveOpen: true))
                await writer.WriteAsync(Text);
            return await transaction.CommitAsync() is FileCommitResult.Committed;
        }
    }
}
```

The runtime writes a temporary file next to the target, flushes it to disk and
renames it over the target. Before the rename, it checks on a best-effort basis
that the target has not changed since the dialog returned; if it has, the commit returns
`NotCommitted(Conflict)`. Disposing a transaction without committing removes
the temporary file.

`CommitAsync` returns one of three results:

- `Committed`: the file now holds the new content.
- `NotCommitted(code)`: the file was not changed. You can tell the user why
  and let them try again.
- `CommitUnknown(code)`: the replacement may or may not have happened. Don't
  retry automatically; tell the user to check the file.

`SaveAsync` above returns `false` for everything except `Committed`. A real
application shows the user which case occurred, for example in a status
property that the frontend renders.

## When atomic save is unavailable

Atomic replacement needs permission to create a file next to the target. Some
platforms grant access to the chosen file only:

- **Linux.** Both GTK backends use xdg-desktop-portal file dialogs. A portal
  selection grants access to the chosen file, not to its folder.
- **Sandboxed macOS apps.** A selection doesn't grant access to the folder
  either.

In these cases `BeginWriteAsync` returns `Unavailable(AtomicReplaceUnavailable)`
before it changes anything, and `GetSnapshot()` reports the same reason for
`platform.files.save`. The sample's `SaveAsync` then returns `false`, and the
file keeps its old content. Treat it as "not saved" and tell the user; never
report success.

This preview has no other write policy: `FileWritePolicy` has only
`RequireAtomicReplace`. So with the registered services, a Linux application
can open files through the dialog but can't save through it yet. An
unsandboxed application on GTK 3 can choose GTK's own file chooser instead of
the portal with `LinuxPlatformProvider.CreateGtkNativeFileDialogs(owner)`,
which keeps the staged save. That is a lower-level provider API that you
compose yourself, and there is no automatic fallback. The
[portal provider README](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Platform.Linux.Portal/README.md)
describes it. Check the release notes of later SDK versions before you rely
on any other Linux save behavior.

## Next steps

- [App settings and desktop preferences](settings.md) stores application data
  without a dialog.
- [Ask the user from a ViewModel](prompts.md) confirms an action, for example
  before overwriting unsaved changes.
- [Desktop preferences, notifications, file handoff, and clipboard](../../desktop-services.md)
  covers the providers behind these services.
- The
  [Runic.Application.Views.Desktop README](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Application.Views.Desktop/README.md)
  lists every per-Window service and owner.
