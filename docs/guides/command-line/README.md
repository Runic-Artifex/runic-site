# Get started with Runic Command Line

Runic Command Line turns typed C# methods into commands with help, validation
and human or JSON output. This page takes you from an empty folder to a
working command.

It covers release `0.6.0-preview.3`. Every link to the
[Command Line repository](https://github.com/Runic-Artifex/runic-cli-sdk/tree/v0.6.0-preview.3)
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
dotnet add package Runic.CommandLine --version 0.6.0-preview.3
```

Replace `Program.cs` with this program. It is the maintained
[`hello-world/Program.cs`](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.3/examples/command-line/hello-world/Program.cs)
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
dotnet run -- Ada --count 2 --output=json
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
  [source generator diagnostics](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.3/docs/guides/command-line/diagnostics.md).
- **At run time.** Unknown options, missing required values, values outside
  `Minimum`/`Maximum`, `Choices`, `MustExist` paths and `Requires` or
  `ConflictsWith` rules fail before the method runs. The error names the
  parameter but never echoes its value. Close typos get suggestions.

## Shared options and environment variables

An option can fall back to an environment variable. An explicit argument wins
over the environment, which wins over the C# default. This command comes from
the release's
[command tree example](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.3/examples/command-line/Program.cs):

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

By default a command writes human text. `--output json`, or the environment
variable `RUNIC_COMMANDLINE_OUTPUT=json`, switches to machine output: exactly
one JSON response on stdout, with the protocol `runic.commandline/1`. It holds
`success`, `exitCode`, the typed `payload` on success and a `fault` on failure.
In JSON mode the injected `ICommandConsole` sends other output, such as
progress, to stderr, so stdout stays parseable.

Results other than strings declare a payload identity and a source-generated
JSON context with `[CommandResult("example.result/1", typeof(JsonContext))]`.
The
[protocol specification](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.3/specs/command-line/protocol/README.md)
describes every field.

## Exit codes

A command's outcome has a category, `CommandExitCategory`, and each category
has a default exit code in `CommandExitCodes`. The defaults below come from
that type and the protocol specification:

| Exit code | Category         | Meaning                                        |
| --------- | ---------------- | ---------------------------------------------- |
| 0         | `Success`        | The command succeeded.                         |
| 2         | `Usage`          | The arguments could not be parsed.             |
| 3         | `Validation`     | A value failed validation.                     |
| 4         | `Cancelled`      | The command was cancelled, for example Ctrl+C. |
| 5         | `Unavailable`    | A required resource or service was missing.    |
| 10        | `CommandFailure` | The command reported an expected failure.      |
| 70        | `HostFailure`    | The host or framework failed unexpectedly.     |

A second Ctrl+C, SIGTERM or SIGQUIT while the command still runs ends the
process at once with 128 plus the signal number: 130, 143 or 131. Set
`CommandApp.ExitCodePolicy` to map categories to other nonzero codes.

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
service scope that your application supplies. The
[hosted example](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.3/examples/command-line/HostedExample.cs)
shows the full flow, and
[adding a CLI to a WPF application](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.3/docs/guides/command-line/wpf.md)
applies it to a desktop app.

## Next steps

- [From one command to an application](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.3/examples/command-line/README.md)
  grows the example step by step: command trees, file input, services,
  progress, tests, child processes and localized help.
- The
  [`Runic.CommandLine` package README](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.3/packages/dotnet/Runic.CommandLine/README.md)
  lists every supported parameter type and attribute property.
- The
  [grammar](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.3/specs/command-line/grammar.md)
  and
  [protocol](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.3/specs/command-line/protocol/README.md)
  specifications define parsing and the JSON response.
- [Source generator diagnostics](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.3/docs/guides/command-line/diagnostics.md)
  explains each `RCLI9xxx` error.
- [Release notes for 0.6.0-preview.3](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.3/eng/release/notes/0.6.0-preview.3.md)
  list what changed in this release.
