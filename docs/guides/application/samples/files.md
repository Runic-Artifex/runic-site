# Open and save files

A ViewModel opens and saves files through its Window's file dialog service.
This sample reads a text file, replaces it atomically, and handles platforms
that can't.

The services in this guide, `AddRunicPlatformServices()` and its per-Window
registrations, are new in SDK `0.7.0-preview.7`. With `0.7.0-preview.6`, create
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
| `IDesktopFileLauncher`    | Open a file or a web link, or show a file's folder. |
| `IWindowPlatformServices` | All of the above, plus `GetSnapshot()`.             |

Since SDK `0.11.0` it also registers `IDesktopClipboard` (HTML, RTF, images
and file lists), `IDesktopMonitors` and `IDesktopMessageBoxes` for each Window.
`IFileDialogs.OpenDirectoriesAsync` selects several folders, and a
`FileDialogFilter` can name `MimeTypes` on macOS and Linux.

It also registers `IDesktopSettings`, the desktop's appearance preferences.
That one belongs to the application, not to a Window;
[App settings and desktop preferences](settings.md) covers it.

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
  native window, and to a Window shown in an installed browser. There, the page
  sends files as [uploads](#blobs-and-uploads).
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
    if (await files.OpenFileAsync(new() { Filters = [new("Notes", ["txt", "md"])] }) is not PickerResult<IReadFileLease>.Selected(var lease)) return;
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
    if (await files.SaveFileAsync(new("notes.txt") { Filters = [new("Notes", ["txt"])] }) is not PickerResult<ISaveFileLease>.Selected(var lease)) return false;
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
that the target has not changed since the application last saw it; if it has,
the commit returns `NotCommitted(Conflict)`. Disposing a transaction without
committing removes the temporary file.

Since SDK `0.12.0`, every save lease, including the one `SaveFileAsync`
returns, can write again: a new `BeginWriteAsync` begins once the previous
transaction's commit finished, whatever its outcome, or the transaction was
disposed. While one is open, it returns `Failed(ResourceBusy)`; before, every
later call did. The commit compares the file with the selected file, then with
each committed write, so a conflict means another program changed it.

`CommitAsync` returns one of three results:

- `Committed`: the file now holds the new content.
- `NotCommitted(code, diagnostic)`: the file was not changed. You can tell the
  user why and let them try again.
- `CommitUnknown(code, diagnostic)`: the replacement may or may not have happened. Don't
  retry automatically; tell the user to check the file.

`SaveAsync` above returns `false` for everything except `Committed`. A real
application shows the user which case occurred, for example in a status
property that the frontend renders.

Since SDK `0.12.0`, on Windows, a target that another program holds open
without delete sharing is `NotCommitted(ResourceBusy)`, not
`CommitUnknown(IOError)`: the file was not replaced, so the user can try again
later.

## Keep working on a document

An editor reads the file the user chose and saves back to it on every Ctrl+S
and autosave. Since SDK `0.12.0`, `OpenDocumentAsync` and `SaveDocumentAsync`
(Save As) return an `IDocumentFileLease` for that. Unlike the lease of
`OpenFileAsync`, which reads the file once, it reads the current file on each
`OpenReadAsync` and writes it as often as the application saves. Keep it for as
long as the document is open:

```csharp docs-test=source:tests/dotnet/Runic.Application.Views.Desktop.Tests/PlatformServicesChecks.cs
    public async Task OpenAsync()
    {
        if (await files.OpenDocumentAsync(new() { Filters = [new("Notes", ["txt", "md"])] }) is not PickerResult<IDocumentFileLease>.Selected(var document)) return;
        if (_document is not null) await _document.DisposeAsync();
        _document = document;
        await ReloadAsync();
    }
...
    public async Task<FileCommitResult?> SaveAsync()
    {
        if (_document is null || await _document.BeginWriteAsync(FileWritePolicy.RequireAtomicReplace)
            is not PlatformResult<IFileWriteTransaction>.Success(var transaction)) return null;
```

A commit compares the file with the content the application last saw, which
for a document includes each `OpenReadAsync`. After `NotCommitted(Conflict)`,
ask the user, then reload, or read first and write again to overwrite.
`LocalPath` tells where the document is, for example to find out whether
another Window has it open. The `platform.files.openDocument` capability
reports whether the Window's dialogs return documents. For a recent-files list,
store the bytes of the lease's `CreateBookmarkAsync` and reopen the document
with `IDesktopFileBookmarks.OpenDocumentAsync`; see
[document apps](https://github.com/Runic-Artifex/runic-sdk/blob/v0.16.0/packages/dotnet/Runic.Platform/README.md#document-apps).

## When atomic save is unavailable

Atomic replacement needs a place to stage the new content: next to the target,
or, in a sandboxed macOS app, the volume's item replacement directory.

- **Windows, Linux and unsandboxed macOS.** The save is available. On Linux,
  a portal selection in an unsandboxed application is the real host path, so
  the staged sibling and rename work as usual. Inside Flatpak, the
  portal returns a document whose private view stages the sibling as a host
  tempfile and renames it onto the chosen file. Either way the file is
  replaced atomically, never overwritten in place.
- **Sandboxed macOS apps.** Since SDK `0.12.0` the save is available: a
  selection grants the file alone, so the write stages in the volume's item
  replacement directory and `NSFileManager` replaces the file. Before, the save
  was unavailable there.
- **Read-only or revoked grants.** On Linux, a document grant that can't be
  written is unavailable.

Portal saves are new in SDK `0.7.0-preview.7`; in `0.7.0-preview.6` a Linux
portal selection was always unavailable for saving. With the preview.6
packages, a Linux application can open files through the dialog but can't save
through it, and an unsandboxed application on GTK 3 can choose GTK's own file chooser with
`LinuxPlatformProvider.CreateGtkNativeFileDialogs(owner)`. That was a
lower-level provider API that you composed yourself, with no automatic fallback.
The
[portal provider README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.16.0/packages/dotnet/Runic.Platform.Linux.Portal/README.md)
describes both mechanisms.

When the save is unavailable, `BeginWriteAsync` returns
`Unavailable(AtomicReplaceUnavailable)` before it changes anything, and
`GetSnapshot()` reports the same reason for `platform.files.save`. The sample's
`SaveAsync` then returns `false`, and the file keeps its old content. Treat it
as "not saved", tell the user and offer Save As to another destination; never
report success. This SDK has no other write policy: `FileWritePolicy` has only
`RequireAtomicReplace`.

## Blobs and uploads

The file dialogs keep files in .NET. Since SDK `0.16.0`, binary data can also
cross to and from the page without JSON. It works on every host, and on
CS-WebUI, which has no file dialogs, an upload is the way to get a file into
.NET.

**A blob for the page.** A `RunicBlob` is an image, thumbnail or download that
a ViewModel produces: a state property, a DTO or collection member, or a
command or operation result. Create one with `RunicBlob.FromBytes`, `FromFile`
or `FromStream`. The page receives `{url, type, size, name}` and uses `url`
directly:

<!-- prettier-ignore -->
```tsx docs-test=readme:packages/web/views/README.md
{state.avatar && <img src={state.avatar.url} alt="" />}
<a href={report.url} download={report.name ?? undefined}>Download</a>
```

- The URL is unguessable and works only for its Window (on Runic Desktop and
  WPF only for its browser). It stops working when the property stops holding
  the blob, when the View is released, when the Window closes, or at once with
  `Release()`. The host answers byte ranges.
- Every response carries a sandboxing content security policy, so uploaded
  HTML or SVG runs no script in the application's origin.
- A Window keeps at most 1,024 blobs of command results and interaction
  inputs; blobs in state and `[RunicCollection]` rows stay while shown.
- A `RunicBlob` property is read-only for the page, and a `RunicBlob` command
  input is `RUNICBRIDGE065`; take a `RunicUpload`.

**An upload from the page.** A command whose parameter is a `RunicUpload`
takes a file the user picked in the page:

<!-- prettier-ignore -->
```csharp docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
[RelayCommand]
private async Task AttachAsync(RunicUpload file, CancellationToken cancellationToken)
{
    // Everything about an upload comes from the page: check what you read before you use it.
    await file.SaveAsAsync(Path.Combine(_attachments, Guid.NewGuid().ToString("N")), cancellationToken: cancellationToken);
    Attachments.Add(new Attachment(file.FileName, file.Length));
}
```

The page streams the file over HTTP to the Window's host with
`client.upload(file, { signal, onProgress })`, or `upload` from
`@runic-artifex/views`, and passes the resulting reference to the command:

<!-- prettier-ignore -->
```ts docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
const file = input.files![0]!;
const ref = await client.upload(file, { signal, onProgress: ({ loaded, total }) => setProgress(loaded / total) });
await client.attach(ref);
```

- The command reads the file with `OpenReadAsync` or moves it with
  `SaveAsAsync`. `FileName`, `ContentType` and the content are untrusted.
- An upload works only on the connection that sent it, only once, for at most
  10 minutes, and is dropped after 30 seconds without data.
- `MaximumUploadBytes` (256 MiB) and `MaximumWindowUploadBytes` (1 GiB) on
  `RunicWindowOptions` and the host options limit uploads.

On CS-WebUI, each Window serves blobs and uploads from a loopback endpoint of
its own, on another origin than the page. A page `Content-Security-Policy` must
allow `http://localhost:*` for `img-src`, `media-src` and `connect-src`. A
Window whose endpoint cannot start opens without blobs and uploads.

**Testing.** `RunicWindowTestHost.UploadAsync` simulates a page's upload that a
command then takes, and `ReadBlobAsync` returns what the host serves for a
blob URL. A ViewModel test without a Window uses `RunicUpload.FromBytes`. On
the page, `mockBlob()` makes a blob whose URL loads in a test, and the mock
Bridge's `uploads` keeps what the page uploaded.

The
[attachments example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.16.0/examples/attachments)
shows an avatar and attachment uploads, and the
[Views README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.16.0/packages/dotnet/Runic.Application.Views/README.md#blobs-and-uploads)
lists each host's endpoint.

## Next steps

- [App settings and desktop preferences](settings.md) stores application data
  without a dialog.
- [Ask the user from a ViewModel](prompts.md) confirms an action, for example
  before overwriting unsaved changes.
- [Desktop preferences, notifications, file handoff, and clipboard](../../desktop-services.md)
  covers the providers behind these services.
- The
  [Runic.Application.Views.Desktop README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.16.0/packages/dotnet/Runic.Application.Views.Desktop/README.md)
  lists every per-Window service and owner.
