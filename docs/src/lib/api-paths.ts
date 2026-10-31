// Site paths of the API reference. Client pages link it without bundling the
// reference data: only the list of packages without a library is imported.
import { withoutLibrary } from '../../sources/api-inputs.json';

/** `Runic.Assets` stays as is; `@runic-artifex/views` becomes `runic-artifex-views`. */
export function apiPackageSlug(packageId: string): string {
  return packageId.replace(/^@/, '').replace(/\//g, '-');
}

export function apiPackageHref(packageId: string): string {
  return `/api/${apiPackageSlug(packageId)}/`;
}

/**
 * Whether a catalog package has an API reference: a library package of its
 * install kind, unless it ships no managed library (`withoutLibrary` in
 * sources/api-inputs.json), such as Runic.Desktop.NativeServer.
 */
export function hasApiReference(
  installKind: string | undefined,
  packageId?: string,
): boolean {
  return (
    (installKind === 'nuget-package' || installKind === 'npm-package') &&
    !(packageId !== undefined && withoutLibrary.includes(packageId))
  );
}
