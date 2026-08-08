# Releasing `@potato4d/dodai`

Publishing runs from `.github/workflows/publish.yml` when a stable GitHub
Release is published. The release tag must match `v<package.json version>`.

## One-time npm setup

After `publish.yml` is on the default branch, add a GitHub Actions Trusted
Publisher in the npm settings for `@potato4d/dodai`:

- Organization or user: `potato4d`
- Repository: `dodai`
- Workflow filename: `publish.yml`
- Environment: leave blank
- Allowed action: `npm publish`

No `NPM_TOKEN` GitHub secret is needed. The workflow authenticates with OIDC.

## Release

1. Update `package.json` to an unpublished version and run `pnpm test`.
2. Merge the change to the default branch and tag it as `v<version>`.
3. Publish a non-prerelease GitHub Release for that tag.
4. Confirm that the `Publish to npm` workflow succeeds.
