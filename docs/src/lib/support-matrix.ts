// The Window host support matrix, read from the SDK's eng/support.json in the
// pinned SDK snapshot (sources/sdk-inputs.json). The SDK README table and
// `dotnet runic doctor --rid` use the same data.
import support from '../../sources/sdk/eng/support.json';

export type SupportStatus =
  'ci-verified' | 'packaged-unverified' | 'unsupported';

export type SupportTarget = {
  readonly rid: string;
  readonly status: SupportStatus;
  readonly reason: string;
  readonly remediation?: string;
};

export type SupportHost = {
  readonly id: string;
  readonly name: string;
  readonly package: string;
  readonly targets: readonly SupportTarget[];
};

export type SupportRequirement = {
  readonly id: string;
  readonly os: 'win' | 'linux' | 'osx';
  readonly hosts: readonly string[];
  readonly component: string;
  readonly minimum: string | null;
  readonly note: string;
};

export type SupportMatrix = {
  readonly schemaVersion: number;
  readonly statuses: Readonly<Record<SupportStatus, string>>;
  readonly hosts: readonly SupportHost[];
  readonly requirements: readonly SupportRequirement[];
};

export const supportMatrix = support as SupportMatrix;

export const supportStatuses: readonly SupportStatus[] = [
  'ci-verified',
  'packaged-unverified',
  'unsupported',
];

export const supportStatusLabels: Readonly<Record<SupportStatus, string>> = {
  'ci-verified': 'CI-verified',
  'packaged-unverified': 'Packaged, not CI-verified',
  unsupported: 'Unsupported',
};

export const operatingSystemNames: Readonly<
  Record<SupportRequirement['os'], string>
> = { win: 'Windows', linux: 'Linux', osx: 'macOS' };

/** Every listed RID, in the order the SDK data first lists it. */
export const supportRids: readonly string[] = [
  ...new Set(
    supportMatrix.hosts.flatMap((host) =>
      host.targets.map((target) => target.rid),
    ),
  ),
];

/** The entry for a host and RID. RIDs the SDK does not list are unsupported. */
export function supportFor(host: SupportHost, rid: string): SupportTarget {
  return (
    host.targets.find((target) => target.rid === rid) ?? {
      rid,
      status: 'unsupported',
      reason: `${host.name} does not list ${rid}.`,
    }
  );
}

export function hostName(id: string): string {
  return supportMatrix.hosts.find((host) => host.id === id)?.name ?? id;
}

export function requirementLabel(requirement: SupportRequirement): string {
  return requirement.minimum
    ? `${requirement.component} ${requirement.minimum} or newer`
    : requirement.component;
}
