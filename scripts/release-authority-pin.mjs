export const releaseAuthorityPin = {
  // Update this complete pin after the release-authority evidence commit lands.
  repository: 'Runic-Artifex/.github',
  revision: '724355893b33c745d5f6bdc2d8de607eab1d465c',
  files: {
    manifest: {
      path: 'runic.release.json',
      sha256:
        '44509da940d238738427d2cce4a8d2d58863b21f1d976daf854c04be9c086b3f',
    },
    schema: {
      path: 'runic.release.schema.json',
      sha256:
        '32b46fd971d70e7b830802101745076f401bf201571834f8b57856686b8950e6',
    },
    verifier: {
      path: 'eng/verify-release-manifest.mjs',
      sha256:
        '8b6fdf5bb8e83446f7a92c00c3a1f4c8f277c2cfa8e7d56fb704f6653f486ec6',
    },
  },
};
