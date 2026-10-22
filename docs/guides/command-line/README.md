# Get started with Runic Command Line

Runic Command Line turns typed C# methods into commands with help, validation
and human or JSON output. This page takes you from an empty folder to a
working command.

It covers release `0.8.0`. Every link to the
[Command Line repository](https://github.com/Runic-Artifex/runic-cli-sdk/tree/v0.8.0)
points at that release, so the code matches the packages you install.

## What it is

Runic Command Line is a command framework for .NET 10 that works with
NativeAOT. You write a `static` method and mark it with `[Command]`. A source
generator, which ships inside the core package, reads those methods at build
time and creates a command catalog, `GeneratedCommandCatalog`. `CommandApp`
runs that catalog: it parses the arguments, shows help and the version,
executes the command and maps the outcome to an exit code. There is no runtime
reflection, so the result can be published as a small native executable.

The library does not depend on a UI framework, a Generic Host or a particular
parser. Presentation with Spectre.Console is an optional package.

## Packages

All packages release together. Keep the optional packages on exactly the same
version as the core package.

| Package                       | Purpose                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `Runic.CommandLine`           | Commands, parsing, execution, hosting and output. Includes the generator.      |
| `Runic.CommandLine.Spectre`   | Optional Spectre.Console presentation: styled help, tables, progress, prompts. |
| `Runic.CommandLine.Processes` | Optional bounded execution of local child processes.                           |
| `Runic.CommandLine.Testing`   | Optional in-memory test helpers, such as `CommandAppTester`.                   |

## Your first command

Create a console project and add the core package:

```sh docs-test=skip:cli-repository
dotnet new console --framework net10.0 --name HelloCli
cd HelloCli
dotnet add package Runic.CommandLine --version 0.8.0
```

Replace `Program.cs` with this program. It is the maintained
[`hello-world/Program.cs`](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/examples/command-line/hello-world/Program.cs)
example:

```csharp docs-test=skip:cli-repository
using Runic.CommandLine;
using Runic.CommandLine.Generated;

return await new CommandApp(GeneratedCommandCatalog.Create()) { Name = "hello" }.RunAsync(args);

internal static class Commands
{
    [Command("greet", Description = "Say hello."), DefaultCommand]
    internal static string Greet([Argument] string name = "world",
        [Option("--count", "-n", Minimum = 1, Maximum = 100)] int count = 1) =>
        string.Join('\n', Enumerable.Repeat($"Hello, {name}!", count));
}
```

The parts you need to know:

- `[Command("greet")]` makes the method a command. A name with a space, such as
  `"config show"`, creates a command group automatically.
- `[DefaultCommand]` runs `greet` when no command name is given, so `hello Ada`
  and `hello greet Ada` do the same.
- `[Argument]` is a positional value; `[Option("--count", "-n")]` is a named
  option with an alias. A C# default makes it optional. A non-nullable option
  without a default is required.
- `Minimum` and `Maximum` are checked before the method runs.
- The method's return value is the result. `string`, `void`, `Task` and
  `ValueTask` need no extra setup. An `int` result is data, not an exit code.

A method can also take a `CancellationToken`, a `CommandExecutionContext` or an
`ICommandConsole`; they are passed in automatically. Other services use
`[FromServices]`.

## Build and run

```sh docs-test=skip:cli-repository
dotnet run -- Ada --count 2
dotnet run -- Ada --count 2 --format=json
dotnet run -- --help
```

The first command prints `Hello, Ada!` twice. The second prints one JSON
response instead; see
[Output for people and for scripts](#output-for-people-and-for-scripts).

To ship a native executable, publish with NativeAOT for your platform, as the
release's package check does:

```sh docs-test=skip:cli-repository
dotnet publish -c Release -r linux-x64 -p:PublishAot=true
```

## Help and validation

`CommandApp` builds help from the catalog. `hello --help`, `hello help greet`
and `hello greet --help` all work, and `--version` prints `CommandApp.Version`.
Set `Description` on commands, arguments and options to fill the help text.

Input is checked in two places:

- **At build time.** The generator reports `RCLI9xxx` compiler errors for a
  `[Command]` method it cannot use, for example a parameter without
  `[Argument]`, `[Option]` or `[FromServices]`. The command is skipped until you
  fix the error. Each ID is explained in
  [source generator diagnostics](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/docs/guides/command-line/diagnostics.md).
- **At run time.** Unknown options, missing required values, values outside
  `Minimum`/`Maximum`, `Choices`, `MustExist` paths and `Requires` or
  `ConflictsWith` rules fail before the method runs. The error names the
  parameter but never echoes its value. Close typos get suggestions.

## Shared options and environment variables

An option can fall back to an environment variable. An explicit argument wins
over the environment, which wins over the C# default. This command comes from
the release's
[command tree example](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/examples/command-line/Program.cs):

```csharp docs-test=skip:cli-repository
[Command("config show", Description = "Show the chosen environment.")]
internal static string Config([Option("--environment", EnvironmentVariable = "HELLO_ENV", Choices = ["local", "production"])] string environment = "local") => environment;
```

An option that every command accepts, such as `--verbose`, is added to the
catalog with `GlobalOption`. It may appear before or after the command name:

```csharp docs-test=skip:cli-repository
GeneratedCommandCatalog.Create(builder => builder
    .GlobalOption("verbose", "--verbose", CommandArity.Zero, new CommandHelp("Show detailed progress."), "-v"))
```

## Output for people and for scripts

By default a command writes human text. `--format json`, or the environment
variable `RUNIC_COMMANDLINE_OUTPUT=json`, switches to machine output: exactly
one JSON response on stdout, with the protocol `runic.commandline/1`. It holds
`success`, `exitCode`, the typed `payload` on success and a `fault` on failure.
In JSON mode the injected `ICommandConsole` sends other output, such as
progress, to stderr, so stdout stays parseable.

Results other than strings declare a payload identity and a source-generated
JSON context with `[CommandResult("example.result/1", typeof(JsonContext))]`.
Give that context camelCase property names, for example with
`[JsonSourceGenerationOptions(JsonSerializerDefaults.Web)]`; otherwise the
generator warns with `RCLI9044`, because the payload would keep the C#
property names inside the camelCase envelope. The
[protocol specification](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/specs/command-line/protocol/README.md)
describes every field.

## Exit codes

A command's outcome has a category, `CommandExitCategory`, and each category
has a default exit code in `CommandExitCodes`. The defaults below come from
that type and the protocol specification:

| Exit code | Category         | Meaning                                        |
| --------- | ---------------- | ---------------------------------------------- |
| 0         | `Success`        | The command succeeded.                         |
| 1         | `CommandFailure` | The command reported an expected failure.      |
| 1         | `Unavailable`    | A required resource or service was missing.    |
| 2         | `Usage`          | The arguments could not be parsed.             |
| 2         | `Validation`     | A value failed validation.                     |
| 3         | `HostFailure`    | The host or framework failed unexpectedly.     |
| 130       | `Cancelled`      | The command was cancelled, for example Ctrl+C. |

These are the exit codes of every Runic tool. Categories that share a code are
still distinct in `CommandExitCategory`, the JSON fault and observers.
`CommandApp.HandleTerminationSignals` (on by default) handles Ctrl+C, SIGTERM
and SIGQUIT: the first signal cancels the command. A repeated signal while the
command still runs ends the process at once with 128 plus the signal number:
130, 143 or 131. Cleanup that must finish can call
`CommandExecutionContext.ProtectShutdown()` to keep a repeated signal from
exiting until the scope is disposed. Set `CommandApp.ExitCodePolicy` to map
categories to other nonzero codes.

Command Line 0.8.0 changed these codes and renamed the output selector from
`--output` to `--format`; a catalog keeps the old spelling as a hidden alias
with `OutputSelector("--format", "--output")`. See the
[0.8.0 upgrade table](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/eng/release/notes/0.8.0.md#upgrading).

## Styled output with Spectre

Add `Runic.CommandLine.Spectre` at the same version, then set the console and
help presenter. The parsing and the JSON output stay the same:

```csharp docs-test=skip:cli-repository
return await new CommandApp(GeneratedCommandCatalog.Create())
{
    Name = "hello",
    Console = new SpectreCommandConsole(),
    HelpPresenter = new SpectreHelpPresenter()
}.RunAsync(args);
```

Colors are turned off for redirected output, `NO_COLOR` and `TERM=dumb`.

## Commands next to an existing application

An application that already owns its startup, services and UI can run the
same generated commands with `CommandLineHostingAdapter`. It decides whether
the arguments ask for a command, help or the UI, and runs a command in a
service scope that your application supplies. When the first word is a close
match for a visible command, such as `lst` for `list`, the launch still opens
the UI, and `decision.SuggestedCommand` names the command. Call
`adapter.WriteSuggestionAsync(decision)` before opening the UI to write the
standalone "Did you mean 'list'?" line to standard error. This is new in
`0.6.0-preview.5`. The
[hosted example](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/examples/command-line/HostedExample.cs)
shows the full flow, and
[adding a CLI to a WPF application](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/docs/guides/command-line/wpf.md)
applies it to a desktop app.

A Runic Desktop host must start on the main thread before any `await`, so a
command such as `my-app ui` hands its start back to `Main` with
`ContinueOnCallingThread`, and `Main` returns `CommandApp.Run(args)`, which
runs it after the command, with SDK `0.8.0-preview.4`:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views.Desktop/README.md
// A synchronous Main, or no await before this line: the thread is the process main thread.
return new CommandApp(GeneratedCommandCatalog.Create()) { Name = "my-app" }.Run(args);

internal static class WindowCommands
{
    [Command("ui", Description = "Open the main window.")]
    internal static async Task Ui(CommandExecutionContext context,
        [Option("--settings")] string? path = null, CancellationToken cancellationToken = default)
    {
        // Asynchronous work and its failures belong to the command, before the host starts.
        AppSettings settings = await AppSettings.LoadAsync(path, cancellationToken);
        context.ContinueOnCallingThread(() => DesktopEventLoop.Run(new DesktopHostOptions(), async desktop =>
        {
            await using var provider = new ServiceCollection()
                .AddSingleton(settings)
                .AddScoped<MainViewModel>()
                .AddRunicViews()
                .BuildServiceProvider();
            var host = new RunicDesktopHost(provider, desktop);
            await using var window = await host.OpenWindowAsync<MainWindow>();
            await window.WaitForCloseAsync();
            return 0;
        }));
    }
}
```

Capture values such as `settings`, not the command's scoped services.
See [from a command line](https://github.com/Runic-Artifex/runic-sdk/blob/v0.10.0/packages/dotnet/Runic.Application.Views.Desktop/README.md#from-a-command-line)
and
[start a UI host on the main thread](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/packages/dotnet/Runic.CommandLine/README.md#start-a-ui-host-on-the-main-thread).

## Translate a CLI

Help, parse errors and faults are English by default. The
`Runic.Translations.CommandLine` adapter, which Runic Translations publishes,
translates them with a [Translations](../translations/README.md) catalog. It
ships English and German text for every framework key, and it looks up your
own command descriptions in your catalog, including the prompt text that
Command Line `0.7.0-preview.1` added. Translations `0.7.0-preview.4` is built
against Command Line `0.7.0-preview`; Command Line `0.8.0` renames APIs it uses, so
keep Command Line `0.7.0-preview.2` with it until the next Translations release,
which supports `0.8.0`.
Add the adapter and the build package to the project from
[your first command](#your-first-command):

```sh docs-test=skip:translations-repository
dotnet add package Runic.Translations.CommandLine --version 0.7.0-preview.4
dotnet add package Runic.Translations.Build --version 0.7.0-preview.4
```

The build package compiles a `translations/` folder next to the project file.
Create `translations/runic.json`:

```json docs-test=skip:translations-repository
{
  "schemaVersion": 1,
  "catalog": "hello",
  "code": { "namespace": "HelloCli.Translations", "className": "HelloText" },
  "baseLocale": "en",
  "locales": ["en", "de"]
}
```

`translations/en.rmf2` defines every message in English:

```rmf2 docs-test=skip:translations-repository
commands {
  greet = Say hello.
}
greeting =
  .input {$name :string}
  {{Hello, {$name}!}}
```

`translations/de.rmf2` has the same keys in German:

```rmf2 docs-test=skip:translations-repository
commands {
  greet = Grüßt eine Person.
}
greeting =
  .input {$name :string}
  {{Hallo, {$name}!}}
```

Then give `CommandApp` the resolver and the commands a translation manager:

```csharp docs-test=skip:translations-repository
using System.Globalization;
using HelloCli.Translations;
using Runic.CommandLine;
using Runic.CommandLine.Generated;
using Runic.Translations;
using Runic.Translations.CommandLine;

// Under LANG=C the invariant culture has no name; the catalog then uses its base locale.
ITranslationManager manager = HelloTextCatalog.CreateManager(
    initialLocale: CultureInfo.CurrentUICulture.Name);

return await new CommandApp(GeneratedCommandCatalog.Create())
{
    Name = "hello",
    TextResolver = new TranslationCommandTextResolver(manager),
    ScopeFactory = CommandScopes.FromServices(CommandServices.Empty.With(manager)),
}.RunAsync(args);

internal static class Commands
{
    [Command("greet", Description = "Say hello.", DescriptionKey = "commands.greet"), DefaultCommand]
    internal static string Greet([Argument] string name, [FromServices] ITranslationManager translations) =>
        new HelloText(translations).Messages.greeting(name);
}
```

With a German display language, `hello --help` starts with
`Aufruf: hello <Befehl> [Optionen]` and lists `greet` as `Grüßt eine Person.`,
and `hello Ada` prints `Hallo, Ada!`. A locale the catalog does not have, such
as French, gets English. The same text appears in the JSON `message` fields;
command names, option spellings, codes and `messageKey` values never change.

- **Resolver.** `TranslationCommandTextResolver` looks up each key in your
  catalog first, so the catalog can also override framework text, then in its
  English and German text, and otherwise leaves Command Line's English text.
  Pass the manager to follow locale switches, or an `ITranslationSnapshot` for
  one fixed locale. A message name is the key with each hyphen removed and the
  next letter capitalized: `help.show-help` is `help.showHelp`. The
  [framework text keys](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/docs/guides/command-line/text-keys.md)
  list every key and its arguments.
- **`CommandScopes`.** `CommandScopes.FromServices` makes application-owned
  objects available to `[FromServices]` parameters without a
  dependency-injection package. Use `CommandScopes.FromServices(provider)` for
  an existing `IServiceProvider`, or
  `CommandScopes.Create(provider.CreateAsyncScope, scope => scope.ServiceProvider)`
  for one scope per invocation. Take `ITranslationManager` and create
  `HelloText` in the method: the Command Line generator cannot use a type that
  another source generator creates, such as `HelloText`, as a parameter
  (`RCLI9003`).
- **`RUNIC_COMMANDLINE_DEBUG`.** A `DescriptionKey` that the catalog does not
  have falls back to `Description` without an error. Set
  `RUNIC_COMMANDLINE_DEBUG=1` to have help print each one to stderr as an
  `RCLI0023` warning. In a test,
  `new CommandTextContext(culture, resolver).ValidateDescriptionKeys(catalog)`
  returns the same issues. The same
  variable writes the exception of an `RCLI5000` host failure to stderr.

The
[`Runic.Translations.CommandLine` README](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.7.0-preview.4/packages/dotnet/Runic.Translations.CommandLine/README.md)
describes the resolver in full.

## Next steps

- [From one command to an application](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/examples/command-line/README.md)
  grows the example step by step: command trees, file input, services,
  progress, tests, child processes and localized help.
- The
  [`Runic.CommandLine` package README](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/packages/dotnet/Runic.CommandLine/README.md)
  lists every supported parameter type and attribute property.
- The
  [grammar](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/specs/command-line/grammar.md)
  and
  [protocol](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/specs/command-line/protocol/README.md)
  specifications define parsing and the JSON response.
- [Source generator diagnostics](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/docs/guides/command-line/diagnostics.md)
  explains each `RCLI9xxx` error.
- [Release notes for 0.8.0](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/eng/release/notes/0.8.0.md)
  list what changed in this release.
