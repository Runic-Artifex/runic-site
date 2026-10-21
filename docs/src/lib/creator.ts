// The runic-app template's own declarations drive the picker, so its choices,
// defaults, and flags cannot drift from `dotnet new runic-app` or Runic.Create.
import hostJson from '../../sources/sdk/tools/Runic.Application.Templates/content/runic-app/.template.config/dotnetcli.host.json';
import templateJson from '../../sources/sdk/tools/Runic.Application.Templates/content/runic-app/.template.config/template.json';
import { evaluate } from './template-conditions';

export type CreatorChoice = {
  readonly value: string;
  readonly label: string;
  readonly description: string;
};

export type CreatorOption = {
  readonly symbol: string;
  readonly flag: string;
  readonly label: string;
  readonly description: string;
  readonly defaultValue: string;
  readonly choices: readonly CreatorChoice[];
};

/** A Boolean template parameter, such as `--tests`, passed as a bare flag. */
export type CreatorToggle = {
  readonly symbol: string;
  readonly flag: string;
  readonly label: string;
  readonly description: string;
  readonly defaultValue: boolean;
};

/** Choice values, and `'true'` or `'false'` for toggles, by template symbol. */
export type CreatorSelection = Readonly<Record<string, string>>;

type TemplateSymbol = {
  readonly type?: string;
  readonly datatype?: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly defaultValue?: string;
  readonly value?: string;
  readonly replaces?: string;
  readonly valueTransform?: string;
  readonly generator?: string;
  readonly parameters?: {
    readonly cases?: readonly {
      readonly condition?: string;
      readonly value: string;
    }[];
  };
  readonly choices?: readonly {
    readonly choice: string;
    readonly displayName?: string;
    readonly description?: string;
  }[];
};

type SymbolInfo = { readonly longName?: string; readonly isHidden?: boolean };

const symbols = templateJson.symbols as Readonly<
  Record<string, TemplateSymbol>
>;
const symbolInfo = hostJson.symbolInfo as Readonly<Record<string, SymbolInfo>>;

export const creatorOptions: readonly CreatorOption[] = Object.entries(symbols)
  .filter(
    ([name, symbol]) =>
      symbol.type === 'parameter' &&
      symbol.datatype === 'choice' &&
      !symbolInfo[name]?.isHidden,
  )
  .map(([name, symbol]) => ({
    symbol: name,
    flag: `--${symbolInfo[name]?.longName ?? name}`,
    label: symbol.displayName ?? name,
    description: symbol.description ?? '',
    defaultValue: symbol.defaultValue ?? symbol.choices![0].choice,
    choices: symbol.choices!.map((choice) => ({
      value: choice.choice,
      label: choice.displayName ?? choice.choice,
      description: choice.description ?? '',
    })),
  }));

// Runic.Create offers the same Boolean parameters and appends them after the
// choices (TemplateToggle in CreatePlan.cs).
export const creatorToggles: readonly CreatorToggle[] = Object.entries(symbols)
  .filter(
    ([name, symbol]) =>
      symbol.type === 'parameter' &&
      symbol.datatype === 'bool' &&
      !symbolInfo[name]?.isHidden,
  )
  .map(([name, symbol]) => ({
    symbol: name,
    flag: `--${symbolInfo[name]?.longName ?? name}`,
    label: symbol.displayName ?? name,
    description: symbol.description ?? '',
    defaultValue: symbol.defaultValue === 'true',
  }));

export const templateSourceName: string = templateJson.sourceName;
export const templateShortName: string = templateJson.shortName;

export function defaultSelection(): Record<string, string> {
  return Object.fromEntries([
    ...creatorOptions.map((option) => [option.symbol, option.defaultValue]),
    ...creatorToggles.map((toggle) => [
      toggle.symbol,
      String(toggle.defaultValue),
    ]),
  ]);
}

export function isEnabled(
  toggle: CreatorToggle,
  selection: CreatorSelection,
): boolean {
  const value = selection[toggle.symbol];
  return value === undefined ? toggle.defaultValue : value === 'true';
}

/**
 * Whether an option applies to the selection. Like Runic.Create, the creator
 * neither shows nor passes `--linux-gtk` unless the host is Runic Desktop.
 */
export function optionApplies(
  option: CreatorOption,
  selection: CreatorSelection,
): boolean {
  return (
    option.symbol !== 'linuxGtk' || (selection.host ?? 'desktop') === 'desktop'
  );
}

/**
 * Adds the template's Boolean parameters that the selection leaves out, such
 * as `tests`, at their defaults, its computed symbols, such as `desktopHost`,
 * as `true` or `false`, and its `switch` generated symbols, such as
 * `nixHost`, in declaration order like the template engine.
 */
