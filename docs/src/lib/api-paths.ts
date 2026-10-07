// Site paths of the API reference. Dependency-free, so client pages can link
// it without bundling the reference data.

/** `Runic.Assets` stays as is; `@runic-artifex/views` becomes `runic-artifex-views`. */
export function apiPackageSlug(packageId: string): string {
  return packageId.replace(/^@/, '').replace(/\//g, '-');
}

export function apiPackageHref(packageId: string): string {
  return `/api/${apiPackageSlug(packageId)}/`;
}

/** Install kinds whose packages have an API reference. */
export function hasApiReference(installKind: string | undefined): boolean {
  return installKind === 'nuget-package' || installKind === 'npm-package';
}