export function templateSymbols(
  selection: CreatorSelection,
): Record<string, string> {
  const result: Record<string, string> = { ...selection };
  for (const [name, symbol] of Object.entries(symbols))
    if (
      symbol.type === 'parameter' &&
      symbol.datatype === 'bool' &&
      !(name in result)
    )
      result[name] = symbol.defaultValue ?? 'false';
    else if (symbol.type === 'computed')
      result[name] = String(evaluate(symbol.value ?? '', result));
    else if (symbol.type === 'generated' && symbol.generator === 'switch') {
      const match = symbol.parameters?.cases?.find(
        (entry) => !entry.condition || evaluate(entry.condition, result),
      );
      if (match) result[name] = match.value;
    }
  return result;
}

/**
 * The text that each parameter with `replaces`, such as `__RUNIC_HOST__`,
 * stands for in the template files, mapped to its selected value.
 */
export function templateReplacements(
  selection: CreatorSelection,
  projectName: string = templateSourceName,
): [string, string][] {
  const values = {
    ...templateSymbols(selection),
    ...applicationIdentity(projectName),
  };
  return Object.entries(symbols)
    .filter(([name, symbol]) => symbol.replaces && name in values)
    .map(([name, symbol]) => [symbol.replaces!, values[name]]);
}

type TemplateForm = {
  readonly identifier: string;
  readonly pattern?: string;
  readonly replacement?: string;
  readonly steps?: readonly string[];
};

const forms = templateJson.forms as Readonly<Record<string, TemplateForm>>;

function applyForm(form: string, value: string): string {
  // `identity` is built in.
  if (!(form in forms)) return value;
  const { identifier, pattern, replacement, steps } = forms[form];
  if (identifier === 'chain')
    return steps!.reduce((text, step) => applyForm(step, text), value);
  return value.replace(new RegExp(pattern!, 'g'), replacement!);
}

/**
 * The template's name-derived symbols for the default application ID
 * (`--application-id` left out): the display name, and `com.example.` with
 * the project name's ASCII letters and digits, else `App`.
 */
function applicationIdentity(projectName: string): Record<string, string> {
  const derived = applyForm(
    symbols.derivedApplicationName.valueTransform!,
    projectName,
  );
  return {
    applicationDisplayName: projectName,
    applicationIdValue: `com.example.${derived || 'App'}`,
  };
}

export function choiceFor(
  option: CreatorOption,
  selection: CreatorSelection,
): CreatorChoice {
  return (
    option.choices.find(
      (choice) => choice.value === selection[option.symbol],
    ) ?? option.choices.find((choice) => choice.value === option.defaultValue)!
  );
}

/** Project names accepted by Runic.Create. */
export function isValidProjectName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(name);
}

// Matches Runic.Create's CreatePlan formatting so both print the same text.
function quote(argument: string): string {
  return /^[A-Za-z0-9\-_./:@=+,]+$/.test(argument)
    ? argument
    : `'${argument.replaceAll("'", `'"'"'`)}'`;
}

function format(argumentsList: readonly string[]): string {
  return argumentsList.map(quote).join(' ');
}

function optionArguments(selection: CreatorSelection): string[] {
  return [
    ...creatorOptions
      .filter((option) => optionApplies(option, selection))
      .flatMap((option) => [option.flag, choiceFor(option, selection).value]),
    ...creatorToggles
      .filter((toggle) => isEnabled(toggle, selection))
      .map((toggle) => toggle.flag),
  ];
}

export type CreatorCommands = {
  /** The interactive creator, which asks every question. */
  readonly interactive: string;
  /** The creator with every answer supplied. */
  readonly creator: string;
  /** The template installation and instantiation the creator runs. */
  readonly install: string;
  readonly create: string;
  readonly nextSteps: readonly string[];
};

export function creatorCommands(
  version: string,
  name: string,
  selection: CreatorSelection,
): CreatorCommands {
  return {
    interactive: format(['dnx', `Runic.Create@${version}`]),
    creator: format([
      'dnx',
      `Runic.Create@${version}`,
      '--',
      name,
      ...optionArguments(selection),
    ]),
    install: format([
      'dotnet',
      'new',
      'install',
      `Runic.Application.Templates@${version}`,
    ]),
    create: format([
      'dotnet',
      'new',
      templateShortName,
      '--name',
      name,
      ...optionArguments(selection),
    ]),
    nextSteps: [
      format(['cd', name]),
      'dotnet tool restore',
      'dotnet runic dev',
      // As Runic.Create prints after creating a project with --tests.
      ...(creatorToggles.some(
        (toggle) => toggle.symbol === 'tests' && isEnabled(toggle, selection),
      )
        ? [format(['dotnet', 'test', '--project', `${name}.Tests`])]
        : []),
    ],
  };
}
